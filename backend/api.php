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

// 🆕 Capturar action desde query string (para métodos como DELETE)
$queryString = parse_url($_SERVER['REQUEST_URI'], PHP_URL_QUERY);
parse_str($queryString, $queryParams);
$action = $queryParams['action'] ?? '';

// Leer datos según el tipo de contenido
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
$isJson = strpos($contentType, 'application/json') !== false;
$isMultipart = strpos($contentType, 'multipart/form-data') !== false;

// Obtener acción desde JSON o POST (si no se obtuvo de la query string)
if ($isJson && empty($action)) {
    $rawData = file_get_contents('php://input');
    $data = json_decode($rawData, true);
    $action = $data['action'] ?? '';
} elseif ($isMultipart && empty($action)) {
    $action = $_POST['action'] ?? '';
}

// Definir rutas
$routes = [
    'auth'           => 'auth.php',
    'upload'         => 'upload.php',
    'admin'          => 'admin.php',
    'deleteImage'    => 'deleteImage.php',
    'deleteAllImages'=> 'deleteAllImages.php',
    'deleteTag'      => 'deleteTag.php',
    'exportImages'   => 'exportImages.php',
    'getImage'       => 'getImage.php',
    'getImages'      => 'getImages.php',
    'getImageTags'   => 'getImageTags.php',
    'getUserId'      => 'getUserId.php',
    'tagImage'       => 'tagImage.php'
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