<?php
require __DIR__ . '/vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->safeLoad(); // Evita errores fatales si .env no existe

echo "<h2>Prueba de Variables de Entorno</h2>";

if (!isset($_ENV['DB_HOST']) || empty($_ENV['DB_HOST'])) {
    echo "<p style='color:red;'>❌ ERROR: No se cargaron las variables de entorno.</p>";
    echo "<p>Verifica que el archivo <b>.env</b> esté en <b>/home/vallhzty/image_tagger/</b> y que los permisos sean correctos.</p>";
} else {
    echo "<p style='color:green;'>✅ `.env` cargado correctamente.</p>";
    echo "<p><b>DB_HOST:</b> " . $_ENV['DB_HOST'] . "</p>";
    echo "<p><b>DB_USER:</b> " . $_ENV['DB_USER'] . "</p>";
}
?>
