<?php
require __DIR__ . '/vendor/autoload.php';

// Cargar variables de entorno desde `.env`
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Encabezados para forzar la descarga del CSV
header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename=export_images.csv');

// Configuración de la conexión a la base de datos desde .env
$db_host = $_ENV['DB_HOST'];
$db_user = $_ENV['DB_USER'];
$db_pass = $_ENV['DB_PASS'];
$db_name = $_ENV['DB_NAME'];
$db_port = $_ENV['DB_PORT'] ?? 3306;

$conn = new mysqli($db_host, $db_user, $db_pass, $db_name, $db_port);
if ($conn->connect_error) {
    die("Database connection error: " . $conn->connect_error);
}

// Consulta para obtener todas las imágenes y TODOS los tags asociados a cada imagen
$sql = "
SELECT 
    i.id, 
    i.original_name, 
    IFNULL(GROUP_CONCAT(DISTINCT t.name ORDER BY t.name SEPARATOR ', '), '') AS tags
FROM images i
LEFT JOIN image_tags it ON i.id = it.image_id
LEFT JOIN tags t ON it.tag_id = t.id
GROUP BY i.id
ORDER BY i.uploaded_at DESC
";

$stmt = $conn->prepare($sql);
$stmt->execute();
$result = $stmt->get_result();

// Abrir la salida (stdout) para escribir el CSV
$output = fopen('php://output', 'w');

// Escribir la cabecera del CSV
fputcsv($output, ['ID Imagen', 'Nombre de Imagen', 'Tags']);

// Recorrer los resultados y escribir cada línea en el CSV
while ($row = $result->fetch_assoc()) {
    fputcsv($output, [$row['id'], $row['original_name'], $row['tags']]);
}

fclose($output);
$stmt->close();
$conn->close();
?>
