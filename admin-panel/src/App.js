import React, { useEffect, useState } from "react";
import axios from "axios";
import UserForm from "./components/UserForm";
import UserList from "./components/UserList";
import "./App.css";

const API_URL = process.env.REACT_APP_API_URL;

function App() {
    const [users, setUsers] = useState([]);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        console.log("Enviando solicitud GET para obtener usuarios...");
        try {
          const response = await axios.get(API_URL, {
            params: { action: "admin" }
        });
            console.log("Usuarios obtenidos:", response.data);
            setUsers(response.data);
        } catch (error) {
            console.error("Error obteniendo usuarios:", error);
        }
    };

    return (
        <div className="container">
            <h1>Admin Usuarios</h1>
            <UserForm onUserAdded={fetchUsers} />
            <UserList users={users} onUserDeleted={fetchUsers} />
        </div>
    );
}

export default App;
