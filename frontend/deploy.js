require('dotenv').config({ path: '.env.production' });
const FtpDeploy = require('ftp-deploy');
const ftpDeploy = new FtpDeploy();

const config = {
  user: process.env.DEPLOY_FTP_USER,
  password: process.env.DEPLOY_FTP_PASSWORD,
  host: process.env.DEPLOY_FTP_HOST,
  port: process.env.DEPLOY_FTP_PORT,
  localRoot: __dirname + "/build",         // Carpeta donde se genera tu build de React
  remoteRoot: process.env.DEPLOY_FTP_PATH, // Ruta remota en tu hosting
  include: ["*", "**/*"],                  // Sube todo lo que hay en /build
  deleteRemote: false,                     // Si quieres borrar los archivos viejos en el servidor, pon true
  forcePasv: true
};

ftpDeploy.deploy(config)
  .then(() => console.log("¡Deploy finalizado!"))
  .catch(err => console.error("Error en el deploy:", err));
