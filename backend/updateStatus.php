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
    exit(json_encode([
        "success" => false,
        "message" => "Error de conexión a BD"
    ]));
}

$job_id = filter_input(INPUT_GET, 'job_id', FILTER_VALIDATE_INT);
if (!$job_id) {
    http_response_code(400);
    exit(json_encode([
        "success" => false,
        "message" => "Job ID inválido"
    ]));
}

// Consultar el estado del update job en la tabla update_jobs
$result = $conn->query("SELECT status FROM update_jobs WHERE id = $job_id");
if ($result && $result->num_rows > 0) {
    // Si el job existe
    $row = $result->fetch_assoc();
    $status = $row['status'];

    http_response_code(200);
    exit(json_encode([
        "success" => true,
        "status"  => $status
    ]));
} else {
    // Si no se encontró el job
    http_response_code(404);
    exit(json_encode([
        "success" => false,
        "message" => "Job no encontrado"
    ]));
}
?>
