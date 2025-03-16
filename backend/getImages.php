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

/**
 * NUEVO: Revisar si viene ?filename=...
 * Si viene, devolvemos SÓLO esa imagen (si existe), con su ID, archived, etc.
 */
$filenameParam = isset($_GET['filename']) ? trim($_GET['filename']) : '';
if (!empty($filenameParam)) {
    // Consulta exacta por filename, incluyendo el valor de city
    $sql = "SELECT id, filename, original_name, archived, uploaded_at, city
            FROM images
            WHERE filename = ?
            LIMIT 1";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param('s', $filenameParam);
    $stmt->execute();
    $result = $stmt->get_result();
    $stmt->close();

    $images = [];
    while ($row = $result->fetch_assoc()) {
        $row['public_url'] = $publicUrlBase . "getImage.php?file=" . urlencode($row['filename']);
        $images[] = $row;
    }

    $conn->close();

    // Salida JSON y terminamos
    echo json_encode([
        "success" => true,
        "count" => count($images),
        "images" => $images
    ]);
    exit;
}

/**
 * Si NO vino ?filename=..., usamos la lógica que ya tenías
 * (filtrado por ?archived=..., ?with_tags=..., etc.)
 */

// Recibimos 'archived' y 'with_tags' de $_GET
$archivedParam = isset($_GET['archived']) ? intval($_GET['archived']) : 0;
$withTagsParam = isset($_GET['with_tags']) ? $_GET['with_tags'] : null; 
    // null si no viene, '0' o '1' si viene

// Posible lectura de 'exclude_ids'
$excludeIdsParam = isset($_GET['exclude_ids']) ? $_GET['exclude_ids'] : '';
$excludeIdsArray = [];
if (!empty($excludeIdsParam)) {
    $excludeIdsArray = array_map('intval', explode(',', $excludeIdsParam));
}

// Armamos la query en función de archived y with_tags
// (Si with_tags no está, usamos la lógica "vieja"; si está =1 => con tags; si está=0 => sin tags.)

if ($withTagsParam === '1') {
    // --> SOLO imágenes CON tags
    // Usamos un INNER JOIN con image_tags para que vengan sólo las que tienen al menos 1 tag
    if (!empty($excludeIdsArray)) {
        // Existen exclude_ids
        $placeholders = implode(',', array_fill(0, count($excludeIdsArray), '?'));
        $sql = "SELECT i.id, i.filename, i.original_name, i.archived, i.uploaded_at, i.city
                FROM images i
                INNER JOIN image_tags it ON i.id = it.image_id
                WHERE i.archived = ?
                  AND i.id NOT IN ($placeholders)
                GROUP BY i.id
                ORDER BY RAND()
                LIMIT 500";
        $stmt = $conn->prepare($sql);
        
        $types = 'i' . str_repeat('i', count($excludeIdsArray));
        $bindValues = array_merge([$archivedParam], $excludeIdsArray);
        $stmt->bind_param($types, ...$bindValues);
    } else {
        // Sin exclude_ids
        $sql = "SELECT i.id, i.filename, i.original_name, i.archived, i.uploaded_at, i.city
                FROM images i
                INNER JOIN image_tags it ON i.id = it.image_id
                WHERE i.archived = ?
                GROUP BY i.id
                ORDER BY RAND()
                LIMIT 500";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('i', $archivedParam);
    }

} elseif ($withTagsParam === '0') {
    // --> SOLO imágenes SIN tags
    // Usamos un LEFT JOIN con image_tags y pedimos las que NO tienen relación.
    if (!empty($excludeIdsArray)) {
        $placeholders = implode(',', array_fill(0, count($excludeIdsArray), '?'));
        $sql = "SELECT i.id, i.filename, i.original_name, i.archived, i.uploaded_at, i.city
                FROM images i
                LEFT JOIN image_tags it ON i.id = it.image_id
                WHERE i.archived = ?
                  AND i.id NOT IN ($placeholders)
                  AND it.image_id IS NULL
                ORDER BY RAND()
                LIMIT 500";
        $stmt = $conn->prepare($sql);
        
        $types = 'i' . str_repeat('i', count($excludeIdsArray));
        $bindValues = array_merge([$archivedParam], $excludeIdsArray);
        $stmt->bind_param($types, ...$bindValues);
    } else {
        $sql = "SELECT i.id, i.filename, i.original_name, i.archived, i.uploaded_at, i.city
                FROM images i
                LEFT JOIN image_tags it ON i.id = it.image_id
                WHERE i.archived = ?
                  AND it.image_id IS NULL
                ORDER BY RAND()
                LIMIT 500";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('i', $archivedParam);
    }

} else {
    // --> Lógica vieja: TODAS las imágenes, con archived=? y limit=500
    if (!empty($excludeIdsArray)) {
        $placeholders = implode(',', array_fill(0, count($excludeIdsArray), '?'));
        $sql = "SELECT id, filename, original_name, archived, uploaded_at, city
                FROM images
                WHERE archived = ?
                  AND id NOT IN ($placeholders)
                ORDER BY RAND()
                LIMIT 500";
        $stmt = $conn->prepare($sql);
        
        $types = 'i' . str_repeat('i', count($excludeIdsArray));
        $bindValues = array_merge([$archivedParam], $excludeIdsArray);
        $stmt->bind_param($types, ...$bindValues);
    } else {
        $sql = "SELECT id, filename, original_name, archived, uploaded_at, city
                FROM images
                WHERE archived = ?
                ORDER BY RAND()
                LIMIT 500";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('i', $archivedParam);
    }
}

// Ejecutamos la consulta
$stmt->execute();
$result = $stmt->get_result();
$stmt->close();

// Construimos el array de imágenes
$images = [];
while ($row = $result->fetch_assoc()) {
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
