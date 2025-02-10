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

$batchSize = 5;      // Procesar 5 imágenes por ciclo
$maxAttempts = 10;   // Máximo de intentos antes de detener el proceso
$attempts = 0;

while (true) {
    // Verificar si el job fue detenido manualmente (status = 'stopped')
    $result = $conn->query("SELECT status FROM import_jobs WHERE id = $job_id");
    if ($result->num_rows === 0 || $result->fetch_assoc()['status'] === 'stopped') {
        error_log("Proceso detenido manualmente o job no existe.");
        break;
    }

    // Obtener imágenes pendientes para este job
    $result = $conn->query("
        SELECT id, filename 
        FROM image_queue 
        WHERE status = 'pending' 
          AND job_id = $job_id
        LIMIT $batchSize
    ");
    
    if ($result->num_rows === 0) {
        $attempts++;
        error_log("No hay más imágenes pendientes. Intento: $attempts");
        
        // Si después de varios intentos no hay pendientes, marcamos el job como completado
        if ($attempts >= $maxAttempts) {
            error_log("Máximo de intentos alcanzado. Cerrando proceso.");
            break;
        }
        sleep(2);
        continue;
    }

    $attempts = 0; // Reiniciar contador de intentos

    while ($row = $result->fetch_assoc()) {
        $queueId = $row['id'];
        $filename = $row['filename'];

        // Marcar la imagen como "processing"
        $conn->query("UPDATE image_queue SET status = 'processing' WHERE id = $queueId");

        // Insertar en la tabla de imágenes
        $stmt = $conn->prepare("INSERT INTO images (filename, original_name, path) VALUES (?, ?, ?)");
        $stmt->bind_param("sss", $filename, $filename, $_ENV['PRIVATE_IMAGES_DIR']);
        
        if ($stmt->execute()) {
            $conn->query("UPDATE image_queue SET status = 'done' WHERE id = $queueId");
        } else {
            error_log("Error al insertar imagen en BD: " . $stmt->error);
            $conn->query("UPDATE image_queue SET status = 'error' WHERE id = $queueId");
        }

        $stmt->close();
    }

    // Pausa para evitar saturar el servidor
    sleep(2);
}

// Marcar el job como "completed" si no está stopped
$conn->query("UPDATE import_jobs SET status = 'completed' WHERE id = $job_id");

$conn->close();
error_log("Proceso finalizado para el job_id: $job_id.");
?>
