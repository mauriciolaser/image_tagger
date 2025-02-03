import React, { useState } from "react";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL; // Definido en .env

function UserForm({ onUserAdded }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log("Enviando datos al servidor:", { username, password });

        try {
            const response = await axios.post(API_URL, 
                { username, password }, // Datos en el cuerpo
                { params: { action: "admin" } } // `action=admin` en la URL
            );

            console.log("Respuesta del servidor:", response.data);
            setUsername("");
            setPassword("");
            onUserAdded();
        } catch (error) {
            console.error("Error creando usuario:", error);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="user-form">
            <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Usuario"
                required
            />
            <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                required
            />
            <button type="submit">Crear usuario</button>
        </form>
    );
}

export default UserForm;
