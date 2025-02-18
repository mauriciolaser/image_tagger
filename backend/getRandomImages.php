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

// Parámetros de paginación:
// - page: número de página (por defecto 1)
// - limit: cantidad de imágenes a obtener (por defecto 300; en cargas posteriores se puede usar 500)
$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 300;
$offset = ($page - 1) * $limit;

// Parámetro seed para un orden determinista (si no se envía, se genera uno)
$seed = isset($_GET['seed']) ? $_GET['seed'] : time();

// Obtener imágenes aleatorias de forma determinista para evitar duplicados
$sql = "SELECT id, filename, original_name, uploaded_at 
        FROM images 
        WHERE archived = 0 
        ORDER BY MD5(CONCAT(?, id))
        LIMIT $offset, $limit";

$stmt = $conn->prepare($sql);
$stmt->bind_param("s", $seed);
$stmt->execute();
$result = $stmt->get_result();

$images = [];
$publicUrlBase = $_ENV['PUBLIC_URL_BASE'];

while ($row = $result->fetch_assoc()) {
    $row['public_url'] = rtrim($publicUrlBase, '/')
        . '/api/index.php?action=getImage&file='
        . urlencode($row['filename']);
    $images[] = $row;
}

$stmt->close();
$conn->close();

echo json_encode(["success" => true, "images" => $images, "seed" => $seed]);
?>
