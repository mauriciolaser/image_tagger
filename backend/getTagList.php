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

// Se consulta la frecuencia de cada tag agrupando por nombre
$sql = "SELECT t.name AS tag_name, COUNT(*) AS frequency
        FROM image_tags it
        INNER JOIN tags t ON it.tag_id = t.id
        GROUP BY t.name
        ORDER BY frequency DESC";
$stmt = $pdo->query($sql);
$tags = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode([
    'success' => true,
    'tags'    => $tags
]);
exit;
?>
