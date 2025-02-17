<?php
require __DIR__ . '/vendor/autoload.php';

// Cargar variables de entorno desde `.env`
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Permitir acceso desde cualquier dominio (CORS)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

// Manejar solicitud OPTIONS (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Configuración de la base de datos desde .env
$db_host = $_ENV['DB_HOST'];
$db_user = $_ENV['DB_USER'];
$db_pass = $_ENV['DB_PASS'];
$db_name = $_ENV['DB_NAME'];
$db_port = $_ENV['DB_PORT'] ?? 3306;

// Conectar a la base de datos
$conn = new mysqli($db_host, $db_user, $db_pass, $db_name, $db_port);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Error de conexión a la base de datos: " . $conn->connect_error
    ]);
    exit;
}

// Establecer la codificación de caracteres
$conn->set_charset("utf8mb4");

// Leer el contenido JSON, si existe, y determinar la acción
$input = json_decode(file_get_contents("php://input"), true);
$action = $input['action'] ?? $_REQUEST['action'] ?? '';

switch ($action) {

    case 'getComments':
        // Se espera recibir: image_id (por GET)
        $image_id = $_GET['image_id'] ?? '';
        if (empty($image_id)) {
            echo json_encode([
                'success' => false,
                'message' => 'El parámetro image_id es obligatorio.'
            ]);
            exit;
        }
        // Obtener los comentarios que no estén archivados para la imagen especificada
        $stmt = $conn->prepare("SELECT id, comment, user_id, created_at FROM comments WHERE image_id = ? AND archived = 0 ORDER BY created_at DESC");
        if (!$stmt) {
            echo json_encode(["success" => false, "message" => "Error en la preparación de la consulta: " . $conn->error]);
            exit;
        }
        $stmt->bind_param("i", $image_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $comments = [];
        while ($row = $result->fetch_assoc()) {
            // Se puede agregar la lógica para obtener el nombre del autor (si se dispone de una tabla de usuarios)
            $row['author'] = null; // El cliente puede interpretar un valor nulo como "Anónimo"
            $comments[] = $row;
        }
        echo json_encode([
            'success'  => true,
            'comments' => $comments
        ]);
        $stmt->close();
        break;

    case 'addComment':
        // Se espera recibir (por POST o JSON): image_id, user_id, comment
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) {
            $input = $_POST;
        }
        $image_id = $input['image_id'] ?? '';
        $user_id  = $input['user_id'] ?? '';
        $comment  = $input['comment'] ?? '';
        if (empty($image_id) || empty($user_id) || empty($comment)) {
            echo json_encode([
                'success' => false,
                'message' => 'Faltan parámetros obligatorios (image_id, user_id o comment).'
            ]);
            exit;
        }
        // Insertar el nuevo comentario
        $stmt = $conn->prepare("INSERT INTO comments (image_id, user_id, comment) VALUES (?, ?, ?)");
        if (!$stmt) {
            echo json_encode(["success" => false, "message" => "Error en la preparación de la consulta: " . $conn->error]);
            exit;
        }
        $stmt->bind_param("iis", $image_id, $user_id, $comment);
        if ($stmt->execute()) {
            echo json_encode([
                'success'    => true,
                'comment_id' => $stmt->insert_id
            ]);
        } else {
            echo json_encode([
                'success' => false,
                'message' => 'No se pudo agregar el comentario.'
            ]);
        }
        $stmt->close();
        break;

    case 'archiveComment':
        // Se espera recibir (por POST o JSON): comment_id
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) {
            $input = $_POST;
        }
        $comment_id = $input['comment_id'] ?? '';
        if (empty($comment_id)) {
            echo json_encode([
                'success' => false,
                'message' => 'El parámetro comment_id es obligatorio.'
            ]);
            exit;
        }
        // Actualizar el comentario para marcarlo como archivado
        $stmt = $conn->prepare("UPDATE comments SET archived = 1 WHERE id = ?");
        if (!$stmt) {
            echo json_encode(["success" => false, "message" => "Error en la preparación de la consulta: " . $conn->error]);
            exit;
        }
        $stmt->bind_param("i", $comment_id);
        if ($stmt->execute()) {
            echo json_encode(['success' => true]);
        } else {
            echo json_encode([
                'success' => false,
                'message' => 'No se pudo archivar el comentario.'
            ]);
        }
        $stmt->close();
        break;

    default:
        echo json_encode([
            'success' => false,
            'message' => 'Acción no válida.'
        ]);
        break;
}

$conn->close();
?>
