<?php
require __DIR__ . '/vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Usamos BACKEND_BASE_PATH para la ubicación de logs
$backendBasePath = rtrim($_ENV['BACKEND_BASE_PATH'], '/') . '/';
$log_file = $backendBasePath . 'logs/debug.log';

// Prueba simple de escritura usando file_put_contents
file_put_contents($log_file, date('[Y-m-d H:i:s] ') . "Prueba de file_put_contents\n", FILE_APPEND);

// Función de depuración personalizada usando BACKEND_BASE_PATH del .env
function my_log($message) {
    $backendBasePath = rtrim($_ENV['BACKEND_BASE_PATH'], '/') . '/';
    $log_file = $backendBasePath . 'logs/debug.log';
    error_log(date('[Y-m-d H:i:s] ') . $message . PHP_EOL, 3, $log_file);
}

// 1. Validar parámetro "file"
$filename = $_GET['file'] ?? '';
if (empty($filename)) {
    http_response_code(400);
    my_log("Parámetro 'file' requerido");
    die("Parámetro 'file' requerido");
}

// 2. Sanitizar el nombre del archivo
$filename = basename($filename);

// 3. Ruta privada de las imágenes (según PRIVATE_IMAGES_DIR)
$privateImagesDir = $_ENV['PRIVATE_IMAGES_DIR']; // Ej: /home/vallhzty/image_tagger/uploads
$realPrivateDir = realpath($privateImagesDir);
$filePath = realpath($privateImagesDir . DIRECTORY_SEPARATOR . $filename);

// 4. Normalizar la ruta del directorio (elimina la barra final)
$normalizedPrivateDir = rtrim($realPrivateDir, '/');
my_log("Normalized PRIVATE_IMAGES_DIR: " . $normalizedPrivateDir);

// 5. Verificar existencia y permisos del archivo
if (!$filePath || !is_file($filePath)) {
    http_response_code(404);
    my_log("Imagen no encontrada: filePath no existe o no es un archivo.");
    die("Imagen no encontrada");
}

// 6. Enviar la imagen con headers correctos
$mime = mime_content_type($filePath);
my_log("Tipo MIME detectado: " . $mime);

header("Access-Control-Allow-Origin: *");
header("Content-Type: " . $mime);
header("Content-Length: " . filesize($filePath));
header("Cache-Control: public, max-age=604800");

readfile($filePath);
exit;
?>
