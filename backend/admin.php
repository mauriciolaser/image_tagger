<?php
require __DIR__ . '/vendor/autoload.php';

// Cargar variables de entorno desde `.env`
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Configuración de la base de datos
$mysqli = new mysqli($_ENV['DB_HOST'], $_ENV['DB_USER'], $_ENV['DB_PASS'], $_ENV['DB_NAME']);

if ($mysqli->connect_error) {
    error_log("Conexión fallida: " . $mysqli->connect_error);
    die(json_encode(["error" => "Conexión fallida"]));
}

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

// Obtener el método HTTP de la solicitud
$method = $_SERVER['REQUEST_METHOD'];
error_log("Método HTTP recibido en admin.php: $method");

switch ($method) {
    case "GET":
        error_log("Recibiendo solicitud GET para obtener usuarios.");
        $result = $mysqli->query("SELECT id, username FROM users");
        $users = [];
        while ($row = $result->fetch_assoc()) {
            $users[] = $row;
        }
        error_log("Usuarios obtenidos: " . json_encode($users));
        echo json_encode($users);
        break;

    case "POST":
        $data = json_decode(file_get_contents("php://input"), true);
        error_log("Datos recibidos en POST: " . json_encode($data));

        if (!isset($data["username"]) || !isset($data["password"])) {
            error_log("Error: Datos incompletos en POST.");
            die(json_encode(["error" => "Faltan datos"]));
        }

        $username = $mysqli->real_escape_string($data["username"]);
        $password_hash = password_hash($data["password"], PASSWORD_DEFAULT);

        $stmt = $mysqli->prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)");
        $stmt->bind_param("ss", $username, $password_hash);
        if ($stmt->execute()) {
            error_log("Usuario creado con éxito: $username");
            echo json_encode(["success" => "Usuario creado"]);
        } else {
            error_log("Error al crear usuario.");
            echo json_encode(["error" => "Error al crear usuario"]);
        }
        break;

    case "DELETE":
        $data = json_decode(file_get_contents("php://input"), true);
        error_log("Datos recibidos en DELETE: " . json_encode($data));

        if (!isset($data["id"])) {
            error_log("Error: Datos incompletos en DELETE.");
            die(json_encode(["error" => "Faltan datos"]));
        }

        $id = intval($data["id"]);

        $stmt = $mysqli->prepare("DELETE FROM users WHERE id = ?");
        $stmt->bind_param("i", $id);
        if ($stmt->execute()) {
            error_log("Usuario eliminado con éxito: ID $id");
            echo json_encode(["success" => "Usuario eliminado"]);
        } else {
            error_log("Error al eliminar usuario.");
            echo json_encode(["error" => "Error al eliminar usuario"]);
        }
        break;

    default:
        error_log("Método no soportado: $method");
        echo json_encode(["error" => "Método no soportado"]);
        break;
}
?>
