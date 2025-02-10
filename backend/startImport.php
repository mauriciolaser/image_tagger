<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Configurar logs de errores
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/import_errors.log');

require __DIR__ . '/vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

$conn = new mysqli(
    $_ENV['DB_HOST'],
    $_ENV['DB_USER'],
    $_ENV['DB_PASS'],
    $_ENV['DB_NAME'],
    $_ENV['DB_PORT'] ?? 3306
);

if ($conn->connect_error) {
    error_log("Error de conexión a BD: " . $conn->connect_error);
    http_response_code(500);
    exit(json_encode(["success" => false, "message" => "Error de conexión a BD"]));
}

// Validar el `user_id`
$user_id = filter_input(INPUT_GET, 'user_id', FILTER_VALIDATE_INT);
if (!$user_id) {
    http_response_code(400);
    exit(json_encode(["success" => false, "message" => "ID de usuario inválido"]));
}

// Verificar si hay un job en curso antes de iniciar uno nuevo
$checkStmt = $conn->prepare("
    SELECT id, status 
    FROM import_jobs 
    WHERE user_id = ? AND status IN ('pending', 'running') 
    ORDER BY created_at DESC 
    LIMIT 1
");
$checkStmt->bind_param("i", $user_id);
$checkStmt->execute();
$checkStmt->store_result();

if ($checkStmt->num_rows > 0) {
    $checkStmt->bind_result($existing_job_id, $existing_status);
    $checkStmt->fetch();
    $checkStmt->close();

    error_log("Ya hay un job en proceso con ID: $existing_job_id y estado: $existing_status");
    
    http_response_code(400);
    exit(json_encode(["success" => false, "message" => "Ya hay un job en proceso ($existing_status)."]));
}
$checkStmt->close();

// Verificar que el directorio de imágenes existe
$sourceDir = $_ENV['PRIVATE_IMAGES_DIR'] ?? null;
if (!$sourceDir || !is_dir($sourceDir)) {
    http_response_code(500);
    exit(json_encode(["success" => false, "message" => "El directorio de imágenes no existe: $sourceDir"]));
}

// Definir extensiones permitidas
$allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];

// Escanear archivos en el directorio
$files = array_diff(scandir($sourceDir), ['.', '..']); // Excluye "." y ".."

if (empty($files)) {
    http_response_code(400);
    exit(json_encode(["success" => false, "message" => "No hay imágenes para importar."]));
}

// Iniciar transacción para evitar inconsistencias
$conn->begin_transaction();

try {
    // Insertar un nuevo `import_job`
    $stmt = $conn->prepare("INSERT INTO import_jobs (user_id, status) VALUES (?, 'pending')");
    if (!$stmt) {
        throw new Exception("Error preparando consulta import_jobs: " . $conn->error);
    }

    $stmt->bind_param("i", $user_id);
    if (!$stmt->execute()) {
        throw new Exception("Error ejecutando consulta import_jobs: " . $stmt->error);
    }

    $job_id = $stmt->insert_id;
    $stmt->close();

    // Validar que `$job_id` es válido
    if (!$job_id) {
        throw new Exception("Error: No se pudo obtener `job_id` después de insertar.");
    }

    // Insertar imágenes en `image_queue` (se agrega la columna job_id)
    $insertStmt = $conn->prepare("INSERT INTO image_queue (job_id, filename, status) VALUES (?, ?, 'pending')");
    if (!$insertStmt) {
        throw new Exception("Error preparando consulta image_queue: " . $conn->error);
    }

    $insertedCount = 0;
    foreach ($files as $file) {
        $filePath = $sourceDir . '/' . $file;

        // Verificar que es un archivo válido
        if (!is_file($filePath)) {
            continue;
        }

        // Validar la extensión del archivo
        $extension = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        if (!in_array($extension, $allowedExtensions)) {
            continue;
        }

        // Evitar duplicados en `image_queue` (solo por filename)
        $checkStmt = $conn->prepare("SELECT COUNT(*) FROM image_queue WHERE filename = ?");
        $checkStmt->bind_param("s", $file);
        $checkStmt->execute();
        $checkStmt->bind_result($count);
        $checkStmt->fetch();
        $checkStmt->close();

        if ($count > 0) {
            continue;
        }

        // Insertar en la cola
        $insertStmt->bind_param("is", $job_id, $file);
        if ($insertStmt->execute()) {
            $insertedCount++;
        }
    }
    $insertStmt->close();

    // Si no se insertó ninguna imagen, marcar el `import_job` como `completed`
    if ($insertedCount === 0) {
        $conn->query("UPDATE import_jobs SET status = 'completed' WHERE id = $job_id");
        throw new Exception("Todas las imágenes ya estaban en la cola o no había imágenes válidas.");
    }

    // Confirmar la transacción
    $conn->commit();

} catch (Exception $e) {
    $conn->rollback();
    error_log("Error en `startImport.php`: " . $e->getMessage());
    http_response_code(500);
    exit(json_encode(["success" => false, "message" => $e->getMessage()]));
}

// Verificar si el archivo `process_queue.php` existe antes de ejecutarlo
$processScript = __DIR__ . "/process_queue.php";
if (!file_exists($processScript)) {
    http_response_code(500);
    exit(json_encode(["success" => false, "message" => "Archivo `process_queue.php` no encontrado"]));
}

// Ejecutar el proceso en segundo plano (asegúrate de que `exec` esté permitido)
exec("php $processScript $job_id > /dev/null 2>&1 &", $output, $return_var);

if ($return_var !== 0) {
    http_response_code(500);
    exit(json_encode(["success" => false, "message" => "Error al ejecutar el proceso en segundo plano"]));
}

// Responder con éxito
http_response_code(200);
exit(json_encode(["success" => true, "job_id" => $job_id, "added_images" => $insertedCount]));
?>
