<?php
require __DIR__ . '/vendor/autoload.php';

// Cargar variables de entorno desde `.env`
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Encabezados CORS y configuración de contenido
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: *"); // Permitir todos los headers
header("Access-Control-Allow-Credentials: true"); // Si necesitas credenciales

// Manejar la solicitud preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Verificar que la solicitud sea POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Method not allowed"]);
    exit;
}

// Verificar que se hayan enviado archivos
if (!isset($_FILES['images']) || empty($_FILES['images']['name'])) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "No files uploaded"]);
    exit;
}

// Verificar si user_id está presente en la solicitud
if (!isset($_POST['user_id']) || empty($_POST['user_id'])) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "User ID is required"]);
    exit;
}

$user_id = intval($_POST['user_id']); // Convertir a entero para evitar inyección SQL

// Registrar en el log la estructura completa de $_FILES para depuración
error_log("FILES: " . print_r($_FILES, true));

// Configuración de la conexión a la base de datos desde .env
$db_host = $_ENV['DB_HOST'];
$db_user = $_ENV['DB_USER'];
$db_pass = $_ENV['DB_PASS'];
$db_name = $_ENV['DB_NAME'];
$db_port = $_ENV['DB_PORT'] ?? 3306;

// Conectar a la base de datos usando mysqli
$conn = new mysqli($db_host, $db_user, $db_pass, $db_name, $db_port);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Database connection error"]);
    exit;
}

// Definir el directorio donde se guardarán las imágenes convertidas
$uploadDir = __DIR__ . '/../public_html/image_tagger/uploads/';
// Si la carpeta no existe, se crea con permisos 0755
if (!is_dir($uploadDir)) {
    if (!mkdir($uploadDir, 0755, true)) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Failed to create uploads directory"]);
        exit;
    }
}

// Normalizar los arrays de archivos
$tmpNames = $_FILES['images']['tmp_name'];
$fileNames = $_FILES['images']['name'];
$fileErrors = $_FILES['images']['error'];

if (!is_array($tmpNames)) {
    $tmpNames = [$tmpNames];
    $fileNames = [$fileNames];
    $fileErrors = [$fileErrors];
}

// Registrar en el log la cantidad de archivos recibidos
error_log("Cantidad de archivos recibidos: " . count($tmpNames));

// Array para almacenar resultados de cada archivo procesado
$results = [];

// Procesar cada archivo subido
foreach ($tmpNames as $key => $tmpName) {
    // Verificar errores de subida
    if ($fileErrors[$key] !== UPLOAD_ERR_OK) {
        $results[] = [
            "original_name" => $fileNames[$key],
            "success" => false,
            "message" => "Error during file upload."
        ];
        continue;
    }

    // Validar que el archivo es una imagen
    $imageInfo = getimagesize($tmpName);
    if ($imageInfo === false) {
        $results[] = [
            "original_name" => $fileNames[$key],
            "success" => false,
            "message" => "File is not a valid image."
        ];
        continue;
    }
    
    // Calcular el hash MD5 del archivo para detectar duplicados
    $fileHash = md5_file($tmpName);
    // Consultar si ya existe un registro con ese hash en la base de datos
    $dupStmt = $conn->prepare("SELECT id FROM images WHERE file_hash = ?");
    $dupStmt->bind_param("s", $fileHash);
    $dupStmt->execute();
    $dupResult = $dupStmt->get_result();
    if ($dupResult->num_rows > 0) {
        $results[] = [
            "original_name" => $fileNames[$key],
            "success" => false,
            "message" => "File already exists."
        ];
        $dupStmt->close();
        continue;
    }
    $dupStmt->close();

    // Determinar el tipo MIME para usar la función adecuada
    $mime = $imageInfo['mime'];
    switch ($mime) {
        case 'image/jpeg':
            $imgResource = imagecreatefromjpeg($tmpName);
            break;
        case 'image/png':
            $imgResource = imagecreatefrompng($tmpName);
            break;
        case 'image/gif':
            $imgResource = imagecreatefromgif($tmpName);
            break;
        default:
            $results[] = [
                "original_name" => $fileNames[$key],
                "success" => false,
                "message" => "Unsupported image type."
            ];
            continue 2;
    }

    if (!$imgResource) {
        $results[] = [
            "original_name" => $fileNames[$key],
            "success" => false,
            "message" => "Failed to create image resource."
        ];
        continue;
    }

    // Generar un nombre único para el archivo WebP
    $newFilename = uniqid('img_', true) . '.webp';
    $destination = $uploadDir . $newFilename;

    // Convertir y guardar la imagen a WebP (calidad 80)
    if (!imagewebp($imgResource, $destination, 80)) {
        $results[] = [
            "original_name" => $fileNames[$key],
            "success" => false,
            "message" => "Failed to convert image to WebP."
        ];
        imagedestroy($imgResource);
        continue;
    }

    // Liberar recursos de la imagen
    imagedestroy($imgResource);

    // Registrar la imagen en la base de datos
    // Se asume que la tabla "images" tiene los campos: filename, original_name, path, file_hash, uploaded_by
    $pathForDB = '/image_tagger/uploads/' . $newFilename; // Ruta relativa
    $stmt = $conn->prepare("INSERT INTO images (filename, original_name, path, file_hash, uploaded_by) VALUES (?, ?, ?, ?, ?)");
    $stmt->bind_param("ssssi", $newFilename, $fileNames[$key], $pathForDB, $fileHash, $user_id);

    $stmt->execute();
    if ($stmt->affected_rows > 0) {
        $results[] = [
            "original_name" => $fileNames[$key],
            "success" => true,
            "message" => "Image converted and uploaded successfully.",
            "webp_file" => $newFilename,
            "db_id" => $stmt->insert_id
        ];
    } else {
        $results[] = [
            "original_name" => $fileNames[$key],
            "success" => false,
            "message" => "Image converted but failed to register in database."
        ];
    }
    $stmt->close();
}

// Cerrar conexión a la base de datos
$conn->close();

// Responder en JSON con los resultados
http_response_code(200);
echo json_encode(["results" => $results]);
?>
