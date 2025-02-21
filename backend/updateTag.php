<?php
// updateTag.php

// Desactivar la salida de errores para producción
error_reporting(0);
ini_set('display_errors', 0);

require __DIR__ . '/vendor/autoload.php';

// Cargar variables de entorno desde .env
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Encabezados CORS y configuración de contenido
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// Manejar solicitud preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Asegurar que la solicitud sea POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Method not allowed"
    ]);
    exit;
}

// Obtener datos enviados (se asume JSON)
$input = file_get_contents("php://input");
$data = json_decode($input, true);

if (!isset($data['old_tag'], $data['new_tag'])) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Parámetros incompletos"
    ]);
    exit;
}

$old_tag = trim($data['old_tag']);
$new_tag = trim($data['new_tag']);
$confirm = isset($data['confirm']) ? (bool)$data['confirm'] : false;

if (empty($old_tag) || empty($new_tag)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Los nombres no pueden estar vacíos"
    ]);
    exit;
}

// Validar que el nuevo tag no exceda 50 caracteres (según la definición de la tabla)
if (strlen($new_tag) > 50) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "El nuevo tag excede la longitud máxima de 50 caracteres."
    ]);
    exit;
}

// Configuración de la conexión a la base de datos (variables definidas en .env)
$db_host = $_ENV['DB_HOST'];
$db_user = $_ENV['DB_USER'];
$db_pass = $_ENV['DB_PASS'];
$db_name = $_ENV['DB_NAME'];
$db_port = $_ENV['DB_PORT'] ?? 3306;

$conn = new mysqli($db_host, $db_user, $db_pass, $db_name, $db_port);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Error de conexión a la base de datos: " . $conn->connect_error
    ]);
    exit;
}
$conn->set_charset("utf8mb4");

// Consultar cuántos tags tienen el nombre antiguo
$stmt = $conn->prepare("SELECT COUNT(*) AS total FROM tags WHERE name = ?");
if (!$stmt) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Error en la preparación del SELECT: " . $conn->error]);
    exit;
}
$stmt->bind_param("s", $old_tag);
if (!$stmt->execute()) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Error en la ejecución del SELECT: " . $stmt->error]);
    exit;
}
$total = 0;
if (method_exists($stmt, 'get_result')) {
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    $total = (int)$row['total'];
} else {
    $stmt->bind_result($total);
    $stmt->fetch();
}
$stmt->close();

// Si no se ha confirmado, se retorna el número de registros a modificar
if (!$confirm) {
    echo json_encode([
        "success" => true,
        "message" => "Confirmación requerida",
        "total_tags" => $total
    ]);
    $conn->close();
    exit;
}

/*
  Lógica de merge:
  Si el nuevo tag ya existe, se debe:
   1. Obtener el id del tag nuevo.
   2. Obtener todos los ids de los tags con el nombre antiguo.
   3. Actualizar las relaciones en image_tags para cambiar el tag_id de cada uno de los tags antiguos al nuevo,
      pero solo en aquellos casos que no generen duplicados (usando una subconsulta).
   4. Eliminar las filas restantes que aún tengan alguno de los tag_ids antiguos.
   5. Eliminar los registros de la tabla tags que tengan el nombre antiguo.
*/

// Verificar si ya existe un tag con el nuevo nombre
$stmt2 = $conn->prepare("SELECT id FROM tags WHERE name = ?");
$stmt2->bind_param("s", $new_tag);
$stmt2->execute();
$new_tag_id = null;
if (method_exists($stmt2, 'get_result')) {
    $result2 = $stmt2->get_result();
    if ($result2->num_rows > 0) {
        $row2 = $result2->fetch_assoc();
        $new_tag_id = $row2['id'];
    }
} else {
    $stmt2->bind_result($new_tag_id);
    $stmt2->fetch();
}
$stmt2->close();

