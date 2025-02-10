<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/import_errors.log');
error_reporting(E_ALL);

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
    die("Error de conexión a BD: " . $conn->connect_error);
}

// Obtener el job_id desde los argumentos de la línea de comandos
$job_id = $argv[1] ?? null;
if (!$job_id) {
    die("No se especificó un job_id.");
}

// Marcar el job como "running"
$conn->query("UPDATE import_jobs SET status = 'running' WHERE id = $job_id");

$batchSize = 5; // Procesar 5 imágenes por ciclo

while (true) {
    // Verificar si el job fue detenido
    $result = $conn->query("SELECT status FROM import_jobs WHERE id = $job_id");
    if ($result->num_rows === 0 || $result->fetch_assoc()['status'] === 'stopped') {
        break; // Salir si el proceso fue detenido
    }

    // Obtener imágenes pendientes
    $result = $conn->query("SELECT id, filename FROM image_queue WHERE status = 'pending' LIMIT $batchSize");
    if ($result->num_rows === 0) {
        break; // No hay más imágenes pendientes
    }

    while ($row = $result->fetch_assoc()) {
        $queueId = $row['id'];
        $filename = $row['filename'];
        $sourcePath = $_ENV['PRIVATE_IMAGES_DIR'] . '/' . $filename;
        $destination = $_ENV['BACKEND_BASE_PATH'] . '/uploads/' . $filename;

        // Marcar como "processing"
        $conn->query("UPDATE image_queue SET status = 'processing' WHERE id = $queueId");

        // Verificar si el archivo existe antes de moverlo
        if (file_exists($sourcePath) && rename($sourcePath, $destination)) {
            // Insertar en la tabla de imágenes
            $stmt = $conn->prepare("INSERT INTO images (filename, original_name, path) VALUES (?, ?, ?)");
            $stmt->bind_param("sss", $filename, $filename, $destination);
            $stmt->execute();
            $stmt->close();

            // Marcar como "done"
            $conn->query("UPDATE image_queue SET status = 'done' WHERE id = $queueId");
        } else {
            $conn->query("UPDATE image_queue SET status = 'error' WHERE id = $queueId");
        }
    }

    sleep(2); // Pequeña pausa para evitar sobrecargar el servidor
}

// Marcar el job como "completed"
$conn->query("UPDATE import_jobs SET status = 'completed' WHERE id = $job_id");

$conn->close();
?>
