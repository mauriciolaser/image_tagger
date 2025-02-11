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

$publicUrlBase = $_ENV['PUBLIC_URL_BASE'];

$excludeIdsParam = isset($_GET['exclude_ids']) ? $_GET['exclude_ids'] : '';
$excludeIdsArray = [];

if (!empty($excludeIdsParam)) {
    $excludeIdsArray = array_map('intval', explode(',', $excludeIdsParam));
}

if (!empty($excludeIdsArray)) {
    $placeholders = implode(',', array_fill(0, count($excludeIdsArray), '?'));
    $sql = "SELECT id, filename, original_name, uploaded_at
            FROM images
            WHERE archived = 0
              AND id NOT IN ($placeholders)
            ORDER BY RAND()
            LIMIT 100";
    
    $stmt = $conn->prepare($sql);
    $types = str_repeat('i', count($excludeIdsArray));
    $stmt->bind_param($types, ...$excludeIdsArray);
    $stmt->execute();
    $result = $stmt->get_result();
    $stmt->close();
} else {
    $sql = "SELECT id, filename, original_name, uploaded_at
            FROM images
            WHERE archived = 0
            ORDER BY RAND()
            LIMIT 100";
    $result = $conn->query($sql);
}

$images = [];
while ($row = $result->fetch_assoc()) {
    $row['public_url'] = $publicUrlBase . "getImage.php?file=" . urlencode($row['filename']);
    $images[] = $row;
}

$conn->close();

// Podemos enviar en la respuesta cuántas imágenes obtuvimos.
echo json_encode([
    "success" => true, 
    "count" => count($images), 
    "images" => $images
]);
