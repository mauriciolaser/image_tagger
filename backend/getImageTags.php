<?php
require __DIR__ . '/vendor/autoload.php';

// Cargar variables de entorno desde `.env`
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
$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$imagesPerPage = 20;
$user_id = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;

if ($page < 1 || $user_id < 1) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Invalid parameters"]);
    exit;
}

$offset = ($page - 1) * $imagesPerPage;

// Consulta SQL para obtener imágenes y sus tags (solo del usuario)
$sql = "SELECT 
            i.id, 
            i.filename, 
            i.original_name, 
            i.path, 
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
$stmt->execute();
$result = $stmt->get_result();

$images = [];
while ($row = $result->fetch_assoc()) {

    $tags = [];
    if (!empty($row["tags"])) {
        $tagPairs = explode(", ", $row["tags"]);
        foreach ($tagPairs as $pair) {
            $parts = explode(":", $pair, 2);
            if (count($parts) === 2) { // ✅ Asegurar que hay un ID y un nombre
                $tags[] = ["id" => (int)$parts[0], "name" => $parts[1]];
            }
        }
    }
    
    $images[] = [
        "id" => $row["id"],
        "filename" => $row["filename"],
        "original_name" => $row["original_name"],
        "path" => $row["path"],
        "uploaded_at" => $row["uploaded_at"],
        "tags" => $tags
    ];
}

$stmt->close();
$conn->close();

echo json_encode(["success" => true, "images" => $images]);
?>
