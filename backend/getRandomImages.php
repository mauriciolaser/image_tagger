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

// Parámetros de paginación: page y limit
$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 500;
$offset = ($page - 1) * $limit;

// Parámetro seed para un orden determinista (si no se envía, se genera uno)
$seed = isset($_GET['seed']) ? $_GET['seed'] : time();

// Parámetro city, por defecto "barcelona"
$city = isset($_GET['city']) ? $_GET['city'] : 'barcelona';

// Obtener imágenes de forma determinista y filtrando por city
$sql = "SELECT id, filename, original_name, uploaded_at 
        FROM images 
        WHERE archived = 0 AND city = ?
        ORDER BY MD5(CONCAT(?, id))
        LIMIT ?, ?";

$stmt = $conn->prepare($sql);
$stmt->bind_param("ssii", $city, $seed, $offset, $limit);
$stmt->execute();
$result = $stmt->get_result();

$images = [];
$publicUrlBase = rtrim($_ENV['PUBLIC_URL_BASE'], '/');

while ($row = $result->fetch_assoc()) {
    $row['public_url'] = $publicUrlBase . '/api/index.php?action=getImage&file=' . urlencode($row['filename']);
    $images[] = $row;
}

$stmt->close();
$conn->close();

echo json_encode(["success" => true, "images" => $images, "seed" => $seed]);
?>
