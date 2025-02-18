<?php
require __DIR__ . '/vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

// Datos de conexión
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

// Contamos las imágenes no archivadas (archived = 0) que tienen al menos un tag agregado hoy (UTC)
// Se asume que en la tabla image_tags existe la columna 'tagged_at' (tipo DATETIME) en UTC.
$sqlToday = "SELECT COUNT(DISTINCT i.id) as today_tagged
             FROM images i
             INNER JOIN image_tags it ON i.id = it.image_id
             WHERE i.archived = 0
               AND DATE(it.tagged_at) = UTC_DATE()";

$resultToday = $conn->query($sqlToday);
if (!$resultToday) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Error en la consulta: " . $conn->error]);
    exit;
}
$rowToday = $resultToday->fetch_assoc();
$today_tagged = (int)$rowToday['today_tagged'];

$conn->close();

echo json_encode([
    "success" => true,
    "today_tagged" => $today_tagged
]);
?>
