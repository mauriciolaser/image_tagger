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

// Se determina la acción, ya sea enviada por GET o POST
$action = $_GET['action'] ?? $_POST['action'] ?? '';

if ($action === 'getAllTags') {
    // Opcional: recibir un listado de IDs de imágenes (por ejemplo: "1,2,3")
    $image_ids_param = $_GET['image_ids'] ?? null;
    
    if ($image_ids_param) {
        // Se separa la cadena y se filtran los valores que sean numéricos
        $image_ids = array_filter(explode(',', $image_ids_param), function($id) {
            return is_numeric($id);
        });
        
        if (!empty($image_ids)) {
            // Se generan los placeholders para la consulta preparada
            $placeholders = implode(',', array_fill(0, count($image_ids), '?'));
            $sql = "SELECT it.image_id, t.id AS tag_id, t.name AS tag_name, it.user_id, u.username 
                    FROM image_tags it
                    INNER JOIN tags t ON it.tag_id = t.id 
                    INNER JOIN users u ON it.user_id = u.id 
                    WHERE it.image_id IN ($placeholders)";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($image_ids);
        } else {
            // Si no se obtuvieron IDs válidos, se opta por traer todos los tags
            $stmt = $pdo->query("SELECT it.image_id, t.id AS tag_id, t.name AS tag_name, it.user_id, u.username 
                                 FROM image_tags it
                                 INNER JOIN tags t ON it.tag_id = t.id 
                                 INNER JOIN users u ON it.user_id = u.id");
        }
    } else {
        // Si no se especifica image_ids, se obtienen los tags de todas las imágenes
        $stmt = $pdo->query("SELECT it.image_id, t.id AS tag_id, t.name AS tag_name, it.user_id, u.username 
                             FROM image_tags it
                             INNER JOIN tags t ON it.tag_id = t.id 
                             INNER JOIN users u ON it.user_id = u.id");
    }

    $tags = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Se estructura la respuesta agrupando los tags por image_id
    $result = [];
    foreach ($tags as $tag) {
        $result[$tag['image_id']][] = [
            'id'       => $tag['tag_id'],
            'name'     => $tag['tag_name'],
            'user_id'  => $tag['user_id'],
            'username' => $tag['username']
        ];
    }

    echo json_encode([
        'success' => true,
        'tags'    => $result
    ]);
    exit;
} else {
    echo json_encode([
        'success' => false,
        'message' => 'Acción no válida.'
    ]);
    exit;
}
?>