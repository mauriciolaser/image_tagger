<?php
require __DIR__ . '/vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

// Datos de conexión
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

// Consideramos imágenes no archivadas (archived = 0)
$sqlTotal = "SELECT COUNT(*) as total FROM images WHERE archived = 0";
$resultTotal = $conn->query($sqlTotal);
$rowTotal = $resultTotal->fetch_assoc();
$total = (int)$rowTotal['total'];

// Imágenes que tienen al menos un tag (evitamos duplicados con DISTINCT)
$sqlWithTags = "SELECT COUNT(DISTINCT i.id) as with_tags
    FROM images i
    INNER JOIN image_tags it ON i.id = it.image_id
    WHERE i.archived = 0";
$resultWithTags = $conn->query($sqlWithTags);
$rowWithTags = $resultWithTags->fetch_assoc();
$with_tags = (int)$rowWithTags['with_tags'];

// Imágenes sin tags = total - con tags
$without_tags = $total - $with_tags;

$conn->close();

echo json_encode([
    "success" => true,
    "total" => $total,
    "with_tags" => $with_tags,
    "without_tags" => $without_tags
]);
?>
