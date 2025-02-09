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

// Obtener parámetros de la solicitud
$user_id = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;
$image_id = isset($_GET['image_id']) ? (int)$_GET['image_id'] : 0; // Parámetro opcional para filtrar por imagen
$imagesPerPage = 20;

if ($user_id < 1) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Invalid parameters"]);
    exit;
}

if ($image_id === 0) {
    // Consulta paginada para todas las imágenes del usuario
    $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
    if ($page < 1) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Invalid page number"]);
        exit;
    }
    $offset = ($page - 1) * $imagesPerPage;
    
    $sql = "SELECT 
                i.id, 
                i.filename, 
                i.original_name, 
                i.uploaded_at,
                IFNULL(GROUP_CONCAT(DISTINCT CONCAT(t.id, ':', t.name) ORDER BY t.name SEPARATOR ', '), '') AS tags
            FROM images i
            LEFT JOIN image_tags it ON i.id = it.image_id AND it.user_id = ? 
            LEFT JOIN tags t ON it.tag_id = t.id
            GROUP BY i.id 
            ORDER BY i.uploaded_at DESC 
            LIMIT ?, ?";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("iii", $user_id, $offset, $imagesPerPage);
} else {
    // Consulta para una imagen específica (sin paginación)
    $sql = "SELECT 
                i.id, 
                i.filename, 
                i.original_name, 
                i.uploaded_at,
                IFNULL(GROUP_CONCAT(DISTINCT CONCAT(t.id, ':', t.name) ORDER BY t.name SEPARATOR ', '), '') AS tags
            FROM images i
            LEFT JOIN image_tags it ON i.id = it.image_id AND it.user_id = ? 
            LEFT JOIN tags t ON it.tag_id = t.id
            WHERE i.id = ?
            GROUP BY i.id 
            ORDER BY i.uploaded_at DESC";
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ii", $user_id, $image_id);
}

$stmt->execute();
$result = $stmt->get_result();

$images = [];
$publicUrlBase = $_ENV['PUBLIC_URL_BASE'];

while ($row = $result->fetch_assoc()) {
    // Procesar los tags en un arreglo
    $tags = [];
    if (!empty($row["tags"])) {
        $tagPairs = explode(", ", $row["tags"]);
        foreach ($tagPairs as $pair) {
            $parts = explode(":", $pair, 2);
            if (count($parts) === 2) {
                $tags[] = ["id" => (int)$parts[0], "name" => $parts[1]];
            }
        }
    }
    
    $row['public_url'] = $publicUrlBase . "getImage.php?file=" . urlencode($row['filename']);
    $row['tags'] = $tags;
    if (isset($row['path'])) {
        unset($row['path']);
    }
    $images[] = $row;
}

$stmt->close();
$conn->close();

echo json_encode(["success" => true, "images" => $images]);
?>
