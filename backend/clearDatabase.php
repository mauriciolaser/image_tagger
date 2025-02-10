<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Validar que la acción solicitada sea clearDatabase
if (!isset($_GET['action']) || $_GET['action'] !== 'clearDatabase') {
    http_response_code(400);
    die(json_encode(["success" => false, "message" => "Acción inválida"]));
}

require __DIR__ . '/vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Method not allowed"]);
    exit;
}

// Conectar a la base de datos usando mysqli y variables de entorno
$conn = new mysqli(
    $_ENV['DB_HOST'],
    $_ENV['DB_USER'],
    $_ENV['DB_PASS'],
    $_ENV['DB_NAME'],
    $_ENV['DB_PORT'] ?? 3306
);

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Error de conexión a la base de datos"]);
    exit;
}

// Iniciar transacción para evitar inconsistencias
$conn->begin_transaction();

try {
    // 1️⃣ Eliminar relaciones en image_tags
    if (!$conn->query("DELETE FROM image_tags")) {
        throw new Exception("Error al eliminar las relaciones de tags.");
    }

    // 2️⃣ Eliminar registros de imágenes (sin borrar los archivos físicos)
    if (!$conn->query("DELETE FROM images")) {
        throw new Exception("Error al eliminar las imágenes.");
    }

    // 3️⃣ Eliminar tags
    if (!$conn->query("DELETE FROM tags")) {
        throw new Exception("Error al eliminar los tags.");
    }

    // Confirmar transacción
    $conn->commit();

    echo json_encode([
        "success" => true,
        "message" => "Se han borrado los registros de imágenes, tags y relaciones de tags. Recuerda que tendrás que importar nuevamente las imágenes."
    ]);
} catch (Exception $e) {
    // Revertir cambios en caso de error
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}

// Cerrar conexión
$conn->close();
?>
