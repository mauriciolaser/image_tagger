<?php
// Configuración de la conexión a la base de datos
$host     = 'localhost';
$dbname   = 'tu_basededatos';
$username = 'tu_usuario';
$password = 'tu_contraseña';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $username, $password);
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
    // Se obtienen los parámetros
    $image_id = $_GET['image_id'] ?? null;
    $user_id  = $_GET['user_id'] ?? null;
    $others   = $_GET['others'] ?? 0; // Si se pasa others=1 se consultarán los tags de otros usuarios

    if (!$image_id || !$user_id) {
        echo json_encode([
            'success' => false,
            'message' => 'Faltan parámetros.'
        ]);
        exit;
    }

    if ($others == 1) {
        // Consulta para obtener los tags de otros usuarios (excluyendo el usuario actual)
        $stmt = $pdo->prepare("SELECT t.id, t.name, t.user_id, u.username 
                               FROM tags AS t 
                               INNER JOIN users AS u ON t.user_id = u.id 
                               WHERE t.image_id = ? AND t.user_id != ?");
        $stmt->execute([$image_id, $user_id]);
    } else {
        // Consulta para obtener los tags agregados por el usuario actual
        $stmt = $pdo->prepare("SELECT t.id, t.name, t.user_id, u.username 
                               FROM tags AS t 
                               INNER JOIN users AS u ON t.user_id = u.id 
                               WHERE t.image_id = ? AND t.user_id = ?");
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
        // Inserción del tag en la tabla correspondiente (ajusta el nombre de la tabla y columnas si es necesario)
        $stmt = $pdo->prepare("INSERT INTO tags (image_id, user_id, name) VALUES (?, ?, ?)");
        $stmt->execute([$image_id, $user_id, $tag]);

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
        // Se elimina el tag, verificando que pertenezca al usuario actual
        $stmt = $pdo->prepare("DELETE FROM tags WHERE id = ? AND image_id = ? AND user_id = ?");
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
