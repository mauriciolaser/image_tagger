<?php
// Cargar Composer y PHP dotenv desde el backend
require __DIR__ . '/../../../image_tagger/vendor/autoload.php';

// Cargar variables de entorno desde el archivo .env del backend
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../../../image_tagger');
$dotenv->load(); // Cargar el archivo .env

// Obtener la ruta base del backend desde el archivo .env
$backendBasePath = $_ENV['BACKEND_BASE_PATH'] ?? __DIR__ . '/../../../image_tagger/';

// Permitir solicitudes desde el frontend (CORS)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// Manejar solicitudes OPTIONS (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Obtener el parámetro 'script' para determinar qué archivo del backend ejecutar (por defecto, api.php)
$script = $_GET['script'] ?? 'api.php';

// **Calcular la ruta al archivo del backend desde el directorio base**
$backendPath = $backendBasePath . $script;

// Mostrar la ruta calculada para depuración
echo "Ruta calculada: " . $backendPath; // Esto debe mostrar la ruta completa

// Verificar si el archivo existe
if (!file_exists($backendPath)) {
    http_response_code(404);
    header("Content-Type: application/json");
    echo json_encode(["error" => "Archivo no encontrado: $script"]);
    exit;
}

// Incluir el archivo del backend (se ejecutará internamente sin exponer su ubicación real)
require $backendPath;

?>
