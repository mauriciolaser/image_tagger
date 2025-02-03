import React from "react";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL; // Definido en .env

function UserList({ users, onUserDeleted }) {
    const handleDelete = async (id) => {
        console.log(`Solicitando eliminación de usuario ID: ${id}`);

        try {
            const response = await axios.delete(API_URL, {
                params: { action: "admin" }, // Enviar `action=admin` como parámetro
                data: { id } // Enviar el ID en el cuerpo
            });
            console.log("Respuesta del servidor:", response.data);
            onUserDeleted();
        } catch (error) {
            console.error("Error eliminando usuario:", error);
        }
    };

    return (
        <ul className="user-list">
            {users.map((user) => (
                <li key={user.id}>
                    {user.username}
                    <button onClick={() => handleDelete(user.id)}>Eliminar</button>
                </li>
            ))}
        </ul>
    );
}

export default UserList;
