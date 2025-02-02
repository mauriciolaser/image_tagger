import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './Login.css'; // Estilos del formulario
import Canvas from './Canvas'; // Importamos el Canvas con P5.js

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!username.trim() || !password) {
        alert('Por favor, ingresa username y password.');
        return;
    }

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}`, 
        { 
            action: "auth",
            username, 
            password 
        },
        {
            headers: {
                'Content-Type': 'application/json' // 🔑 Asegurar el header
            }
        }
    );
        console.log("Respuesta del servidor:", response.data);

        if (response.data.success) {
            // 🔹 Guardar user_id en localStorage
            localStorage.setItem('user_id', response.data.user.user_id);
            localStorage.setItem('username', response.data.user.username);

            console.log("✅ User ID guardado en localStorage:", response.data.user.user_id);

            navigate('/gallery');
        } else {
            alert(response.data.message || 'Invalid credentials');
        }
    } catch (error) {
        console.error("❌ Error durante el login:", error);
        alert('Ocurrió un error durante el login.');
    }
};


  return (
    <div className="login-container">
      {/* Fondo animado con P5.js */}
      <Canvas />

      <h1>Login</h1>
      <form onSubmit={handleLogin} className="login-form">
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="login-input"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="login-input"
        />
        <button type="submit" className="login-button">Login</button>
      </form>
    </div>
  );
};

export default Login;
