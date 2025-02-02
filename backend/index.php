<?php
// This acts as a secure proxy to the real backend

$backendUrl = "http://localhost/image_tagger/api.php"; // Internal request

$allowedMethods = ['GET', 'POST', 'PUT', 'DELETE'];
if (!in_array($_SERVER['REQUEST_METHOD'], $allowedMethods)) {
    http_response_code(405);
    die(json_encode(["error" => "Method not allowed"]));
}

// Forward the request to the actual API
$ch = curl_init($backendUrl . '?' . $_SERVER['QUERY_STRING']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $_SERVER['REQUEST_METHOD']);
curl_setopt($ch, CURLOPT_HTTPHEADER, getallheaders());
if ($_SERVER['REQUEST_METHOD'] === 'POST' || $_SERVER['REQUEST_METHOD'] === 'PUT') {
    curl_setopt($ch, CURLOPT_POSTFIELDS, file_get_contents('php://input'));
}

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

http_response_code($httpCode);
echo $response;
?>
