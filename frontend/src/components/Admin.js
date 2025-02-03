import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Modal from 'react-modal';
import './Admin.css';

// Configura el elemento raíz para react-modal.
Modal.setAppElement('#root');

const Admin = () => {
  const navigate = useNavigate(); // Hook para la navegación
  const [loggedUser, setLoggedUser] = useState("nombredeusuario");
  const [loading, setLoading] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminModalMessage, setAdminModalMessage] = useState('');
  const API_URL = process.env.REACT_APP_API_URL;
  
  const userId = 1; // Para efectos del ejemplo, usamos un user_id fijo.

  // Obtener el username del localStorage al montar el componente
  useEffect(() => {
    const storedUser = localStorage.getItem('username');
    console.log("LocalStorage username:", storedUser);
    if (storedUser) {
      setLoggedUser(storedUser);
    }
  }, []);

  // Función para borrar todas las imágenes
  const handleDeleteAllImages = async () => {
    if (!window.confirm("¿Estás seguro de que quieres borrar TODAS las imágenes?")) {
      return;
    }
    setLoading(true);
    try {
      const response = await axios.delete(`${API_URL}/index.php?action=deleteAllImages`);
      console.log("Delete all images response:", response.data);
      if (response.data.success) {
        setAdminModalMessage("Se borraron exitosamente todas las imágenes.");
      } else {
        setAdminModalMessage(response.data.message || "Error al borrar las imágenes.");
      }
    } catch (error) {
      console.error('Error deleting all images:', error);
      setAdminModalMessage("Error deleting images.");
    } finally {
      setLoading(false);
      setAdminModalOpen(true);
    }
  };

  // Función para exportar los datos en CSV
  const handleExport = () => {
    console.log("Exporting images for userId:", userId);
    window.open(`${API_URL}/index.php?action=exportImages&user_id=${userId}`, '_blank');
  };
  

  // Función para cerrar sesión
  const handleLogout = () => {
    console.log("Cerrando sesión...");
    localStorage.removeItem('username'); // Eliminar el username almacenado
    localStorage.removeItem('token'); // Opcional: eliminar un token de autenticación si existe
    window.location.href = "/login"; // Redirige al login y fuerza recarga
  };

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h2>Admin</h2>
        <p className="user-info">Usuario: {loggedUser}</p>
      </div>
      <div className="admin-buttons">
        <button
          onClick={handleDeleteAllImages}
          disabled={loading}
          className="delete-button"
        >
          {loading ? "Borrando..." : "Borrar todas las imágenes"}
        </button>
        <button
          onClick={handleExport}
          disabled={loading}
          className="export-button"
        >
          Exportar
        </button>
        <button
          onClick={handleLogout}
          className="logout-button"
        >
          Cerrar sesión
        </button>
      </div>

      {/* Modal para mostrar el mensaje de resultado */}
      {adminModalOpen && (
        <Modal
          isOpen={adminModalOpen}
          onRequestClose={() => setAdminModalOpen(false)}
          contentLabel="Resultado de la acción"
          style={{
            content: {
              width: '400px',
              height: '200px',
              margin: 'auto',
              textAlign: 'center'
            }
          }}
        >
          <h2>{adminModalMessage}</h2>
          <button onClick={() => setAdminModalOpen(false)}>Cerrar</button>
        </Modal>
      )}
    </div>
  );
};

export default Admin;
