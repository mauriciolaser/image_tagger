<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

if (!isset($_GET['action']) || $_GET['action'] !== 'deleteAllImages') {
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

$conn = new mysqli(
    $_ENV['DB_HOST'],
    $_ENV['DB_USER'],
    $_ENV['DB_PASS'],
    $_ENV['DB_NAME'],
    $_ENV['DB_PORT'] ?? 3306
);

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Database connection error"]);
    exit;
}

// 📌 Directorio de imágenes privadas
$privateImagesDir = rtrim($_ENV['PRIVATE_IMAGES_DIR'], '/');

// 📌 Iniciar transacción para evitar inconsistencias
$conn->begin_transaction();

try {
    // 1️⃣ Obtener los nombres de los archivos de todas las imágenes
    $result = $conn->query("SELECT filename FROM images");
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $filename = $row['filename'];
            $filePath = $privateImagesDir . '/' . $filename;
            if (file_exists($filePath)) {
                if (!unlink($filePath)) {
                    error_log("No se pudo eliminar el archivo: " . $filePath);
                }
            } else {
                error_log("Archivo no encontrado en: " . $filePath);
            }
        }
    } else {
        throw new Exception("Error al obtener los nombres de los archivos de imágenes.");
    }

    // 2️⃣ Eliminar relaciones en image_tags
    if (!$conn->query("DELETE FROM image_tags")) {
        throw new Exception("Error al eliminar las relaciones de tags.");
    }

    // 3️⃣ Eliminar imágenes de la tabla images
    if (!$conn->query("DELETE FROM images")) {
        throw new Exception("Error al eliminar las imágenes.");
    }

    // 4️⃣ Eliminar trabajos de importación (import_jobs)
    if (!$conn->query("DELETE FROM import_jobs")) {
        throw new Exception("Error al eliminar los trabajos de importación.");
    }

    // 5️⃣ Eliminar la cola de importación (image_queue)
    if (!$conn->query("DELETE FROM image_queue")) {
        throw new Exception("Error al eliminar la cola de importación.");
    }

    // 6️⃣ Eliminar tags (si no están en uso)
    if (!$conn->query("DELETE FROM tags")) {
        throw new Exception("Error al eliminar los tags.");
    }

    // 📌 Confirmar transacción
    $conn->commit();

    echo json_encode([
        "success" => true,
        "message" => "Todas las imágenes, sus archivos, tags, trabajos de importación y la cola han sido eliminados exitosamente."
    ]);
} catch (Exception $e) {
    // 📌 Revertir cambios en caso de error
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}

// 📌 Cerrar conexión
$conn->close();
?>
