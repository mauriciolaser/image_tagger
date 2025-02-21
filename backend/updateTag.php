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
   2. Obtener el id del tag antiguo.
   3. Actualizar las relaciones en image_tags para cambiar el tag_id de old_tag al nuevo,
      pero solo en aquellos casos que no generen duplicados (usando una subconsulta).
   4. Eliminar las filas restantes que aún tengan el tag antiguo.
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
    // Merge: actualizar relaciones y eliminar el tag antiguo
    // Obtener id del tag antiguo
    $stmtOld = $conn->prepare("SELECT id FROM tags WHERE name = ?");
    $stmtOld->bind_param("s", $old_tag);
    $stmtOld->execute();
    $old_tag_id = null;
    if (method_exists($stmtOld, 'get_result')) {
        $resultOld = $stmtOld->get_result();
        if ($resultOld->num_rows > 0) {
            $rowOld = $resultOld->fetch_assoc();
            $old_tag_id = $rowOld['id'];
        }
    } else {
        $stmtOld->bind_result($old_tag_id);
        $stmtOld->fetch();
    }
    $stmtOld->close();
    
    if (!$old_tag_id) {
        echo json_encode(["success" => false, "message" => "No se encontró el tag antiguo."]);
        $conn->close();
        exit;
    }
    
    // Paso 1: Actualizar registros de image_tags sin generar duplicados.
    // Se actualizan los registros con old_tag_id a new_tag_id solo si no existe ya una fila para esa imagen y usuario con new_tag_id.
    $stmtRel = $conn->prepare(
      "UPDATE image_tags 
       SET tag_id = ? 
       WHERE tag_id = ? 
         AND NOT EXISTS (
           SELECT 1 FROM (SELECT * FROM image_tags) AS t2 
           WHERE t2.image_id = image_tags.image_id 
             AND t2.user_id = image_tags.user_id 
             AND t2.tag_id = ?
         )"
    );
    if (!$stmtRel) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Error en la preparación del UPDATE de relaciones: " . $conn->error]);
        exit;
    }
    $stmtRel->bind_param("iii", $new_tag_id, $old_tag_id, $new_tag_id);
    if (!$stmtRel->execute()) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Error al actualizar relaciones: " . $stmtRel->error]);
        exit;
    }
    $stmtRel->close();
    
    // Paso 2: Eliminar cualquier registro en image_tags que aún tenga old_tag_id (esos son duplicados)
    $stmtDel = $conn->prepare("DELETE FROM image_tags WHERE tag_id = ?");
    if (!$stmtDel) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Error en la preparación del DELETE: " . $conn->error]);
        exit;
    }
    $stmtDel->bind_param("i", $old_tag_id);
    if (!$stmtDel->execute()) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Error al eliminar registros duplicados: " . $stmtDel->error]);
        exit;
    }
    $deleted = $stmtDel->affected_rows;
    $stmtDel->close();
    
    $conn->close();
    echo json_encode([
        "success" => true,
        "message" => "Tags fusionados. Se actualizaron las relaciones de " . $total . " tag" . ($total != 1 ? "s" : ""),
        "affected_rows" => $deleted
    ]);
    exit;
} else {
    // Si el nuevo tag no existe, simplemente actualizar el nombre del tag antiguo
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
        "message" => "Se actualizaron " . $affected . " tag" . ($affected != 1 ? "s" : ""),
        "affected_rows" => $affected
    ]);
    exit;
}
?>
