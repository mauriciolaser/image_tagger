<?php
require __DIR__ . '/vendor/autoload.php';

// Cargar variables de entorno desde .env
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

// Configuración de conexión a la base de datos desde .env
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

// Leer los datos JSON enviados
$data = json_decode(file_get_contents("php://input"), true);
$image_id = isset($data['image_id']) ? (int)$data['image_id'] : null;
$new_archived = isset($data['archived']) ? (int)$data['archived'] : 1;

if (!$image_id) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "No se especificó image_id"]);
    exit;
}

// Actualizar el campo archived = 0 o 1
$stmt = $conn->prepare("UPDATE images SET archived = ? WHERE id = ?");
$stmt->bind_param("ii", $new_archived, $image_id);

if ($stmt->execute()) {
    if ($new_archived === 1) {
        echo json_encode(["success" => true, "message" => "Imagen archivada exitosamente"]);
    } else {
        echo json_encode(["success" => true, "message" => "Imagen restaurada exitosamente"]);
    }
} else {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Error al cambiar el estado de la imagen"]);
}

$stmt->close();
$conn->close();
