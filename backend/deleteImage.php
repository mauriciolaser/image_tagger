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

// Eliminar los tags asociados a la imagen de la tabla image_tags
$deleteTagsStmt = $conn->prepare("DELETE FROM image_tags WHERE image_id = ?");
$deleteTagsStmt->bind_param("i", $image_id);
$deleteTagsStmt->execute();
$deleteTagsStmt->close();

// Eliminar la imagen de la tabla images
$deleteImageStmt = $conn->prepare("DELETE FROM images WHERE id = ?");
$deleteImageStmt->bind_param("i", $image_id);
if ($deleteImageStmt->execute()) {
    echo json_encode(["success" => true, "message" => "Imagen y sus tags eliminados exitosamente."]);
} else {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Error al eliminar la imagen."]);
}
$deleteImageStmt->close();
$conn->close();
?>
