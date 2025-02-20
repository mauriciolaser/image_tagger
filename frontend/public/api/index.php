<?php
// Cargar Composer y PHP dotenv desde el backend
// En este caso, está bajando 3 niveles /public_html/image_tagger/api/ y luego entrando a root/image_tagger/vendor/autoload.php
require __DIR__ . '/../../../image_tagger/vendor/autoload.php';

// Cargar variables de entorno. Esto depende de la estructura del servidor Apache. 
// En este caso, está bajando 3 niveles /public_html/image_tagger/api/ y luego entrando a root/image_tagger
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../../../image_tagger');
$dotenv->load();

// Configurar CORS PRIMERO (sin salidas previas)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json"); // 🔴 Asegurar respuesta JSON

// Manejar OPTIONS inmediatamente
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Obtener ruta base del backend desde .env
$backendBasePath = $_ENV['BACKEND_BASE_PATH'] ?? __DIR__ . '/../../../image_tagger/';

// Forzar siempre el script a api.php (eliminar parámetro 'script')
$backendPath = $backendBasePath . 'api.php';

// Verificar existencia del archivo
if (!file_exists($backendPath)) {
    http_response_code(404);
    echo json_encode(["error" => "Archivo api.php no encontrado"]);
    exit;
}

// Capturar método y cuerpo de la solicitud
$method = $_SERVER['REQUEST_METHOD'];
$content = file_get_contents('php://input');

// Configurar entorno para el backend
$_SERVER['REQUEST_METHOD'] = $method;
$_SERVER['SCRIPT_FILENAME'] = $backendPath;

// Reconstruir el flujo de entrada
if (!empty($content)) {
    $stream = fopen('php://temp', 'r+');
    fwrite($stream, $content);
    rewind($stream);
    file_put_contents('php://input', stream_get_contents($stream));
    fclose($stream);
}

// 🔴 Eliminar TODOS los echos/var_dump (rompen el JSON)
require $backendPath;
?>