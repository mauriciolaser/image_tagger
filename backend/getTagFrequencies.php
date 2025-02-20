<?php
header('Content-Type: application/json; charset=utf-8');

// Configuración de la conexión a la base de datos usando variables de entorno
$db_host = $_ENV['DB_HOST'];
$db_user = $_ENV['DB_USER'];
$db_pass = $_ENV['DB_PASS'];
$db_name = $_ENV['DB_NAME'];
$db_port = $_ENV['DB_PORT'] ?? 3306;

try {
    // Usamos utf8mb4 para soportar la mayor cantidad de caracteres especiales
    $pdo = new PDO("mysql:host=$db_host;port=$db_port;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Error de conexión: ' . $e->getMessage()
    ]);
    exit;
}

// Verificar que se haya recibido el parámetro "tags"
if (!isset($_GET['tags'])) {
    echo json_encode([
        'success' => false,
        'message' => 'Parámetro "tags" no proporcionado'
    ]);
    exit;
}

// Decodificar el parámetro "tags" (se espera un array en formato JSON)
$tags = json_decode($_GET['tags'], true);
if (!is_array($tags)) {
    echo json_encode([
        'success' => false,
        'message' => 'Parámetro "tags" debe ser un array de tags'
    ]);
    exit;
}

if (empty($tags)) {
    echo json_encode([
        'success' => false,
        'message' => 'No se proporcionaron tags'
    ]);
    exit;
}

// Preparar la consulta SQL usando placeholders para evitar inyección SQL
$placeholders = implode(',', array_fill(0, count($tags), '?'));
$sql = "SELECT t.name AS tag_name, COUNT(*) AS frequency
        FROM image_tags it
        INNER JOIN tags t ON it.tag_id = t.id
        WHERE t.name IN ($placeholders)
        GROUP BY t.name";

$stmt = $pdo->prepare($sql);
$stmt->execute($tags);
$results = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Construir la respuesta: incluir todos los tags solicitados, asignando frecuencia 0 si no hay coincidencias
$frequencies = [];
foreach ($tags as $tag) {
    $found = false;
    foreach ($results as $row) {
        if ($row['tag_name'] === $tag) {
            $frequencies[] = $row;
            $found = true;
            break;
        }
    }
    if (!$found) {
        $frequencies[] = ['tag_name' => $tag, 'frequency' => 0];
    }
}

echo json_encode([
    'success' => true,
    'tags'    => $frequencies
]);
exit;
?>
