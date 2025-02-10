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
  const [clearDbLoading, setClearDbLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [clearDbModalOpen, setClearDbModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [jobId, setJobId] = useState(null);
  const [importStatus, setImportStatus] = useState('');
  const API_URL = process.env.REACT_APP_API_URL;

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
          // Consultar el estado del job usando job_id.
          const response = await axios.get(`${API_URL}?action=importStatus&job_id=${jobId}`);
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
      setImportLoading(true);
      // Se inicia la importación solicitando al backend que inicie el job.
      const response = await axios.get(`${API_URL}?action=startImport&user_id=${userId}`);
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

  const handleClearDatabase = async () => {
    setClearDbLoading(true);
    try {
      const response = await axios.delete(`${API_URL}?action=clearDatabase`);
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
        <button onClick={() => setDeleteModalOpen(true)} disabled={deleteLoading} className="delete-button">
          {deleteLoading ? "Borrando..." : "Nuke database ☢️"}
        </button>
        <button onClick={handleExport} disabled={deleteLoading || importLoading} className="export-button">
          Exportar
        </button>
        {/* El botón de importar queda inhabilitado si ya hay un job pendiente */}
        <button onClick={() => setImportModalOpen(true)} disabled={importLoading || jobId} className="import-button">
          {importLoading ? "Importando..." : "Importar imágenes"}
        </button>
        <button onClick={() => setClearDbModalOpen(true)} disabled={clearDbLoading} className="clear-db-button">
          {clearDbLoading ? "Limpiando..." : "Limpiar Database"}
        </button>
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
          // Si es el mensaje de inicio de importación, se muestra un único botón que cierra el modal.
          <button onClick={() => setStatusModalOpen(false)} className="admin-modal-confirm-button">
            Continuar
          </button>
        ) : jobId && importStatus === "running" ? (
          // Mientras se está importando, se muestran opciones para cancelar o cerrar el modal.
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
          // En otros casos (p.ej., tras borrar o exportar), se muestra un botón que cierra el modal y, en ciertos mensajes, redirige a la galería.
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

      {/* Banner de estado de importación en la esquina inferior derecha */}
      {jobId && importStatus === "running" && (
        <div className="import-status-banner">
          <p>Importación en curso...</p>
        </div>
      )}
    </div>
  );
};

export default Admin;
