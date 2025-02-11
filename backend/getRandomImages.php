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

// Obtener 100 imágenes aleatorias
$sql = "SELECT id, filename, original_name, uploaded_at 
        FROM images 
        WHERE archived = 0 
        ORDER BY RAND() 
        LIMIT 300";

$result = $conn->query($sql);
$images = [];
$publicUrlBase = $_ENV['PUBLIC_URL_BASE'];

while ($row = $result->fetch_assoc()) {

    $row['public_url'] = rtrim($publicUrlBase, '/')
        . '/api/index.php?action=getImage&file='
        . urlencode($row['filename']);

    $images[] = $row;
}

$conn->close();

echo json_encode(["success" => true, "images" => $images]);
?>
