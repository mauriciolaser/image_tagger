<?php
// Configurar headers PRIMERO
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

// Manejar OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Leer datos según el tipo de contenido
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
$isJson = strpos($contentType, 'application/json') !== false;
$isMultipart = strpos($contentType, 'multipart/form-data') !== false;

// Obtener acción desde JSON, POST o GET
$action = '';
if ($isJson) {
    $rawData = file_get_contents('php://input');
    $data = json_decode($rawData, true);
    $action = $data['action'] ?? '';
} else {
    $isMultipart = strpos($contentType, 'multipart/form-data') !== false;
    $action = $isMultipart ? ($_POST['action'] ?? '') : ($data['action'] ?? $_GET['action'] ?? '');
}

// Definir rutas
$routes = [
    'auth' => 'auth.php',
    'upload' => 'upload.php',
    'admin' => 'admin.php',
    'deleteImage' => 'deleteImage.php',
    'deleteAllImages' => 'deleteAllImages.php',
    'deleteTag' => 'deleteTag.php',
    'exportImages' => 'exportImages.php',
    'getImages' => 'getImages.php',
    'getImageTags' => 'getImageTags.php',
    'getUserId' => 'getUserId.php',
    'tagImage' => 'tagImage.php'
];

// Validar acción
if (isset($routes[$action])) {
    $filePath = __DIR__ . '/' . $routes[$action];
    
    if (file_exists($filePath)) {
        require $filePath;
    } else {
        http_response_code(404);
        echo json_encode(["error" => "Archivo no encontrado"]);
    }
} else {
    http_response_code(400);
    echo json_encode(["error" => "Acción no válida"]);
}
?>