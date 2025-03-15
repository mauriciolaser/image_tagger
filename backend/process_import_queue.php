<?php
// Configurar los errores
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/import_errors.log');
error_reporting(E_ALL);

require __DIR__ . '/vendor/autoload.php';

// Cargar variables de entorno
$dotenv = Dotenv\Dotenv::createUnsafeImmutable(__DIR__);
$dotenv->load();
if (!isset($_ENV['BACKEND_BASE_PATH'])) {
    die('ERROR: BACKEND_BASE_PATH no está definido en .env');
}

$backendBasePath = rtrim($_ENV['BACKEND_BASE_PATH'], '/') . '/';

// Función de log personalizada
function my_log($message) {
    global $backendBasePath;
    $log_file = $backendBasePath . 'logs/debug.log';
    $dir = dirname($log_file);
    if (!is_dir($dir)) {
        if (!mkdir($dir, 0777, true)) {
            error_log("No se pudo crear el directorio: $dir");
            return;
        }
    }
    $logMessage = date('[Y-m-d H:i:s] ') . $message;
    $result = file_put_contents($log_file, $logMessage . PHP_EOL, FILE_APPEND);
    if ($result === false) {
        error_log("Error al escribir en el log: $log_file");
    }
    error_log($message);
}

my_log("DEBUG: Iniciando process_import_queue.php");

// Conexión a la base de datos
$conn = new mysqli(
    $_ENV['DB_HOST'],
    $_ENV['DB_USER'],
    $_ENV['DB_PASS'],
    $_ENV['DB_NAME'],
    $_ENV['DB_PORT'] ?? 3306
);
if ($conn->connect_error) {
    my_log("ERROR: Conexión a BD fallida: " . $conn->connect_error);
    die("Error de conexión a BD: " . $conn->connect_error);
}
my_log("✅ DEBUG: Conexión a MySQL exitosa");
flush();

$job_id = $argv[1] ?? null;
if (!$job_id) {
    my_log("ERROR: No se especificó un job_id.");
    die("No se especificó un job_id.");
}
my_log("DEBUG: job_id recibido -> " . $job_id);

$user_id = $argv[2] ?? null;
if (!$user_id) {
    $user_id = 99;
    my_log("DEBUG: user_id era null, se asigna 99");
} else {
    my_log("DEBUG: user_id recibido -> " . $user_id);
}
flush();

$uploadDir = rtrim($_ENV['BACKEND_BASE_PATH'], '/') . '/uploads';
my_log("DEBUG: Directorio de uploads: $uploadDir");

// Ajustes para procesamiento masivo
$batchSize = 50;
$inactivityTimeout = 600; // 10 minutos de inactividad para finalizar el proceso
$lastFoundTime = time();

