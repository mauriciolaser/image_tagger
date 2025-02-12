// src/components/Admin.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// Ya no necesitamos importar axios en este componente
import Modal from 'react-modal';
import './Admin.css';

// Importamos las funciones de nuestro servicio
import {
  getImportStatus,
  deleteAllImages,
  startImport,
  stopImport,
  clearDatabase
} from '../services/adminService';

// Configurar el elemento raíz para react-modal.
Modal.setAppElement('#root');

const Admin = () => {
  const navigate = useNavigate();
  const [loggedUser, setLoggedUser] = useState("nombredeusuario");
  const [userId, setUserId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [clearDbLoading, setClearDbLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [clearDbModalOpen, setClearDbModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [jobId, setJobId] = useState(null);
  const [importStatus, setImportStatus] = useState('');

  // Al iniciar, se leen los datos del usuario desde localStorage.
  useEffect(() => {
    const storedUser = localStorage.getItem('username');
    if (storedUser) setLoggedUser(storedUser);
    const storedUserId = localStorage.getItem('user_id');
    if (storedUserId) setUserId(storedUserId);
  }, []);

  // Monitoreo del estado de importación mientras haya un job pendiente.
  useEffect(() => {
    let interval;
    if (jobId) {
      interval = setInterval(async () => {
        try {
          const response = await getImportStatus(jobId);
          if (response.data.success) {
            setImportStatus(response.data.status);
            // Cuando el job se completa o se detiene, se borra el job pendiente.
            if (response.data.status === "completed" || response.data.status === "stopped") {
              clearInterval(interval);
              setJobId(null);
              setModalMessage("Importación completada.");
            }
          }
        } catch (error) {
          console.error("Error consultando estado de importación:", error);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [jobId]);

  const handleDeleteAllImages = async () => {
    if (loggedUser !== 'admin') return;
    setDeleteLoading(true);
    try {
      const response = await deleteAllImages();
      setModalMessage(
        response.data.success
          ? "Se borraron todas las imágenes."
          : "Error al borrar imágenes."
      );
    } catch (error) {
      setModalMessage("Error al borrar imágenes.");
    } finally {
      setDeleteLoading(false);
      setDeleteModalOpen(false);
      setStatusModalOpen(true);
    }
  };

  const handleExport = () => {
    if (!userId) {
      setModalMessage("No se encontró user_id.");
      setStatusModalOpen(true);
      return;
    }
    // Abrimos una nueva ventana con la ruta de exportación
    window.open(`${process.env.REACT_APP_API_URL}?action=exportImages&user_id=${userId}`, '_blank');
  };

  const handleImportImages = async () => {
    if (loggedUser !== 'admin') return;
    if (!userId) {
      setModalMessage("No se encontró user_id en localStorage.");
      setStatusModalOpen(true);
      return;
    }

    try {
      setImportLoading(true);
      const response = await startImport(userId);
      if (response.data.success) {
        // Se almacena el job_id y se marca el estado como "running".
        setJobId(response.data.job_id);
        setImportStatus("running");
        // Se muestra el mensaje de inicio de importación.
        setModalMessage("La importación ha comenzado. Puedes cerrar esta ventana");
        setImportModalOpen(false);
        setStatusModalOpen(true);
      } else {
        setModalMessage(response.data.message || "Error al iniciar la importación.");
        setImportModalOpen(false);
        setStatusModalOpen(true);
      }
    } catch (error) {
      setModalMessage("Error al importar imágenes.");
      setImportModalOpen(false);
      setStatusModalOpen(true);
    } finally {
      setImportLoading(false);
    }
  };

  const handleCancelImport = async () => {
    if (!jobId) return;
    try {
      const response = await stopImport(jobId);
      if (response.data.success) {
        setImportStatus("stopped");
        setModalMessage("Importación detenida.");
      } else {
        setModalMessage("Error deteniendo la importación.");
      }
    } catch (error) {
      setModalMessage("Error deteniendo la importación.");
    } finally {
      setStatusModalOpen(true);
    }
  };

  const handleClearDatabase = async () => {
    if (loggedUser !== 'admin') return;
    setClearDbLoading(true);
    try {
      const response = await clearDatabase();
      setModalMessage(
        response.data.success
          ? response.data.message || "Base de datos limpia exitosamente."
          : "Error al limpiar la base de datos."
      );
    } catch (error) {
      setModalMessage("Error al limpiar la base de datos.");
    } finally {
      setClearDbLoading(false);
      setClearDbModalOpen(false);
      setStatusModalOpen(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('username');
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
    window.location.href = "/login";
  };

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h2>Admin</h2>
        <p className="user-info">Usuario: {loggedUser}</p>
      </div>
      <div className="admin-buttons">
        {loggedUser === 'admin' && (
          <button 
            onClick={() => setDeleteModalOpen(true)} 
            disabled={deleteLoading} 
            className="delete-button"
          >
            {deleteLoading ? "Borrando..." : "Nuke database ☢️"}
          </button>
        )}
        <button 
          onClick={handleExport} 
          disabled={deleteLoading || importLoading} 
          className="export-button"
        >
          Exportar
        </button>
        {loggedUser === 'admin' && (
          <button 
            onClick={() => setImportModalOpen(true)} 
            disabled={importLoading || jobId} 
            className="import-button"
          >
            {importLoading ? "Importando..." : "Importar imágenes"}
          </button>
        )}
        {loggedUser === 'admin' && (
          <button 
            onClick={() => setClearDbModalOpen(true)} 
            disabled={clearDbLoading} 
            className="clear-db-button"
          >
            {clearDbLoading ? "Limpiando..." : "Limpiar Database"}
          </button>
        )}
        <button onClick={handleLogout} className="logout-button">
          Cerrar sesión
        </button>
      </div>

      {/* Modal de confirmación para borrar todas las imágenes */}
      <Modal isOpen={deleteModalOpen} onRequestClose={() => setDeleteModalOpen(false)} className="admin-modal">
        <h2>¿Borrar todas las imágenes?</h2>
        <button onClick={handleDeleteAllImages} className="admin-modal-confirm-button">
          Sí, borrar
        </button>
        <button onClick={() => setDeleteModalOpen(false)} className="admin-modal-cancel-button">
          Cancelar
        </button>
      </Modal>

      {/* Modal de confirmación para importar imágenes */}
      <Modal isOpen={importModalOpen} onRequestClose={() => setImportModalOpen(false)} className="admin-modal">
        <h2>¿Importar imágenes?</h2>
        <button onClick={handleImportImages} className="admin-modal-confirm-button">
          Sí, importar
        </button>
        <button onClick={() => setImportModalOpen(false)} className="admin-modal-cancel-button">
          Cancelar
        </button>
      </Modal>

      {/* Modal de confirmación para limpiar la base de datos */}
      <Modal isOpen={clearDbModalOpen} onRequestClose={() => setClearDbModalOpen(false)} className="admin-modal">
        <h2>Se borrarán imágenes y tags. Tendrás que importar nuevamente las imágenes.</h2>
        <button onClick={handleClearDatabase} className="admin-modal-confirm-button">
          Continuar
        </button>
        <button onClick={() => setClearDbModalOpen(false)} className="admin-modal-cancel-button">
          Cancelar
        </button>
      </Modal>

      {/* Modal de estado */}
      <Modal isOpen={statusModalOpen} onRequestClose={() => setStatusModalOpen(false)} className="admin-modal">
        <h2>{modalMessage}</h2>
        {modalMessage === "La importación ha comenzado. Puedes cerrar esta ventana" ? (
          <button onClick={() => setStatusModalOpen(false)} className="admin-modal-confirm-button">
            Continuar
          </button>
        ) : jobId && importStatus === "running" ? (
          <>
            <p>Estado: {importStatus}</p>
            <button onClick={handleCancelImport} className="admin-modal-cancel-button">
              Cancelar
            </button>
            <button onClick={() => setStatusModalOpen(false)} className="admin-modal-cancel-button">
              Cerrar
            </button>
          </>
        ) : (
          <button
            onClick={() => {
              setStatusModalOpen(false);
              if (
                modalMessage === "Se borraron todas las imágenes." ||
                modalMessage === "Error al borrar imágenes." ||
                modalMessage === "Se han borrado los registros de imágenes, tags y relaciones de tags." ||
                modalMessage === "Importación completada."
              ) {
                navigate('/gallery');
              }
            }}
            className="admin-modal-confirm-button"
          >
            Continuar
          </button>
        )}
      </Modal>

      {jobId && importStatus === "running" && (
        <div className="import-status-banner">
          <p>Importación en curso...</p>
        </div>
      )}
    </div>
  );
};

export default Admin;
