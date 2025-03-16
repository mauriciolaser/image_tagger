<?php
require __DIR__ . '/vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

// Datos de conexión
$db_host = $_ENV['DB_HOST'];
$db_user = $_ENV['DB_USER'];
$db_pass = $_ENV['DB_PASS'];
$db_name = $_ENV['DB_NAME'];
$db_port = $_ENV['DB_PORT'] ?? 3306;

$conn = new mysqli($db_host, $db_user, $db_pass, $db_name, $db_port);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Database connection error"]);
    exit;
}

$publicUrlBase = $_ENV['PUBLIC_URL_BASE'];

// ------------------------------------------------------
// Lee parámetros para paginación y filtrado
// ------------------------------------------------------
$archivedParam = isset($_GET['archived']) ? intval($_GET['archived']) : 0;
$withTagsParam = isset($_GET['with_tags']) ? $_GET['with_tags'] : null;  // '1', '0', o null
$pageParam     = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1; // Asegurarnos que sea >= 1
$limit         = 500;
$offset        = ($pageParam - 1) * $limit;

// Armamos la query base según si queremos solo con tags o sin tags
$sql = '';
$stmt = null;

if ($withTagsParam === '1') {
    // *** Imágenes CON tags ***
    // INNER JOIN con image_tags para traer solo las que tienen al menos 1 tag
    // Usamos GROUP BY i.id para evitar duplicados si la imagen tiene varios tags
    $sql = "
        SELECT i.id, i.filename, i.original_name, i.uploaded_at, i.city
        FROM images i
        INNER JOIN image_tags it ON i.id = it.image_id
        WHERE i.archived = ?
        GROUP BY i.id
        ORDER BY i.id DESC
        LIMIT ? OFFSET ?
    ";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param('iii', $archivedParam, $limit, $offset);

} elseif ($withTagsParam === '0') {
    // *** Imágenes SIN tags ***
    // LEFT JOIN + it.image_id IS NULL para traer solo las que no tienen registros en image_tags
    $sql = "
        SELECT i.id, i.filename, i.original_name, i.uploaded_at, i.city
        FROM images i
        LEFT JOIN image_tags it ON i.id = it.image_id
        WHERE i.archived = ?
          AND it.image_id IS NULL
        ORDER BY i.id DESC
        LIMIT ? OFFSET ?
    ";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param('iii', $archivedParam, $limit, $offset);

} else {
    // *** Lógica por defecto: TODAS las imágenes (archived=?)
    $sql = "
        SELECT i.id, i.filename, i.original_name, i.uploaded_at, i.city
        FROM images i
        WHERE i.archived = ?
        ORDER BY i.id DESC
        LIMIT ? OFFSET ?
    ";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param('iii', $archivedParam, $limit, $offset);
}

// Ejecutamos
$stmt->execute();
$result = $stmt->get_result();
$stmt->close();

// Construimos el array de imágenes
$images = [];
while ($row = $result->fetch_assoc()) {
    // Agregamos public_url si te sirve
    $row['public_url'] = $publicUrlBase . "getImage.php?file=" . urlencode($row['filename']);
    $images[] = $row;
}

$conn->close();

// Respuesta JSON
echo json_encode([
    "success" => true,
    "count" => count($images),
    "images" => $images
]);
