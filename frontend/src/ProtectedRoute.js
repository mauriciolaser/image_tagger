import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
    const isAuthenticated = localStorage.getItem('username'); // Verifica si hay sesión
    const location = useLocation(); // Obtiene la ubicación actual

    // Permitir siempre el acceso a /login
    if (!isAuthenticated && location.pathname !== "/login") {
        return <Navigate to="/login" replace />;
    }

    return children;
};

export default ProtectedRoute;
