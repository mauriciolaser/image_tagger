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

if ($action === 'getImageTags') {
    // Se obtiene el user_id (obligatorio)
    $user_id = $_GET['user_id'] ?? null;
    if (!$user_id) {
        echo json_encode([
            'success' => false,
            'message' => 'Faltan parámetros: user_id'
        ]);
        exit;
    }
    
    // Si no se envía image_id, se devuelven las imágenes del usuario
    if (!isset($_GET['image_id'])) {
        // Soporte opcional de paginación
        $page = isset($_GET['page']) ? (int)$_GET['page'] : null;
        if ($page) {
            $limit  = 500; // Imágenes por página
            $offset = ($page - 1) * $limit;
            $stmt = $pdo->prepare("SELECT id, filename, original_name FROM images WHERE uploaded_by = ? ORDER BY id DESC LIMIT ? OFFSET ?");
            $stmt->bindParam(1, $user_id, PDO::PARAM_INT);
            $stmt->bindParam(2, $limit, PDO::PARAM_INT);
            $stmt->bindParam(3, $offset, PDO::PARAM_INT);
            $stmt->execute();
        } else {
            $stmt = $pdo->prepare("SELECT id, filename, original_name FROM images WHERE uploaded_by = ? ORDER BY id DESC");
            $stmt->execute([$user_id]);
        }
        $images = $stmt->fetchAll(PDO::FETCH_ASSOC);
        // Inicializa el array de tags para cada imagen (vacío)
        foreach ($images as &$img) {
            $img['tags'] = [];
        }
        echo json_encode([
            'success' => true,
            'images'  => $images
        ]);
        exit;
    }
    
    // Si se envía image_id, se consultan los tags para esa imagen
    $image_id = $_GET['image_id'];
    $others   = $_GET['others'] ?? 0; // Si se pasa others=1, se consultarán los tags de otros usuarios

    if ($others == 1) {
        // Tags asignados por otros usuarios (excluyendo el usuario actual)
        $stmt = $pdo->prepare("SELECT t.id, t.name, it.user_id, u.username 
                               FROM image_tags it
                               INNER JOIN tags t ON it.tag_id = t.id 
                               INNER JOIN users u ON it.user_id = u.id 
                               WHERE it.image_id = ? AND it.user_id != ?");
        $stmt->execute([$image_id, $user_id]);
    } else {
        // Tags asignados por el usuario actual
        $stmt = $pdo->prepare("SELECT t.id, t.name, it.user_id, u.username 
                               FROM image_tags it
                               INNER JOIN tags t ON it.tag_id = t.id 
                               INNER JOIN users u ON it.user_id = u.id 
                               WHERE it.image_id = ? AND it.user_id = ?");
        $stmt->execute([$image_id, $user_id]);
    }
    $tags = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'images'  => [
            [
                'id'   => $image_id,
                'tags' => $tags
            ]
        ]
    ]);
    exit;
} elseif ($action === 'tagImage') {
    // Se espera recibir por POST: image_id, tag y user_id
    $image_id = $_POST['image_id'] ?? null;
    $tag      = $_POST['tag'] ?? '';
    $user_id  = $_POST['user_id'] ?? null;

    if (!$image_id || !$tag || !$user_id) {
        echo json_encode([
            'success' => false,
            'message' => 'Faltan parámetros.'
        ]);
        exit;
    }

    try {
        // Verificar si el tag ya existe en la tabla tags
        $stmt = $pdo->prepare("SELECT id FROM tags WHERE name = ?");
        $stmt->execute([$tag]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($existing) {
            $tag_id = $existing['id'];
        } else {
            // Inserta el tag en la tabla tags (la relación se guarda en image_tags)
            $stmt = $pdo->prepare("INSERT INTO tags (name, created_by) VALUES (?, ?)");
            $stmt->execute([$tag, $user_id]);
            $tag_id = $pdo->lastInsertId();
        }
        // Inserta la relación en image_tags
        $stmt = $pdo->prepare("INSERT INTO image_tags (image_id, tag_id, user_id, tagged_at) VALUES (?, ?, ?, NOW())");
        $stmt->execute([$image_id, $tag_id, $user_id]);

        echo json_encode([
            'success' => true,
            'message' => 'Tag agregado correctamente.'
        ]);
    } catch (PDOException $e) {
        echo json_encode([
            'success' => false,
            'message' => 'Error al agregar el tag: ' . $e->getMessage()
        ]);
    }
    exit;
} elseif ($action === 'deleteTag') {
    // Se espera recibir por POST: image_id, tag_id y user_id
    $image_id = $_POST['image_id'] ?? null;
    $tag_id   = $_POST['tag_id'] ?? null;
    $user_id  = $_POST['user_id'] ?? null;

    if (!$image_id || !$tag_id || !$user_id) {
        echo json_encode([
            'success' => false,
            'message' => 'Faltan parámetros.'
        ]);
        exit;
    }

    try {
        // Se elimina la relación en image_tags, verificando que pertenezca al usuario actual
        $stmt = $pdo->prepare("DELETE FROM image_tags WHERE tag_id = ? AND image_id = ? AND user_id = ?");
        $stmt->execute([$tag_id, $image_id, $user_id]);
        if ($stmt->rowCount() > 0) {
            echo json_encode([
                'success' => true,
                'message' => 'Tag eliminado correctamente.'
            ]);
        } else {
            echo json_encode([
                'success' => false,
                'message' => 'No se encontró el tag o no tienes permiso para eliminarlo.'
            ]);
        }
    } catch (PDOException $e) {
        echo json_encode([
            'success' => false,
            'message' => 'Error al eliminar el tag: ' . $e->getMessage()
        ]);
    }
    exit;
} else {
    echo json_encode([
        'success' => false,
        'message' => 'Acción no válida.'
    ]);
    exit;
}
?>
