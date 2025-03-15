<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Configurar logs de errores
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/import_errors.log');

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
    error_log("Error de conexión a BD: " . $conn->connect_error);
    http_response_code(500);
    exit(json_encode(["success" => false, "message" => "Error de conexión a BD"]));
}

// Ruta del archivo CSV (se asume que el archivo está en '/metadata/metadata.csv')
$csvFile = __DIR__ . '/metadata/metadata.csv';
if (!file_exists($csvFile)) {
    http_response_code(500);
    exit(json_encode(["success" => false, "message" => "Archivo metadata.csv no encontrado en /metadata"]));
}

// Abrir el archivo CSV
$handle = fopen($csvFile, 'r');
if ($handle === false) {
    http_response_code(500);
    exit(json_encode(["success" => false, "message" => "No se pudo abrir metadata.csv."]));
}

// Leer la primera línea (cabecera)
$header = fgetcsv($handle);
if ($header === false) {
    fclose($handle);
    http_response_code(500);
    exit(json_encode(["success" => false, "message" => "El archivo CSV está vacío o mal formateado."]));
}

// Buscar los índices de las columnas 'filename', 'name', 'lat' y 'lng'
$filenameIndex = array_search('filename', $header);
$nameIndex     = array_search('name', $header);
$latIndex      = array_search('lat', $header);
$lngIndex      = array_search('lng', $header);

if ($filenameIndex === false || $nameIndex === false || $latIndex === false || $lngIndex === false) {
    fclose($handle);
    http_response_code(400);
    exit(json_encode([
        "success" => false, 
        "message" => "Las columnas 'filename', 'name', 'lat' y 'lng' son obligatorias."
    ]));
}

// Preparar la consulta para actualizar la imagen en la tabla.
// Se actualizan original_name, lat y lng, utilizando filename como criterio.
$updateStmt = $conn->prepare("UPDATE images SET original_name = ?, lat = ?, lng = ? WHERE filename = ?");
if (!$updateStmt) {
    fclose($handle);
    http_response_code(500);
    exit(json_encode(["success" => false, "message" => "Error preparando consulta: " . $conn->error]));
}

$updateCount = 0;
$errorCount = 0;

// Procesar cada fila del CSV
while (($row = fgetcsv($handle)) !== false) {
    $filename = trim($row[$filenameIndex]);
    $newName  = trim($row[$nameIndex]);
    $latVal   = trim($row[$latIndex]);
    $lngVal   = trim($row[$lngIndex]);

    // Si no hay filename, saltar la fila
    if (empty($filename)) {
        continue;
    }

    // Convertir lat y lng a valores float; si no son numéricos se usarán como NULL
    $latFloat = is_numeric($latVal) ? floatval($latVal) : null;
    $lngFloat = is_numeric($lngVal) ? floatval($lngVal) : null;

    // Bindear parámetros: original_name (string), lat (double), lng (double), filename (string)
    // Se usa 'sdds' en bind_param ("s" string, "d" double)
    $updateStmt->bind_param("sdds", $newName, $latFloat, $lngFloat, $filename);
    if ($updateStmt->execute()) {
        if ($updateStmt->affected_rows > 0) {
            $updateCount++;
        }
    } else {
        error_log("Error actualizando imagen con filename $filename: " . $updateStmt->error);
        $errorCount++;
    }
}

fclose($handle);
$updateStmt->close();
$conn->close();

$response = [
    "success" => true,
    "message" => "Metadata actualizada.",
    "updated" => $updateCount,
    "errors" => $errorCount
];

header("Content-Type: application/json");
echo json_encode($response);
exit;
?>
