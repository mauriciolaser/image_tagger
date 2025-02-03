<?php
require __DIR__ . '/vendor/autoload.php';

// Cargar variables de entorno desde `.env`
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Encabezados CORS y configuración de contenido
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// Manejar la solicitud preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Asegurar que la solicitud sea POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Method not allowed"]);
    exit;
}

// Obtener los datos enviados (se asume JSON)
$data = json_decode(file_get_contents("php://input"), true);

if (!isset($data['image_id'], $data['tag'], $data['user_id'])) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Parámetros incompletos"]);
    exit;
}

$image_id = (int)$data['image_id'];
$tag_text = trim($data['tag']);
$user_id = (int)$data['user_id'];

if (empty($tag_text)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "El tag no puede estar vacío"]);
    exit;
}

// Configuración de la conexión a la base de datos desde .env
$db_host = $_ENV['DB_HOST'];
$db_user = $_ENV['DB_USER'];
$db_pass = $_ENV['DB_PASS'];
$db_name = $_ENV['DB_NAME'];
$db_port = $_ENV['DB_PORT'] ?? 3306;

$conn = new mysqli($db_host, $db_user, $db_pass, $db_name, $db_port);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Error de conexión a la base de datos"]);
    exit;
}

// 1️⃣ Verificar si el usuario existe en la tabla "users"
$userStmt = $conn->prepare("SELECT id FROM users WHERE id = ?");
$userStmt->bind_param("i", $user_id);
$userStmt->execute();
$userResult = $userStmt->get_result();

if ($userResult->num_rows === 0) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "El usuario no existe."]);
    exit;
}
$userStmt->close();

// 2️⃣ Verificar si el tag YA EXISTE para ESTE usuario en la tabla "tags"
$tag_id = null;
$tagStmt = $conn->prepare("SELECT id FROM tags WHERE name = ? AND created_by = ?");
$tagStmt->bind_param("si", $tag_text, $user_id);
$tagStmt->execute();
$tagResult = $tagStmt->get_result();

if ($tagResult->num_rows > 0) {
    $row = $tagResult->fetch_assoc();
    $tag_id = $row['id'];
} else {
    // 3️⃣ Si el tag no existe para este usuario, insertarlo
    $insertTagStmt = $conn->prepare("INSERT INTO tags (name, created_by) VALUES (?, ?)");
    $insertTagStmt->bind_param("si", $tag_text, $user_id);
    
    if ($insertTagStmt->execute()) {
        $tag_id = $conn->insert_id;
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Error al insertar el tag"]);
        exit;
    }
    $insertTagStmt->close();
}
$tagStmt->close();

if (!$tag_id) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Error al determinar el tag"]);
    exit;
}

// 4️⃣ Verificar si la relación ya existe en "image_tags" para este usuario
$checkRelationStmt = $conn->prepare("SELECT * FROM image_tags WHERE image_id = ? AND tag_id = ? AND user_id = ?");
$checkRelationStmt->bind_param("iii", $image_id, $tag_id, $user_id);
$checkRelationStmt->execute();
$relationResult = $checkRelationStmt->get_result();

if ($relationResult->num_rows > 0) {
    echo json_encode(["success" => false, "message" => "Este tag ya está asignado a esta imagen por este usuario."]);
    exit;
}
$checkRelationStmt->close();

// 5️⃣ Insertar la relación en "image_tags"
$insertStmt = $conn->prepare("INSERT INTO image_tags (image_id, tag_id, user_id, tagged_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP())");
$insertStmt->bind_param("iii", $image_id, $tag_id, $user_id);

if ($insertStmt->execute()) {
    echo json_encode(["success" => true, "message" => "Tag agregado exitosamente"]);
} else {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Error al asignar el tag a la imagen"]);
}

$insertStmt->close();
$conn->close();
?>
