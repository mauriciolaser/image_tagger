<?php
require __DIR__ . '/vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Configurar headers
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit(json_encode(["success" => false, "message" => "Método no permitido"]));
}

// Obtener ruta base desde .env
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

// Validar archivos subidos
if (empty($_FILES['images']['tmp_name'][0])) {
    http_response_code(400);
    exit(json_encode(["success" => false, "message" => "No se detectaron archivos"]));
}

// Validar user_id
$user_id = filter_input(INPUT_POST, 'user_id', FILTER_VALIDATE_INT);
if (!$user_id) {
    http_response_code(400);
    exit(json_encode(["success" => false, "message" => "ID de usuario inválido"]));
}

// Configuración de base de datos
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

// Después de validar $user_id
$userCheck = $conn->prepare("SELECT id FROM users WHERE id = ?");
$userCheck->bind_param("i", $user_id);
$userCheck->execute();
if ($userCheck->get_result()->num_rows === 0) {
    http_response_code(404);
    exit(json_encode(["success" => false, "message" => "Usuario no existe"]));
}

// Procesar archivos
$results = [];
foreach ($_FILES['images']['tmp_name'] as $key => $tmpName) {
    $originalName = basename($_FILES['images']['name'][$key]);
    
    // Generar nombre único seguro
    $fileHash = hash_file('sha256', $tmpName);
    $extension = pathinfo($originalName, PATHINFO_EXTENSION);
    $newFilename = $fileHash . '_' . bin2hex(random_bytes(4)) . ($extension === 'webp' ? '.webp' : '.webp');
    $destination = $uploadDir . $newFilename;

    // Validar tipo MIME
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($tmpName);
    
    if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'])) {
        $results[] = [
            "original_name" => $originalName,
            "success" => false,
            "message" => "Tipo de archivo no permitido: $mime"
        ];
        continue;
    }

    // Si el archivo ya es WebP, solo moverlo sin convertir
    if ($mime === 'image/webp') {
        if (!move_uploaded_file($tmpName, $destination)) {
            $results[] = [
                "original_name" => $originalName,
                "success" => false,
                "message" => "Error moviendo archivo WebP"
            ];
            continue;
        }
    } else {
        // Convertir a WebP
        try {
            $img = match($mime) {
                'image/jpeg' => imagecreatefromjpeg($tmpName),
                'image/png' => imagecreatefrompng($tmpName),
            };
            
            if (!imagewebp($img, $destination, 80)) {
                throw new Exception("Error en conversión");
            }
            imagedestroy($img);
        } catch (Exception $e) {
            $results[] = [
                "original_name" => $originalName,
                "success" => false,
                "message" => "Error procesando imagen"
            ];
            continue;
        }
    }

    // Registrar en BD
    try {
        $stmt = $conn->prepare("INSERT INTO images (filename, original_name, path, uploaded_by) VALUES (?, ?, ?, ?)");
        $pathForDB = 'uploads/' . $newFilename; // Ruta relativa
        $stmt->bind_param("sssi", $newFilename, $originalName, $pathForDB, $user_id);
        $stmt->execute();
        
        $results[] = [
            "original_name" => $originalName,
            "success" => true,
            "path" => $pathForDB,
            "db_id" => $stmt->insert_id
        ];
    } catch (mysqli_sql_exception $e) {
        $results[] = [
            "original_name" => $originalName,
            "success" => false,
            "message" => "Error en base de datos"
        ];
    }
    $stmt->close();
}

$conn->close();

// Respuesta final
$successCount = count(array_filter($results, fn($r) => $r['success']));
http_response_code($successCount > 0 ? 200 : 400);
exit(json_encode([
    "success" => $successCount > 0,
    "upload_dir" => $uploadDir, // Para depuración
    "results" => $results
]));
?>
