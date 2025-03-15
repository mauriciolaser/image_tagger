<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/import_errors.log');
error_reporting(E_ALL);

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
$files = array_diff(scandir($sourceDir), ['.', '..']);

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
    if (!$job_id) {
        throw new Exception("Error: No se pudo obtener `job_id` después de insertar.");
    }

    // Insertar imágenes en la cola de importación (tabla import_image_queue)
    $insertStmt = $conn->prepare("INSERT INTO import_image_queue (job_id, filename, status) VALUES (?, ?, 'pending')");
    if (!$insertStmt) {
        throw new Exception("Error preparando consulta import_image_queue: " . $conn->error);
    }
    $insertedCount = 0;
    foreach ($files as $file) {
        $filePath = $sourceDir . '/' . $file;
        if (!is_file($filePath)) {
            continue;
        }
        $extension = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        if (!in_array($extension, $allowedExtensions)) {
            continue;
        }
        $checkStmt = $conn->prepare("SELECT COUNT(*) FROM import_image_queue WHERE filename = ?");
        $checkStmt->bind_param("s", $file);
        $checkStmt->execute();
        $checkStmt->bind_result($count);
        $checkStmt->fetch();
        $checkStmt->close();
        if ($count > 0) {
            continue;
        }
        $insertStmt->bind_param("is", $job_id, $file);
        if ($insertStmt->execute()) {
            $insertedCount++;
        }
    }
    $insertStmt->close();

    if ($insertedCount === 0) {
        $conn->query("UPDATE import_jobs SET status = 'completed' WHERE id = $job_id");
        throw new Exception("Todas las imágenes ya estaban en la cola o no había imágenes válidas.");
    }
    $conn->commit();
} catch (Exception $e) {
    $conn->rollback();
    error_log("Error en `startImport.php`: " . $e->getMessage());
    http_response_code(500);
    exit(json_encode(["success" => false, "message" => $e->getMessage()]));
}

// Verificar si el archivo `process_import_queue.php` existe antes de ejecutarlo
$processScript = __DIR__ . "/process_import_queue.php";
if (!file_exists($processScript)) {
    http_response_code(500);
    exit(json_encode(["success" => false, "message" => "Archivo `process_import_queue.php` no encontrado"]));
}

// Determinar el ejecutable de PHP según el sistema y capturar el PID en Linux
if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
    $phpExecutable = 'C:\xampp\php\php.exe';
    $cmd = "start /B $phpExecutable $processScript $job_id > NUL 2>&1";
} else {
    // Usar el PHP 8.1 del sistema ubicado en /usr/local/bin/php
    $phpExecutable = '/usr/local/bin/php';
    // Se añade "echo $!" para capturar el PID del proceso en segundo plano
    $cmd = "$phpExecutable $processScript $job_id > /dev/null 2>&1 & echo \$!";
}

exec($cmd, $output, $return_var);
error_log("CMD executed: " . $cmd);
error_log("Output: " . print_r($output, true));
error_log("Return var: " . $return_var);

if ($return_var !== 0) {
    http_response_code(500);
    exit(json_encode(["success" => false, "message" => "Error al ejecutar el proceso en segundo plano"]));
}

// En Linux, capturamos y guardamos el PID en un archivo .pid
if (strtoupper(substr(PHP_OS, 0, 3)) !== 'WIN' && !empty($output[0])) {
    $pid = trim($output[0]);
    // Suponiendo que la ruta para guardar los PIDs esté definida en una variable de entorno o similar.
    // Si no está definida, se puede definir aquí directamente.
    $pidDir = __DIR__ . '/pids';
    if (!is_dir($pidDir)) {
        mkdir($pidDir, 0777, true);
    }
    $pidFile = $pidDir . '/import_' . $job_id . '.pid';
    file_put_contents($pidFile, $pid);
    error_log("Proceso en segundo plano iniciado con PID: " . $pid);
}

http_response_code(200);
exit(json_encode(["success" => true, "job_id" => $job_id, "added_images" => $insertedCount]));
?>
