<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
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

// Si hay error de conexión, mostrarlo
if ($conn->connect_error) {
    http_response_code(500);
    exit(json_encode(["success" => false, "message" => "Error de conexión a BD: " . $conn->connect_error]));
}

// Validar el user_id
$user_id = filter_input(INPUT_GET, 'user_id', FILTER_VALIDATE_INT);
if (!$user_id) {
    http_response_code(400);
    exit(json_encode(["success" => false, "message" => "ID de usuario inválido"]));
}

// 📌 Verificar que el directorio de imágenes existe
$sourceDir = $_ENV['PRIVATE_IMAGES_DIR'] ?? null;
if (!$sourceDir || !is_dir($sourceDir)) {
    http_response_code(500);
    exit(json_encode(["success" => false, "message" => "El directorio de imágenes no existe: $sourceDir"]));
}

// 📌 Definir extensiones de imagen permitidas
$allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];

// 📌 Escanear archivos en el directorio de imágenes
$files = scandir($sourceDir);
if (!$files || count($files) <= 2) { // Solo "." y ".." → No hay imágenes
    http_response_code(400);
    exit(json_encode(["success" => false, "message" => "No hay imágenes para importar."]));
}

// 📌 Insertar imágenes en `image_queue`
$insertStmt = $conn->prepare("INSERT INTO image_queue (filename, status) VALUES (?, 'pending')");
if (!$insertStmt) {
    http_response_code(500);
    exit(json_encode(["success" => false, "message" => "Error preparando consulta image_queue: " . $conn->error]));
}

$insertedCount = 0;
foreach ($files as $file) {
    if ($file === '.' || $file === '..') {
        continue;
    }

    $filePath = $sourceDir . '/' . $file;
    if (!is_file($filePath)) {
        continue; // Evita procesar carpetas
    }

    // 📌 Verificar la extensión del archivo
    $extension = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    if (!in_array($extension, $allowedExtensions)) {
        continue; // Ignorar archivos no permitidos (Ejemplo: .htaccess, .txt, etc.)
    }

    // 📌 Evitar duplicados (si ya está en `image_queue`, no agregarlo)
    $checkStmt = $conn->prepare("SELECT COUNT(*) FROM image_queue WHERE filename = ?");
    $checkStmt->bind_param("s", $file);
    $checkStmt->execute();
    $checkStmt->bind_result($count);
    $checkStmt->fetch();
    $checkStmt->close();

    if ($count > 0) {
        continue; // Ya está en la cola, no lo agregamos de nuevo
    }

    $insertStmt->bind_param("s", $file);
    if ($insertStmt->execute()) {
        $insertedCount++;
    }
}
$insertStmt->close();

// 📌 Si no se insertó ninguna imagen, cancelar el job
if ($insertedCount === 0) {
    $conn->query("UPDATE import_jobs SET status = 'completed' WHERE id = $job_id");
    http_response_code(400);
    exit(json_encode(["success" => false, "message" => "Todas las imágenes ya estaban en la cola o no había imágenes válidas."]));
}

// 📌 Verificar si el archivo `process_queue.php` existe antes de ejecutarlo
$processScript = __DIR__ . "/process_queue.php";
if (!file_exists($processScript)) {
    http_response_code(500);
    exit(json_encode(["success" => false, "message" => "Archivo process_queue.php no encontrado"]));
}

// 📌 Ejecutar el proceso en segundo plano
exec("php $processScript $job_id > /dev/null 2>&1 &", $output, $return_var);

if ($return_var !== 0) {
    http_response_code(500);
    exit(json_encode(["success" => false, "message" => "Error al ejecutar el proceso en segundo plano"]));
}

// 📌 Responder con éxito
http_response_code(200);
exit(json_encode(["success" => true, "job_id" => $job_id, "added_images" => $insertedCount]));
?>
