<?php
require __DIR__ . '/vendor/autoload.php';

// Cargar variables de entorno desde `.env`
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Configurar CORS para todas las solicitudes
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// Manejar la solicitud OPTIONS (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Verifica que la solicitud sea POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Method not allowed"]);
    exit;
}

// Leer los datos enviados, ya sea como JSON o datos de formulario
$data = json_decode(file_get_contents('php://input'), true);
$username = isset($data['username']) ? trim($data['username']) : '';
$password = isset($data['password']) ? $data['password'] : '';

if (empty($username) || empty($password)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Username and password required"]);
    exit;
}

// Configuración de la conexión a la base de datos desde .env
$db_host = $_ENV['DB_HOST'];
$db_user = $_ENV['DB_USER'];
$db_pass = $_ENV['DB_PASS'];
$db_name = $_ENV['DB_NAME'];
$db_port = $_ENV['DB_PORT'] ?? 3306;

// Conectar a la base de datos usando mysqli
$conn = new mysqli($db_host, $db_user, $db_pass, $db_name, $db_port);

// Verificar la conexión
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Database connection error"]);
    exit;
}

// Preparar la consulta para evitar inyección SQL
$stmt = $conn->prepare("SELECT id, username, password_hash FROM users WHERE username = ? LIMIT 1");
$stmt->bind_param("s", $username);
$stmt->execute();
$result = $stmt->get_result();

// Depuración: Verifica el resultado de la consulta
echo "Resultado de la consulta: ";
var_dump($result->fetch_assoc()); // Verifica si los resultados de la consulta son correctos

if ($result->num_rows === 0) {
    // Usuario no encontrado
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Invalid credentials"]);
    exit;
}

// Obtener el registro del usuario
$user = $result->fetch_assoc();

// Verificar la contraseña usando password_verify
if (password_verify($password, $user['password_hash'])) {
    // Autenticación exitosa
    http_response_code(200);
    echo json_encode([
        "success" => true, 
        "message" => "Login successful", 
        "user" => [
            "user_id" => $user['id'],  // 🔹 Esto es lo que guardaremos en `localStorage`
            "username" => $user['username']
        ]
    ]);
} else {
    // Contraseña incorrecta
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Invalid credentials"]);
}

// Cerrar la conexión y la sentencia
$stmt->close();
$conn->close();
?>
