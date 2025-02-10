import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Modal from 'react-modal';
import './Admin.css';

// Configurar el elemento raíz para react-modal.
Modal.setAppElement('#root');

const Admin = () => {
  const navigate = useNavigate();
  const [loggedUser, setLoggedUser] = useState("nombredeusuario");
  const [userId, setUserId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [jobId, setJobId] = useState(null);
  const [importStatus, setImportStatus] = useState('');
  const API_URL = process.env.REACT_APP_API_URL;

  useEffect(() => {
    const storedUser = localStorage.getItem('username');
    if (storedUser) setLoggedUser(storedUser);
    const storedUserId = localStorage.getItem('user_id');
    if (storedUserId) setUserId(storedUserId);
  }, []);

  // Monitoreo del estado de importación usando jobId
  useEffect(() => {
    let interval;
    if (jobId) {
      interval = setInterval(async () => {
        try {
          // Se utiliza job_id para consultar el estado
          const response = await axios.get(`${API_URL}?action=importStatus&job_id=${jobId}`);
          if (response.data.success) {
            setImportStatus(response.data.status);
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
  }, [jobId, API_URL]);

  const handleDeleteAllImages = async () => {
    setDeleteLoading(true);
    try {
      const response = await axios.delete(`${API_URL}?action=deleteAllImages`);
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
    window.open(`${API_URL}?action=exportImages&user_id=${userId}`, '_blank');
  };

  const handleImportImages = async () => {
    if (!userId) {
      setModalMessage("No se encontró user_id en localStorage.");
      setStatusModalOpen(true);
      return;
    }

    try {
      // Iniciar importación llamando a startImport con user_id
      setImportLoading(true);
      const response = await axios.get(`${API_URL}?action=startImport&user_id=${userId}`);

      if (response.data.success) {
        // Se obtiene y almacena el job_id para el monitoreo
        setJobId(response.data.job_id);
        setImportStatus("running");
        setModalMessage("Importación en proceso...");
      } else {
        setModalMessage(response.data.message || "Error al iniciar la importación.");
      }
    } catch (error) {
      setModalMessage("Error al importar imágenes.");
    } finally {
      setImportLoading(false);
      setImportModalOpen(false); // Cierra el modal de importación para que no se vuelva a mostrar
      setStatusModalOpen(true);
    }
  };

  const handleCancelImport = async () => {
    if (!jobId) return;
    try {
      const response = await axios.get(`${API_URL}?action=stopImport&job_id=${jobId}`);
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
        <button onClick={() => setDeleteModalOpen(true)} disabled={deleteLoading} className="delete-button">
          {deleteLoading ? "Borrando..." : "Nuke database ☢️"}
        </button>
        <button onClick={handleExport} disabled={deleteLoading || importLoading} className="export-button">
          Exportar
        </button>
        <button onClick={() => setImportModalOpen(true)} disabled={importLoading} className="import-button">
          {importLoading ? "Importando..." : "Importar imágenes"}
        </button>
        <button onClick={handleLogout} className="logout-button">
          Cerrar sesión
        </button>
      </div>

      {/* Modal de confirmación de eliminación */}
      <Modal isOpen={deleteModalOpen} onRequestClose={() => setDeleteModalOpen(false)} className="admin-modal">
        <h2>¿Borrar todas las imágenes?</h2>
        <button onClick={handleDeleteAllImages} className="admin-modal-confirm-button">
          Sí, borrar
        </button>
        <button onClick={() => setDeleteModalOpen(false)} className="admin-modal-cancel-button">
          Cancelar
        </button>
      </Modal>

      {/* Modal de confirmación de importación */}
      <Modal isOpen={importModalOpen} onRequestClose={() => setImportModalOpen(false)} className="admin-modal">
        <h2>¿Importar imágenes?</h2>
        <button onClick={handleImportImages} className="admin-modal-confirm-button">
          Sí, importar
        </button>
        <button onClick={() => setImportModalOpen(false)} className="admin-modal-cancel-button">
          Cancelar
        </button>
      </Modal>

      {/* Modal de estado */}
      <Modal isOpen={statusModalOpen} onRequestClose={() => setStatusModalOpen(false)} className="admin-modal">
        <h2>{modalMessage}</h2>
        {jobId && importStatus === "running" && (
          <>
            <p>Estado: {importStatus}</p>
            <button onClick={handleCancelImport} className="admin-modal-cancel-button">
              Cancelar
            </button>
            <button onClick={() => setStatusModalOpen(false)} className="admin-modal-cancel-button">
              Cerrar
            </button>
          </>
        )}
        {(!jobId &&
          (importStatus === "completed" ||
            importStatus === "stopped" ||
            modalMessage === "Se borraron todas las imágenes." ||
            modalMessage === "Error al borrar imágenes.")) && (
          <button
            onClick={() => {
              setStatusModalOpen(false);
              navigate('/gallery');
            }}
            className="admin-modal-confirm-button"
          >
            Continuar
          </button>
        )}
      </Modal>
    </div>
  );
};

export default Admin;
