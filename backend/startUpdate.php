<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/update_errors.log');
error_reporting(E_ALL);

require __DIR__ . '/vendor/autoload.php';

// Cargar variables de entorno
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
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

my_log("DEBUG: Iniciando startUpdate.php");

// Conexión a la base de datos
$conn = new mysqli(
    $_ENV['DB_HOST'],
    $_ENV['DB_USER'],
    $_ENV['DB_PASS'],
    $_ENV['DB_NAME'],
    $_ENV['DB_PORT'] ?? 3306
);
if ($conn->connect_error) {
    error_log("Error de conexión a BD: " . $conn->connect_error);
    http_response_code(500);
    exit(json_encode([
        "success" => false,
        "message" => "Error de conexión a BD"
    ]));
}

// Validar el user_id recibido vía GET
$user_id = filter_input(INPUT_GET, 'user_id', FILTER_VALIDATE_INT);
if (!$user_id) {
    http_response_code(400);
    exit(json_encode([
        "success" => false,
        "message" => "ID de usuario inválido"
    ]));
}

// Verificar si ya existe un update job en curso para este usuario
$checkStmt = $conn->prepare("
    SELECT id, status 
    FROM update_jobs 
    WHERE user_id = ? AND status IN ('pending', 'running') 
    ORDER BY created_at DESC 
    LIMIT 1
");
$checkStmt->bind_param("i", $user_id);
$checkStmt->execute();
$checkStmt->store_result();

if ($checkStmt->num_rows > 0) {
    $checkStmt->bind_result($existing_job_id, $existing_status);
    $checkStmt->fetch();
    $checkStmt->close();
    error_log("Ya hay un update job en proceso con ID: $existing_job_id y estado: $existing_status");
    http_response_code(400);
    exit(json_encode([
        "success" => false,
        "message" => "Ya hay un update job en proceso ($existing_status)."
    ]));
}
$checkStmt->close();

// Iniciar transacción para evitar inconsistencias
$conn->begin_transaction();

try {
    // Insertar un nuevo update job en la tabla update_jobs
    $stmt = $conn->prepare("INSERT INTO update_jobs (user_id, status) VALUES (?, 'pending')");
    if (!$stmt) {
        throw new Exception("Error preparando consulta update_jobs: " . $conn->error);
    }
    $stmt->bind_param("i", $user_id);
    if (!$stmt->execute()) {
        throw new Exception("Error ejecutando consulta update_jobs: " . $stmt->error);
    }
    $job_id = $stmt->insert_id;
    $stmt->close();
    if (!$job_id) {
        throw new Exception("Error: No se pudo obtener `job_id` después de insertar.");
    }
    
    // Leer el archivo metadata.csv y agregar a la cola de actualización (update_image_queue)
    $csvFile = __DIR__ . '/metadata/metadata.csv';
    $insertedCount = 0;
    if (file_exists($csvFile)) {
        if (($handle = fopen($csvFile, 'r')) !== false) {
            $header = fgetcsv($handle); // Leer la cabecera
            if ($header !== false) {
                // Ubicar índice de la columna 'filename'
                $idxFilename = array_search('filename', $header);
                if ($idxFilename === false) {
                    fclose($handle);
                    throw new Exception("La columna 'filename' es obligatoria en el CSV.");
                }
                // Recorrer cada fila y agregar a update_image_queue
                while (($row = fgetcsv($handle)) !== false) {
                    $fileCsv = trim($row[$idxFilename] ?? '');
                    if ($fileCsv === '') {
                        continue;
                    }
                    // Evitar duplicados en update_image_queue
                    $dupStmt = $conn->prepare("SELECT COUNT(*) FROM update_image_queue WHERE filename = ?");
                    $dupStmt->bind_param("s", $fileCsv);
                    $dupStmt->execute();
                    $dupStmt->bind_result($count);
                    $dupStmt->fetch();
                    $dupStmt->close();
                    if ($count > 0) {
                        continue;
                    }
                    // Insertar en update_image_queue
                    $insertQueueStmt = $conn->prepare("INSERT INTO update_image_queue (job_id, filename, status) VALUES (?, ?, 'pending')");
                    if (!$insertQueueStmt) {
                        throw new Exception("Error preparando consulta update_image_queue: " . $conn->error);
                    }
                    $insertQueueStmt->bind_param("is", $job_id, $fileCsv);
                    if ($insertQueueStmt->execute()) {
                        $insertedCount++;
                    }
                    $insertQueueStmt->close();
                }
            }
            fclose($handle);
        } else {
            throw new Exception("No se pudo abrir metadata.csv.");
        }
    } else {
        throw new Exception("No se encontró el archivo metadata.csv en /metadata.");
    }
    
    if ($insertedCount === 0) {
        $conn->query("UPDATE update_jobs SET status = 'completed' WHERE id = $job_id");
        throw new Exception("No se encontraron registros válidos en metadata.csv para actualizar.");
    }
    
    $conn->commit();
} catch (Exception $e) {
    $conn->rollback();
    error_log("Error en `startUpdate.php`: " . $e->getMessage());
    http_response_code(500);
    exit(json_encode(["success" => false, "message" => $e->getMessage()]));
}

// Verificar que el archivo process_update_queue.php existe
$processScript = __DIR__ . "/process_update_queue.php";
if (!file_exists($processScript)) {
    http_response_code(500);
    exit(json_encode(["success" => false, "message" => "Archivo process_update_queue.php no encontrado"]));
}

// Ejecutar el proceso en segundo plano adaptando la sintaxis para Windows y Linux
if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
    // En Windows, usamos el ejecutable de PHP que tú especifiques (por ejemplo, XAMPP)
    $phpExecutable = 'C:\xampp\php\php.exe';
    $cmd = "start /B $phpExecutable $processScript $job_id > NUL 2>&1";
} else {
    // En Linux, usamos el ejecutable PHP ubicado en /usr/local/bin/php
    $phpExecutable = '/usr/local/bin/php';
    // Se añade "echo $!" para capturar el PID del proceso en segundo plano
    $cmd = "$phpExecutable $processScript $job_id > /dev/null 2>&1 & echo \$!";
}

exec($cmd, $output, $return_var);
error_log("CMD executed: " . $cmd);
error_log("Output: " . print_r($output, true));
error_log("Return var: " . $return_var);

if ($return_var !== 0) {
    http_response_code(500);
    exit(json_encode(["success" => false, "message" => "Error executing background process"]));
}

// En Linux, capturamos el PID y lo guardamos en un archivo .pid
if (strtoupper(substr(PHP_OS, 0, 3)) !== 'WIN' && !empty($output[0])) {
    $pid = trim($output[0]);
    $pidDir = $backendBasePath . 'pids';
    if (!is_dir($pidDir)) {
        mkdir($pidDir, 0777, true);
    }
    $pidFile = $pidDir . '/update_' . $job_id . '.pid';
    file_put_contents($pidFile, $pid);
    error_log("Background process started with PID: " . $pid);
}

http_response_code(200);
exit(json_encode(["success" => true, "job_id" => $job_id, "added_records" => $insertedCount]));
