<?php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Depurar rutas desde .env
error_log("BACKEND_BASE_PATH: " . $_ENV['BACKEND_BASE_PATH']);
error_log("PRIVATE_IMAGES_DIR: " . $_ENV['PRIVATE_IMAGES_DIR']);
error_log("PROFILE_PICS_DIR: " . $_ENV['PROFILE_PICS_DIR']);

// Detectar entorno automáticamente
$env = getenv('APP_ENV') ?: 'development';

// Definir la ruta correcta de `vendor/autoload.php`
// En este caso, está bajando 1 nivel, pero en producción suele bajar 3 niveles /public_html/image_tagger/api/ y luego entrando a root/image_tagger/vendor/autoload.php
require __DIR__ . '/../vendor/autoload.php';
$dotenvPath = __DIR__;

// Cargar variables de entorno
$dotenv = Dotenv\Dotenv::createImmutable($dotenvPath);
$dotenv->load();

// Configurar CORS PRIMERO (sin salidas previas)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS, DELETE, PUT");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json"); // 🔴 Asegurar respuesta JSON

// Manejar OPTIONS inmediatamente (pre-flight request de CORS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 🔹 Asegurar que `$backendBasePath` apunte a `image_tagger/`
$backendBasePath = realpath(__DIR__ . '/../') . '/';

// 🔹 Ruta correcta de `api.php`
$backendPath = $backendBasePath . 'api.php';

// Verificar existencia del archivo
if (!file_exists($backendPath)) {
    http_response_code(404);
    echo json_encode(["error" => "Archivo api.php no encontrado en $backendPath"]);
    exit;
}

// 🔹 Depuración: Verificar si se están recibiendo los datos correctamente
file_put_contents(__DIR__ . "/debug.log", json_encode([
    "headers" => getallheaders(),
    "post_data" => file_get_contents("php://input"),
    "server" => $_SERVER
], JSON_PRETTY_PRINT), FILE_APPEND);

// Capturar método y cuerpo de la solicitud
$method = $_SERVER['REQUEST_METHOD'];
$content = file_get_contents('php://input');

// 🔹 Evitar error si `CONTENT_TYPE` no está definido
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';

// 🔹 Asegurar que la API reciba los datos correctamente
if (strpos($contentType, 'application/json') !== false) {
    $_POST = json_decode($content, true);
}

// Configurar entorno para el backend
$_SERVER['REQUEST_METHOD'] = $method;
$_SERVER['SCRIPT_FILENAME'] = $backendPath;

// 🔴 Eliminar TODOS los echos/var_dump (rompen el JSON)
require $backendPath;
