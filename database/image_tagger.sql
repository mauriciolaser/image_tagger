-- Crear la base de datos (si no existe)
CREATE DATABASE IF NOT EXISTS image_tagger;
USE image_tagger;

-- Crear la tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Crear la tabla de imágenes
CREATE TABLE IF NOT EXISTS images (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    path VARCHAR(255) NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    uploaded_by INT UNSIGNED DEFAULT NULL,
    CONSTRAINT fk_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Crear la tabla de tags (cada usuario puede tener su propia versión de un mismo tag)
CREATE TABLE IF NOT EXISTS tags (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    created_by INT UNSIGNED NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by INT UNSIGNED DEFAULT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_tag_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_tag_per_user (name, created_by) -- Permite que diferentes usuarios creen el mismo tag
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Crear la tabla intermedia para asignar tags a imágenes
CREATE TABLE IF NOT EXISTS image_tags (
    image_id INT UNSIGNED NOT NULL,
    tag_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL, -- Se mantiene la referencia correcta a users(id)
    tagged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (image_id, tag_id, user_id), -- Evita duplicados por usuario
    CONSTRAINT fk_image FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
    CONSTRAINT fk_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
