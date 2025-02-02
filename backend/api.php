<?php
// Permitir solicitudes desde el frontend de React
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// Manejo de solicitudes OPTIONS para CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Definir rutas disponibles y su archivo correspondiente
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

// Obtener la acción desde el cuerpo de la solicitud o la query
$action = $_POST['action'] ?? $_GET['action'] ?? '';

// Verificar si la acción está definida en las rutas
if (isset($routes[$action])) {
    $filePath = __DIR__ . '/' . $routes[$action];

    // Verificar que el archivo existe antes de ejecutarlo
    if (file_exists($filePath)) {
        require $filePath;
    } else {
        http_response_code(404);
        echo json_encode(["error" => "Archivo de acción no encontrado"]);
    }
} else {
    http_response_code(400);
    echo json_encode(["error" => "Acción no válida"]);
}
?>
