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

echo "✅ DEBUG: Conexión a MySQL exitosa\n";
flush();

// Obtener el job_id desde los argumentos de la línea de comandos
$job_id = $argv[1] ?? null;
if (!$job_id) {
    die("No se especificó un job_id.");
}

echo "DEBUG: job_id recibido -> $job_id\n";
flush();

// Marcar el job como "running"
$conn->query("UPDATE import_jobs SET status = 'running' WHERE id = $job_id");

$batchSize = 25;  // Procesar imágenes en lotes
$maxAttempts = 10; // Máximo de intentos antes de detener el proceso
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
        if (!$conn->query("UPDATE image_queue SET status = 'processing' WHERE id = $queueId")) {
            error_log("ERROR: No se pudo actualizar status a 'processing' para ID: $queueId - " . $conn->error);
            continue;
        }

        // Obtener la ruta del archivo
        $filePath = rtrim($_ENV['PRIVATE_IMAGES_DIR'], '/') . '/' . $filename;

        // Verificar si el archivo existe antes de procesarlo
        if (!file_exists($filePath)) {
            error_log("ERROR: El archivo no existe: $filePath");
            $conn->query("UPDATE image_queue SET status = 'error' WHERE id = $queueId");
            continue;
        }

        // Generar el hash del archivo
        $file_hash = hash_file('sha256', $filePath);
        if (!$file_hash || strlen($file_hash) < 64) {
            error_log("ERROR: No se pudo generar hash para el archivo $filePath");
            $conn->query("UPDATE image_queue SET status = 'error' WHERE id = $queueId");
            continue;
        }

        // Insertar en la tabla de imágenes con file_hash
        $stmt = $conn->prepare("INSERT INTO images (filename, original_name, path, file_hash) VALUES (?, ?, ?, ?)");
        if (!$stmt) {
            error_log("ERROR: No se pudo preparar el statement para insertar en images: " . $conn->error);
            $conn->query("UPDATE image_queue SET status = 'error' WHERE id = $queueId");
            continue;
        }
        
        $stmt->bind_param("ssss", $filename, $filename, $_ENV['PRIVATE_IMAGES_DIR'], $file_hash);
        
        if ($stmt->execute()) {
            if (!$conn->query("UPDATE image_queue SET status = 'done' WHERE id = $queueId")) {
                error_log("ERROR: No se pudo actualizar status a 'done' para ID: $queueId - " . $conn->error);
            }
        } else {
            error_log("ERROR: Fallo al insertar en images: " . $stmt->error);
            $conn->query("UPDATE image_queue SET status = 'error' WHERE id = $queueId");
        }

        $stmt->close();
    }

    // Pausa para evitar saturar el servidor
    sleep(2);
}

// Marcar el job como "completed" si no está en estado "stopped"
$conn->query("UPDATE import_jobs SET status = 'completed' WHERE id = $job_id");

$conn->close();
error_log("Proceso finalizado para el job_id: $job_id.");
?>
