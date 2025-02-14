<?php
// Cargar las librerías, Dotenv y cualquier otra dependencia.
require __DIR__ . '/vendor/autoload.php';

// Cargar variables de entorno desde .env
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Usamos BACKEND_BASE_PATH para la ubicación de logs
$backendBasePath = rtrim($_ENV['BACKEND_BASE_PATH'], '/') . '/';
$log_file = $backendBasePath . 'logs/debug.log';

// Función de log personalizada
function my_log($message) {
    global $backendBasePath;
    $log_file = $backendBasePath . 'logs/debug.log';
    error_log(date('[Y-m-d H:i:s] ') . $message . PHP_EOL, 3, $log_file);
}

// 1. Validar parámetro "user_id"
$user_id = $_GET['user_id'] ?? '';
if (empty($user_id)) {
    http_response_code(400);
    my_log("Parámetro 'user_id' requerido");
    die("Parámetro 'user_id' requerido");
}

// 2. Conectarse a la base de datos
// Utilizamos las mismas variables del segundo snippet:
$db_host = $_ENV['DB_HOST'];
$db_user = $_ENV['DB_USER'];
$db_pass = $_ENV['DB_PASS'];
$db_name = $_ENV['DB_NAME'];
$db_port = $_ENV['DB_PORT'] ?? 3306;

try {
    // Armamos el DSN con la información apropiada
    $dsn = "mysql:host=$db_host;port=$db_port;dbname=$db_name;charset=utf8mb4";
    
    // Creamos la conexión PDO
    $pdo = new PDO($dsn, $db_user, $db_pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (Exception $e) {
    my_log("Error de conexión DB: " . $e->getMessage());
    http_response_code(500);
    die("Error de conexión a la base de datos");
}

// 3. Consultar la tabla users para obtener el filename (y, si gustas, también el username)
try {
    $stmt = $pdo->prepare("SELECT username, filename FROM users WHERE id = :user_id LIMIT 1");
    $stmt->execute([':user_id' => $user_id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        http_response_code(404);
        my_log("No se encontró usuario con id=" . $user_id);
        die("No se encontró el usuario");
    }

    $username = $row['username'];
    $filename = $row['filename'];

    if (!$filename) {
        http_response_code(404);
        my_log("El usuario (id=$user_id) no tiene filename en la DB");
        die("No existe foto de perfil para este usuario");
    }

} catch (Exception $e) {
    my_log("Error consultando la tabla users: " . $e->getMessage());
    http_response_code(500);
    die("Error consultando datos del usuario");
}

// 4. Ruta donde se guardan las fotos de perfil
$profilePicsDir = $_ENV['PROFILE_PICS_DIR'];
$realProfileDir = realpath($profilePicsDir);
$normalizedProfileDir = rtrim($realProfileDir, '/');

// 5. Construir la ruta final y verificar que existe
$filePath = realpath($profilePicsDir . DIRECTORY_SEPARATOR . $filename);
if (!$filePath || !is_file($filePath)) {
    http_response_code(404);
    my_log("Foto de perfil no encontrada: $filePath");
    die("Imagen no encontrada");
}

// 6. Determinar el MIME y enviar la imagen
$mime = mime_content_type($filePath);
$fileSize = filesize($filePath);

my_log("Enviando foto de perfil para user_id=$user_id, username=$username, file=$filename (MIME: $mime)");

header("Access-Control-Allow-Origin: *");
header("Content-Type: $mime");
header("Content-Length: $fileSize");
// Cache 7 días (opcional)
header("Cache-Control: public, max-age=604800");

readfile($filePath);
exit;