if ($new_tag_id) {
    // Merge: actualizar relaciones y eliminar los tags antiguos
    
    // Obtener todos los ids de tags con el nombre antiguo
    $stmtOld = $conn->prepare("SELECT id FROM tags WHERE name = ?");
    $stmtOld->bind_param("s", $old_tag);
    $stmtOld->execute();
    $old_tag_ids = [];
    if (method_exists($stmtOld, 'get_result')) {
        $resultOld = $stmtOld->get_result();
        while ($rowOld = $resultOld->fetch_assoc()) {
            $old_tag_ids[] = $rowOld['id'];
        }
    } else {
        $stmtOld->bind_result($old_tag_id);
        while ($stmtOld->fetch()) {
            $old_tag_ids[] = $old_tag_id;
        }
    }
    $stmtOld->close();
    
    if (empty($old_tag_ids)) {
        echo json_encode(["success" => false, "message" => "No se encontró el tag antiguo."]);
        $conn->close();
        exit;
    }
    
    // Paso 1: Actualizar registros de image_tags sin generar duplicados.
    // Se actualizan todos los registros de image_tags que tengan tag_id en $old_tag_ids.
    $placeholders = implode(',', array_fill(0, count($old_tag_ids), '?'));
    $sqlUpdateImageTags = "UPDATE image_tags 
       SET tag_id = ? 
       WHERE tag_id IN ($placeholders)
         AND NOT EXISTS (
           SELECT 1 FROM (SELECT * FROM image_tags) AS t2 
           WHERE t2.image_id = image_tags.image_id 
             AND t2.tag_id = ?
         )";
    $stmtRel = $conn->prepare($sqlUpdateImageTags);
    if (!$stmtRel) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Error en la preparación del UPDATE de relaciones: " . $conn->error]);
        exit;
    }
    // Construir la cadena de tipos: un entero para new_tag_id, luego tantos enteros como old_tag_ids y un entero final para new_tag_id
    $types = 'i' . str_repeat('i', count($old_tag_ids)) . 'i';
    // Parámetros: new_tag_id, seguido de cada old_tag_id y finalmente new_tag_id
    $params = array_merge([$new_tag_id], $old_tag_ids, [$new_tag_id]);
    
    // Vincular parámetros dinámicamente
    $stmtParams = [];
    $stmtParams[] = & $types;
    foreach ($params as $key => $value) {
        $stmtParams[] = & $params[$key];
    }
    call_user_func_array([$stmtRel, 'bind_param'], $stmtParams);
    
    if (!$stmtRel->execute()) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Error al actualizar relaciones: " . $stmtRel->error]);
        exit;
    }
    $stmtRel->close();
    
    // Paso 2: Eliminar cualquier registro en image_tags que aún tenga alguno de los old_tag_ids (para quitar duplicados)
    $sqlDeleteImageTags = "DELETE FROM image_tags WHERE tag_id IN ($placeholders)";
    $stmtDel = $conn->prepare($sqlDeleteImageTags);
    if (!$stmtDel) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Error en la preparación del DELETE: " . $conn->error]);
        exit;
    }
    $typesDel = str_repeat('i', count($old_tag_ids));
    $stmtParamsDel = [];
    $stmtParamsDel[] = & $typesDel;
    foreach ($old_tag_ids as $key => $value) {
        $stmtParamsDel[] = & $old_tag_ids[$key];
    }
    call_user_func_array([$stmtDel, 'bind_param'], $stmtParamsDel);
    
    if (!$stmtDel->execute()) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Error al eliminar registros duplicados: " . $stmtDel->error]);
        exit;
    }
    $deletedImageTags = $stmtDel->affected_rows;
    $stmtDel->close();
    
    // Paso 3: Eliminar los registros de la tabla tags con el nombre antiguo
    $stmtDeleteOldTags = $conn->prepare("DELETE FROM tags WHERE name = ?");
    if (!$stmtDeleteOldTags) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Error en la preparación del DELETE de tags: " . $conn->error]);
        exit;
    }
    $stmtDeleteOldTags->bind_param("s", $old_tag);
    if (!$stmtDeleteOldTags->execute()) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Error al eliminar tags antiguos: " . $stmtDeleteOldTags->error]);
        exit;
    }
    $deletedTags = $stmtDeleteOldTags->affected_rows;
    $stmtDeleteOldTags->close();
    
    $conn->close();
    echo json_encode([
        "success" => true,
        "message" => "Tags fusionados. Se actualizaron las relaciones de $total tag" . ($total != 1 ? "s" : "") . " y se eliminaron $deletedTags tag" . ($deletedTags != 1 ? "s" : ""),
        "affected_image_tags" => $deletedImageTags,
        "deleted_tags" => $deletedTags
    ]);
    exit;
} else {
    // Si el nuevo tag no existe, simplemente actualizar el nombre del tag antiguo en todos los registros
    $stmtUpd = $conn->prepare("UPDATE tags SET name = ? WHERE name = ?");
    $stmtUpd->bind_param("ss", $new_tag, $old_tag);
    if (!$stmtUpd->execute()) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Error al ejecutar el UPDATE: " . $stmtUpd->error]);
        exit;
    }
    $affected = $stmtUpd->affected_rows;
    $stmtUpd->close();
    $conn->close();
    echo json_encode([
        "success" => true,
        "message" => "Se actualizaron $affected tag" . ($affected != 1 ? "s" : ""),
        "affected_rows" => $affected
    ]);
    exit;
}
?>
