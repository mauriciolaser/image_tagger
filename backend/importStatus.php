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

// Consultar el estado del job en import_jobs
$result = $conn->query("SELECT status FROM import_jobs WHERE id = $job_id");
if ($result && $result->num_rows > 0) {
    $row = $result->fetch_assoc();
    $job_status = $row['status'];
} else {
    http_response_code(404);
    exit(json_encode([
        "success" => false,
        "message" => "Job no encontrado"
    ]));
}

// Consultar la cantidad total de imágenes para el job en import_image_queue
$resultTotal = $conn->query("SELECT COUNT(*) as total FROM import_image_queue WHERE job_id = $job_id");
$total = 0;
if ($resultTotal) {
    $row = $resultTotal->fetch_assoc();
    $total = (int)$row['total'];
}

// Consultar la cantidad de imágenes con status 'pending'
$resultPending = $conn->query("SELECT COUNT(*) as pending FROM import_image_queue WHERE job_id = $job_id AND status = 'pending'");
$pending = 0;
if ($resultPending) {
    $row = $resultPending->fetch_assoc();
    $pending = (int)$row['pending'];
}

// Calcular cuántas no tienen status 'pending'
$not_pending = $total - $pending;

// Consultar el filename de la primera fila con status "processing"
$processingFilename = null;
$resultProcessing = $conn->query("SELECT filename FROM import_image_queue WHERE job_id = $job_id AND status = 'processing' LIMIT 1");
if ($resultProcessing && $resultProcessing->num_rows > 0) {
    $row = $resultProcessing->fetch_assoc();
    $processingFilename = $row['filename'];
}

http_response_code(200);
exit(json_encode([
    "success"             => true,
    "job_status"          => $job_status,
    "total"               => $total,
    "pending"             => $pending,
    "not_pending"         => $not_pending,
    "processing_filename" => $processingFilename
]));
?>
