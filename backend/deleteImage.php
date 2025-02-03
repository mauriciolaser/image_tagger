<?php
require __DIR__ . '/vendor/autoload.php';

// Cargar variables de entorno desde `.env`
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Permitir el acceso desde cualquier origen (para desarrollo)
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// Manejar la solicitud preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Verificar que la solicitud sea DELETE
if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Method not allowed"]);
    exit;
}

// Obtener los datos enviados (se asume JSON)
$data = json_decode(file_get_contents("php://input"), true);
if (!isset($data['image_id'])) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "image_id is required"]);
    exit;
}

$image_id = (int)$data['image_id'];

// Configuración de la conexión a la base de datos desde .env
$db_host = $_ENV['DB_HOST'];
$db_user = $_ENV['DB_USER'];
$db_pass = $_ENV['DB_PASS'];
$db_name = $_ENV['DB_NAME'];
$db_port = $_ENV['DB_PORT'] ?? 3306;

$conn = new mysqli($db_host, $db_user, $db_pass, $db_name, $db_port);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Database connection error"]);
    exit;
}

// 1. Obtener el nombre del archivo antes de eliminar el registro
$selectStmt = $conn->prepare("SELECT filename FROM images WHERE id = ?");
$selectStmt->bind_param("i", $image_id);
$selectStmt->execute();
$result = $selectStmt->get_result();

$filename = null;
if ($row = $result->fetch_assoc()) {
    $filename = $row['filename'];
}
$selectStmt->close();

// 2. Si se obtuvo el nombre del archivo, eliminarlo del sistema de archivos
if ($filename) {
    // Utiliza la ruta definida en la variable de entorno PRIVATE_IMAGES_DIR
    $privateImagesDir = rtrim($_ENV['PRIVATE_IMAGES_DIR'], '/');
    $filePath = $privateImagesDir . '/' . $filename;
    
    if (file_exists($filePath)) {
        if (!unlink($filePath)) {
            // Registra un error si no se pudo eliminar el archivo
            error_log("No se pudo eliminar el archivo: " . $filePath);
        }
    } else {
        error_log("El archivo no existe en: " . $filePath);
    }
}

// 3. Eliminar los tags asociados a la imagen de la tabla image_tags
$deleteTagsStmt = $conn->prepare("DELETE FROM image_tags WHERE image_id = ?");
$deleteTagsStmt->bind_param("i", $image_id);
$deleteTagsStmt->execute();
$deleteTagsStmt->close();

// 4. Eliminar la imagen de la tabla images
$deleteImageStmt = $conn->prepare("DELETE FROM images WHERE id = ?");
$deleteImageStmt->bind_param("i", $image_id);
if ($deleteImageStmt->execute()) {
    echo json_encode(["success" => true, "message" => "Imagen, su archivo y sus tags eliminados exitosamente."]);
} else {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Error al eliminar la imagen."]);
}
$deleteImageStmt->close();
$conn->close();
?>