while (true) {
    // Verificar el estado del job
    $result = $conn->query("SELECT status FROM import_jobs WHERE id = $job_id");
    if ($result->num_rows === 0 || $result->fetch_assoc()['status'] === 'stopped') {
        my_log("INFO: Proceso detenido manualmente o job no existe.");
        break;
    }
    
    // Consultar registros pendientes
    $resultPending = $conn->query("SELECT id, filename, attempts FROM import_image_queue WHERE status = 'pending' AND job_id = $job_id LIMIT $batchSize");
    $numPending = $resultPending->num_rows;
    my_log("DEBUG: Registros pendientes: $numPending");
    
    if ($numPending === 0) {
        // Si no se encuentran pendientes, intentar resetear filas en processing atascadas
        $resetQuery = "UPDATE import_image_queue 
                       SET status = 'pending', updated_at = NOW() 
                       WHERE status = 'processing' 
                         AND TIMESTAMPDIFF(SECOND, updated_at, NOW()) > 180
                         AND job_id = $job_id";
        $conn->query($resetQuery);
        my_log("INFO: Se reseteó stuck rows: " . $conn->affected_rows);

        // Reconsultar pendientes
        $resultPending = $conn->query("SELECT id, filename, attempts FROM import_image_queue WHERE status = 'pending' AND job_id = $job_id LIMIT $batchSize");
        $numPending = $resultPending->num_rows;
        my_log("DEBUG: Registros pendientes después del reset: $numPending");
        
        if ($numPending === 0) {
            if ((time() - $lastFoundTime) >= $inactivityTimeout) {
                my_log("INFO: Tiempo de inactividad alcanzado. Cerrando proceso.");
                break;
            }
            my_log("INFO: No hay imágenes pendientes. Reintentando...");
            sleep(2);
            continue;
        } else {
            $lastFoundTime = time();
        }
    } else {
        $lastFoundTime = time();
    }
    
    while ($row = $resultPending->fetch_assoc()) {
        // Verificar el estado del job nuevamente
        $stateCheck = $conn->query("SELECT status FROM import_jobs WHERE id = $job_id");
        if ($stateCheck->num_rows === 0 || $stateCheck->fetch_assoc()['status'] === 'stopped') {
            my_log("INFO: Deteniendo procesamiento en medio de un batch.");
            break 2;
        }
        
        $queueId    = $row['id'];
        $filename   = $row['filename'];
        $attemptsRow = (int)$row['attempts'];
        
        // Si la imagen ya falló 5 veces, marcarla como error permanentemente
        if ($attemptsRow >= 5) {
            my_log("INFO: La imagen $filename ha fallado $attemptsRow veces. Marcándola como error.");
            $conn->query("UPDATE import_image_queue SET status = 'error', updated_at = NOW() WHERE id = $queueId");
            continue;
        }
        
        my_log("DEBUG: Procesando registro de cola, ID: $queueId, filename: $filename (Intentos: $attemptsRow)");
        
        // Actualizar a 'processing'
        if (!$conn->query("UPDATE import_image_queue SET status = 'processing', updated_at = NOW() WHERE id = $queueId")) {
            my_log("ERROR: No se pudo actualizar status a 'processing' para ID: $queueId - " . $conn->error);
            $conn->query("UPDATE import_image_queue SET attempts = attempts + 1, updated_at = NOW() WHERE id = $queueId");
            continue;
        }
        
        $filePath = $uploadDir . '/' . $filename;
        my_log("DEBUG: Buscando archivo: $filePath");
        $realPath = realpath($filePath);
        my_log("DEBUG: Real path: " . ($realPath ? $realPath : "No se obtuvo realpath"));
        
        if (!file_exists($filePath)) {
            my_log("ERROR: El archivo no existe: $filePath");
            $conn->query("UPDATE import_image_queue SET status = 'error', updated_at = NOW(), attempts = attempts + 1 WHERE id = $queueId");
            continue;
        }
        
        // Verificar duplicado por filename
        $dupCheckStmt = $conn->prepare("SELECT COUNT(*) as count FROM images WHERE filename = ?");
        $dupCheckStmt->bind_param("s", $filename);
        $dupCheckStmt->execute();
        $dupResult = $dupCheckStmt->get_result()->fetch_assoc();
        $dupCheckStmt->close();
        if ($dupResult['count'] > 0) {
            my_log("INFO: La imagen $filename ya fue cargada anteriormente. Marcando como done.");
            $conn->query("UPDATE import_image_queue SET status = 'done', updated_at = NOW() WHERE id = $queueId");
            continue;
        }
        
        // Generar hash del archivo
        $startTime = microtime(true);
        $file_hash = hash_file('sha256', $filePath);
        $duration = microtime(true) - $startTime;
        if ($duration > 5) {
            my_log("WARNING: hash_file tardó $duration s para $filePath. Incrementando attempts.");
            $conn->query("UPDATE import_image_queue SET attempts = attempts + 1, updated_at = NOW() WHERE id = $queueId");
            continue;
        }
        if (!$file_hash || strlen($file_hash) < 64) {
            my_log("ERROR: No se pudo generar hash para el archivo $filePath");
            $conn->query("UPDATE import_image_queue SET status = 'error', updated_at = NOW(), attempts = attempts + 1 WHERE id = $queueId");
            continue;
        }
        
        // Verificar duplicado por file_hash
        $dupHashStmt = $conn->prepare("SELECT COUNT(*) as count FROM images WHERE file_hash = ?");
        $dupHashStmt->bind_param("s", $file_hash);
        $dupHashStmt->execute();
        $dupHashResult = $dupHashStmt->get_result()->fetch_assoc();
        $dupHashStmt->close();
        if ($dupHashResult['count'] > 0) {
            my_log("INFO: El hash $file_hash ya existe en images. Marcando $filename como done.");
            $conn->query("UPDATE import_image_queue SET status = 'done', updated_at = NOW() WHERE id = $queueId");
            continue;
        }
        
        $stmt = $conn->prepare("INSERT INTO images (filename, original_name, path, file_hash) VALUES (?, ?, ?, ?)");
        if (!$stmt) {
            my_log("ERROR: No se pudo preparar el statement para insertar en images: " . $conn->error);
            $conn->query("UPDATE import_image_queue SET status = 'error', updated_at = NOW(), attempts = attempts + 1 WHERE id = $queueId");
            continue;
        }
        $pathDB = "uploads/" . $filename;
        $stmt->bind_param("ssss", $filename, $filename, $pathDB, $file_hash);
        
        if ($stmt->execute()) {
            if (!$conn->query("UPDATE import_image_queue SET status = 'done', updated_at = NOW() WHERE id = $queueId")) {
                my_log("ERROR: No se pudo actualizar status a 'done' para ID: $queueId - " . $conn->error);
            } else {
                my_log("DEBUG: Registro insertado en images para filename: $filename");
            }
        } else {
            my_log("ERROR: Falló al insertar en images: " . $stmt->error);
            $conn->query("UPDATE import_image_queue SET status = 'error', updated_at = NOW(), attempts = attempts + 1 WHERE id = $queueId");
        }
        $stmt->close();
    }
    sleep(2);
}

$conn->query("UPDATE import_jobs SET status = 'completed' WHERE id = $job_id");
$conn->close();
my_log("DEBUG: Proceso finalizado para el job_id: $job_id.");

echo json_encode(["success" => true, "message" => "Proceso de importación completado para job_id: $job_id."]);
?>
