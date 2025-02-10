<?php
require __DIR__ . '/vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Configurar headers
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Permitir solo GET y POST
if (!in_array($_SERVER['REQUEST_METHOD'], ['POST', 'GET'])) {
    http_response_code(405);
    exit(json_encode(["success" => false, "message" => "Método no permitido"]));
}

// Obtener ruta base desde .env y configurar directorio de destino (uploads)
$backendBasePath = $_ENV['BACKEND_BASE_PATH'] ?? __DIR__;
$uploadDir = rtrim($backendBasePath, '/') . '/uploads/';

// Verificar/crear directorio de uploads
if (!is_dir($uploadDir)) {
    if (!mkdir($uploadDir, 0750, true)) {
        http_response_code(500);
        exit(json_encode([
            "success" => false,
            "message" => "No se pudo crear el directorio: $uploadDir"
        ]));
    }
}

// Obtener y validar user_id: se busca en POST y si no existe, en GET
$user_id = filter_input(INPUT_POST, 'user_id', FILTER_VALIDATE_INT);
if (!$user_id) {
    $user_id = filter_input(INPUT_GET, 'user_id', FILTER_VALIDATE_INT);
}
if (!$user_id) {
    http_response_code(400);
    exit(json_encode(["success" => false, "message" => "ID de usuario inválido"]));
}

// Conectar a la base de datos usando mysqli y variables de entorno
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

// Verificar que el usuario exista en la BD
$userCheck = $conn->prepare("SELECT id FROM users WHERE id = ?");
$userCheck->bind_param("i", $user_id);
$userCheck->execute();
if ($userCheck->get_result()->num_rows === 0) {
    http_response_code(404);
    exit(json_encode(["success" => false, "message" => "Usuario no existe"]));
}

// Obtener el directorio de origen de imágenes desde la variable de entorno PRIVATE_IMAGES_DIR
$sourceDir = getenv('PRIVATE_IMAGES_DIR');
if (!$sourceDir) {
    http_response_code(500);
    exit(json_encode(["success" => false, "message" => "La variable de entorno PRIVATE_IMAGES_DIR no está definida."]));
}
$sourceDir = rtrim($sourceDir, '/');

// Verificar que el directorio de origen exista
if (!is_dir($sourceDir)) {
    http_response_code(500);
    exit(json_encode(["success" => false, "message" => "El directorio de imágenes no existe: $sourceDir"]));
}

$results = [];
$files = scandir($sourceDir);
foreach ($files as $file) {
    if ($file === '.' || $file === '..') {
        continue;
    }
    
    $sourcePath = $sourceDir . '/' . $file;
    if (!is_file($sourcePath)) {
        continue;
    }
    
    $originalName = basename($file);
    
    // Verificar si la imagen ya fue importada (basado en original_name)
    $stmtCheck = $conn->prepare("SELECT COUNT(*) as count FROM images WHERE original_name = ?");
    $stmtCheck->bind_param("s", $originalName);
    $stmtCheck->execute();
    $checkResult = $stmtCheck->get_result()->fetch_assoc();
    if ($checkResult['count'] > 0) {
        $results[] = [
            "original_name" => $originalName,
            "success" => false,
            "message" => "Imagen ya importada"
        ];
        continue;
    }
    
    // Validar tipo MIME (solo imágenes permitidas)
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($sourcePath);
    if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'])) {
        $results[] = [
            "original_name" => $originalName,
            "success" => false,
            "message" => "Tipo de archivo no permitido: $mime"
        ];
        continue;
    }
    
    // Generar un nombre único seguro (usando el hash del archivo y manteniendo la extensión original)
    $fileHash = hash_file('sha256', $sourcePath);
    $extension = pathinfo($originalName, PATHINFO_EXTENSION);
    $newFilename = $fileHash . '_' . bin2hex(random_bytes(4)) . '.' . $extension;
    $destination = $uploadDir . $newFilename;
    
    // Mover el archivo al directorio de uploads
    if (!rename($sourcePath, $destination)) {
        $results[] = [
            "original_name" => $originalName,
            "success" => false,
            "message" => "Error moviendo archivo"
        ];
        continue;
    }
    
    // Registrar la imagen en la base de datos
    try {
        // Se incluye el campo archived con valor FALSE (0)
        $stmt = $conn->prepare("INSERT INTO images (filename, original_name, path, uploaded_by, archived) VALUES (?, ?, ?, ?, 0)");
        $pathForDB = 'uploads/' . $newFilename; // Ruta relativa para la BD
        $stmt->bind_param("sssi", $newFilename, $originalName, $pathForDB, $user_id);
        $stmt->execute();
        
        $results[] = [
            "original_name" => $originalName,
            "success" => true,
            "path" => $pathForDB,
            "db_id" => $stmt->insert_id
        ];
        $stmt->close();
    } catch (mysqli_sql_exception $e) {
        $results[] = [
            "original_name" => $originalName,
            "success" => false,
            "message" => "Error en base de datos"
        ];
    }
}

// Cerrar la conexión a la BD
$conn->close();

$successCount = count(array_filter($results, fn($r) => $r['success']));
http_response_code($successCount > 0 ? 200 : 400);
exit(json_encode([
    "success" => $successCount > 0,
    "upload_dir" => $uploadDir, // Para depuración
    "results" => $results
]));
