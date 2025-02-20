<?php
ob_start(); // Inicia el buffer de salida

// Desactivar la salida de errores para evitar que se impriman warnings o notices
error_reporting(0);
ini_set('display_errors', 0);

require __DIR__ . '/vendor/autoload.php';

// Cargar variables de entorno desde `.env`
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Permitir CORS y definir contenido JSON
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: *");
header("Access-Control-Allow-Credentials: true");

// Manejar solicitud preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Validar método POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    ob_clean(); // Limpiar cualquier salida previa
    http_response_code(405);
    echo json_encode([
        "success" => false, 
        "message" => "Method not allowed"
    ]);
    exit;
}

// Obtener y validar datos
$data = json_decode(file_get_contents("php://input"), true);
if (!isset($data['image_id'], $data['tag_id'], $data['user_id'])) {
    ob_clean();
    http_response_code(400);
    echo json_encode([
        "success" => false, 
        "message" => "Parámetros incompletos"
    ]);
    exit;
}

$image_id = (int)$data['image_id'];
$tag_id   = (int)$data['tag_id'];
$user_id  = (int)$data['user_id'];

// Conexión a la base de datos usando variables de entorno
$db_host = $_ENV['DB_HOST'];
$db_user = $_ENV['DB_USER'];
$db_pass = $_ENV['DB_PASS'];
$db_name = $_ENV['DB_NAME'];
$db_port = $_ENV['DB_PORT'] ?? 3306;

$conn = new mysqli($db_host, $db_user, $db_pass, $db_name, $db_port);
if ($conn->connect_error) {
    ob_clean();
    http_response_code(500);
    echo json_encode([
        "success" => false, 
        "message" => "Error de conexión a la base de datos"
    ]);
    exit;
}

// Iniciar transacción para operaciones atómicas
$conn->begin_transaction();

try {
// 1. Eliminar de image_tags (permitiendo que cualquier usuario borre el tag)
$stmt = $conn->prepare("DELETE FROM image_tags WHERE image_id = ? AND tag_id = ?");
$stmt->bind_param("ii", $image_id, $tag_id);
$stmt->execute();
    
    if ($stmt->affected_rows === 0) {
        throw new Exception("No se encontró el tag asignado");
    }

    // 2. Eliminar el tag de la tabla tags si ya no está en uso
    $stmt = $conn->prepare("DELETE FROM tags WHERE id = ? AND NOT EXISTS (SELECT 1 FROM image_tags WHERE tag_id = ?)");
    $stmt->bind_param("ii", $tag_id, $tag_id);
    $stmt->execute();

    $conn->commit();
    ob_clean(); // Limpiar el buffer antes de enviar la respuesta
    echo json_encode([
        "success" => true, 
        "message" => "Tag eliminado exitosamente"
    ]);
} catch (Exception $e) {
    $conn->rollback();
    ob_clean();
    http_response_code($e->getMessage() === "No se encontró el tag asignado" ? 404 : 500);
    echo json_encode([
        "success" => false, 
        "message" => $e->getMessage()
    ]);
} finally {
    if (isset($stmt)) {
        $stmt->close();
    }
    $conn->close();
    ob_end_flush();
}
?>
