<?php
require __DIR__ . '/vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

$conn = new mysqli(
    $_ENV['DB_HOST'],
    $_ENV['DB_USER'],
    $_ENV['DB_PASS'],
    $_ENV['DB_NAME'],
    $_ENV['DB_PORT'] ?? 3306
);

if ($conn->connect_error) {
    http_response_code(500);
    exit(json_encode(["success" => false, "message" => "Error de conexión a BD"]));
}

$conn->query("UPDATE import_jobs SET status = 'stopped'");

// Borrar todo el contenido de la tabla import_image_queue
$conn->query("DELETE FROM import_image_queue");

http_response_code(200);
exit(json_encode(["success" => true, "message" => "Importación detenida"]));
?>
