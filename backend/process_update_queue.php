<?php
// Configurar los errores
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/update_errors.log');
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
    file_put_contents($log_file, $logMessage . PHP_EOL, FILE_APPEND);
    error_log($message);
}

my_log("DEBUG: Iniciando process_update_queue.php");

// Conexión a la base de datos
$conn = new mysqli(
    $_ENV['DB_HOST'],
    $_ENV['DB_USER'],
    $_ENV['DB_PASS'],
    $_ENV['DB_NAME'],
    isset($_ENV['DB_PORT']) ? $_ENV['DB_PORT'] : 3306
);
if ($conn->connect_error) {
    my_log("ERROR: Conexión a BD fallida: " . $conn->connect_error);
    die("Error de conexión a BD: " . $conn->connect_error);
}
my_log("✅ DEBUG: Conexión a MySQL exitosa");
flush();

// Leer el archivo metadata.csv y almacenarlo en un array asociativo
$csvFile = __DIR__ . '/metadata/metadata.csv';
$metadataArray = array();
if (file_exists($csvFile)) {
    my_log("DEBUG: Se encontró metadata.csv en: $csvFile");
    if (($handle = fopen($csvFile, 'r')) !== false) {
        $header = fgetcsv($handle);
        if ($header !== false) {
            my_log("DEBUG: Cabecera del CSV: " . json_encode($header));
            $idxFilename = array_search('filename', $header);
            $idxName     = array_search('name', $header);
            my_log("DEBUG: Índices CSV: filename=$idxFilename, name=$idxName");
            while (($row = fgetcsv($handle)) !== false) {
                $fileCsv = trim(isset($row[$idxFilename]) ? $row[$idxFilename] : '');
                if ($fileCsv !== '') {
                    $metadataArray[$fileCsv] = array(
                        'name' => isset($row[$idxName]) ? $row[$idxName] : $fileCsv
                    );
                    my_log("DEBUG: Metadata agregada para '$fileCsv': " . json_encode($metadataArray[$fileCsv]));
                }
            }
        } else {
            my_log("ERROR: La cabecera del CSV está vacía o mal formateada.");
        }
        fclose($handle);
    } else {
        my_log("ERROR: No se pudo abrir metadata.csv.");
    }
} else {
    my_log("WARNING: No se encontró metadata.csv en /metadata. Se continuará sin metadata adicional.");
}

// Obtener el job_id desde los argumentos de la línea de comandos
$job_id = isset($argv[1]) ? $argv[1] : null;
if (!$job_id) {
    my_log("ERROR: No se especificó un job_id.");
    die("No se especificó un job_id.");
}
my_log("DEBUG: update_job_id recibido -> $job_id");
flush();

// Marcar el job de actualización como "running" en update_jobs
$conn->query("UPDATE update_jobs SET status = 'running' WHERE id = $job_id");
my_log("DEBUG: update_jobs: Estado actualizado a 'running' para job_id: $job_id");

// Variables para el procesamiento por lotes y control de inactividad
$batchSize = 10;
$maxNoPendingIterations = 30; // Por ejemplo, 30 iteraciones (cada 2 segundos = 60 segundos de inactividad)
$noPendingIterations = 0;

while (true) {
    // Verificar el estado del job
    $result = $conn->query("SELECT status FROM update_jobs WHERE id = $job_id");
    if ($result->num_rows === 0 || $result->fetch_assoc()['status'] === 'stopped') {
        my_log("INFO: Proceso de update detenido manualmente o job no existe.");
        break;
    }
    
    $result = $conn->query("
        SELECT id, filename, attempts
        FROM update_image_queue
        WHERE status = 'pending'
          AND job_id = $job_id
        LIMIT $batchSize
    ");
    
    if ($result->num_rows === 0) {
        $noPendingIterations++;
        my_log("INFO: No hay más registros de actualización pendientes. Iteración sin pendientes: $noPendingIterations");
        if ($noPendingIterations >= $maxNoPendingIterations) {
            my_log("INFO: Se alcanzó el tiempo máximo de inactividad. Finalizando proceso.");
            break;
        }
        sleep(2);
        continue;
    } else {
        // Reiniciar el contador de inactividad si se encuentran registros
        $noPendingIterations = 0;
    }
    
    while ($row = $result->fetch_assoc()) {
        $queueId     = $row['id'];
        $filename    = $row['filename'];
        $attemptsRow = (int)$row['attempts'];
        my_log("DEBUG: Procesando update_image_queue, ID: $queueId, filename: $filename (Intentos: $attemptsRow)");
        
        if ($attemptsRow >= 5) {
            my_log("INFO: La imagen $filename ha fallado $attemptsRow veces. Marcándola como error.");
            $conn->query("UPDATE update_image_queue SET status = 'error', updated_at = NOW() WHERE id = $queueId");
            continue;
        }
        
        // Extraer metadata: usar el campo "name" del CSV
        $newName = $filename;
        $baseFilename = pathinfo($filename, PATHINFO_FILENAME);
        my_log("DEBUG: Nombre base extraído: $baseFilename");
        if (isset($metadataArray[$baseFilename])) {
            my_log("DEBUG: Se encontró metadata para $baseFilename: " . json_encode($metadataArray[$baseFilename]));
            $newName = $metadataArray[$baseFilename]['name'] ? $metadataArray[$baseFilename]['name'] : $filename;
        } else {
            my_log("DEBUG: No se encontró metadata para $baseFilename");
        }
        
        my_log("DEBUG: Actualizando images: original_name='$newName', WHERE SUBSTRING_INDEX(filename, '.', 1) = ?");
        
        // Actualizar la columna original_name en images comparando la parte antes del punto
        $updateStmt = $conn->prepare("UPDATE images SET original_name = ? WHERE SUBSTRING_INDEX(filename, '.', 1) = ?");
        if (!$updateStmt) {
            my_log("ERROR: No se pudo preparar el statement para actualizar images: " . $conn->error);
            $conn->query("UPDATE update_image_queue SET status = 'error' WHERE id = $queueId");
            continue;
        }
        $updateStmt->bind_param("ss", $newName, $filename);
        if ($updateStmt->execute()) {
            if ($updateStmt->affected_rows > 0) {
                my_log("DEBUG: Actualización exitosa para filename: $filename");
            } else {
                my_log("DEBUG: No se realizó cambio para filename: $filename");
            }
        } else {
            my_log("ERROR: Falló la actualización para filename $filename: " . $updateStmt->error);
        }
        $updateStmt->close();
        
        if (!$conn->query("UPDATE update_image_queue SET status = 'done', updated_at = NOW() WHERE id = $queueId")) {
            my_log("ERROR: No se pudo actualizar status a 'done' para update_image_queue ID: $queueId - " . $conn->error);
        } else {
            my_log("DEBUG: update_image_queue ID: $queueId marcado como 'done'");
        }
        sleep(1);
    }
    sleep(2);
}

$conn->query("UPDATE update_jobs SET status = 'completed' WHERE id = $job_id");
$conn->close();
my_log("DEBUG: Proceso de actualización finalizado para update_job_id: $job_id.");
echo "Proceso de actualización completado.\n";
?>
