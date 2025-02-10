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

// Validar y obtener parámetros de la solicitud
$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$imagesPerPage = 20;

if ($page < 1) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Invalid page number"]);
    exit;
}

$offset = ($page - 1) * $imagesPerPage;

// Consulta SQL para obtener imágenes que no estén archivadas
$sql = "SELECT id, filename, original_name, uploaded_at 
        FROM images 
        WHERE archived = 0 
        ORDER BY uploaded_at DESC 
        LIMIT ?, ?";
$stmt = $conn->prepare($sql);
$stmt->bind_param("ii", $offset, $imagesPerPage);
$stmt->execute();
$result = $stmt->get_result();

$images = [];

// Definir la URL pública base para servir imágenes
$publicUrlBase = $_ENV['PUBLIC_URL_BASE'];

while ($row = $result->fetch_assoc()) {
    $row['public_url'] = $publicUrlBase . "getImage.php?file=" . urlencode($row['filename']);
    $images[] = $row;
}

$stmt->close();
$conn->close();

echo json_encode(["success" => true, "images" => $images]);
?>
