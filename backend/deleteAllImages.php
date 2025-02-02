<?php
require __DIR__ . '/vendor/autoload.php';

// Cargar variables de entorno desde `.env`
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Encabezados CORS y configuración de contenido
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

// Iniciar transacción para evitar inconsistencias
$conn->begin_transaction();

try {
    // 1. Eliminar todas las relaciones en image_tags
    $deleteImageTagsQuery = "DELETE FROM image_tags";
    if (!$conn->query($deleteImageTagsQuery)) {
        throw new Exception("Error al eliminar las relaciones de tags.");
    }

    // 2. Eliminar todas las imágenes de la tabla images
    $deleteImagesQuery = "DELETE FROM images";
    if (!$conn->query($deleteImagesQuery)) {
        throw new Exception("Error al eliminar las imágenes.");
    }

    // 3. Eliminar todos los tags de la tabla tags (solo si ya no están en image_tags)
    $deleteTagsQuery = "DELETE FROM tags";
    if (!$conn->query($deleteTagsQuery)) {
        throw new Exception("Error al eliminar los tags.");
    }

    // Confirmar transacción
    $conn->commit();
    
    echo json_encode(["success" => true, "message" => "Todas las imágenes, sus tags y las relaciones han sido eliminadas exitosamente."]);
} catch (Exception $e) {
    // Revertir cambios en caso de error
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}

// Cerrar conexión
$conn->close();
?>
