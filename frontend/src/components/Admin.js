// src/components/Admin.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from 'react-modal';
import TagInfo from './TagInfo';
import TagChart from './TagChart';
import UpdateTag from './UpdateTag';
import './Admin.css';
// Importamos las funciones del servicio, incluyendo las nuevas para detener actualización
import {
  getImportStatus,
  deleteAllImages,
  startImport,
  stopImport,
  clearDatabase,
  startUpdate,
  getUpdateStatus,
  stopUpdate
} from '../services/adminService';

// Importamos nuestro UserCard y estadísticas
import UserCard from './UserCard';
import AdminStats from './AdminStats';

Modal.setAppElement('#root');

const API_URL = process.env.REACT_APP_API_URL;

const Admin = () => {
  const navigate = useNavigate();

  // Estados básicos
  const [loggedUser, setLoggedUser] = useState("nombredeusuario");
  const [userId, setUserId] = useState(null);

  // Estados de loading
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [clearDbLoading, setClearDbLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);

  // Estados de modals
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [clearDbModalOpen, setClearDbModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [doomsdayModalOpen, setDoomsdayModalOpen] = useState(false);
  const [doomsdayCommand, setDoomsdayCommand] = useState("");

  // Estados para mensajes y jobs
  const [modalMessage, setModalMessage] = useState('');
  const [jobId, setJobId] = useState(null);
  const [importStatus, setImportStatus] = useState('');
  const [updateJobId, setUpdateJobId] = useState(null);
  const [updateStatus, setUpdateStatus] = useState('');

  // Estado para refrescar la lista de tags
  const [tagRefreshFlag, setTagRefreshFlag] = useState(false);

  // Al montar, obtenemos username y userId de localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('username');
    if (storedUser) setLoggedUser(storedUser);

    const storedUserId = localStorage.getItem('user_id');
    if (storedUserId) setUserId(storedUserId);
  }, []);

  // Monitoreo de la importación en curso
  useEffect(() => {
    let interval;
    if (jobId) {
      interval = setInterval(async () => {
        try {
          const response = await getImportStatus(jobId);
          if (response.data.success) {
            setImportStatus(response.data.status);
            if (
              response.data.status === "completed" ||
              response.data.status === "stopped"
            ) {
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

  // Monitoreo de la actualización en curso
  useEffect(() => {
    let interval;
    if (updateJobId) {
      interval = setInterval(async () => {
        try {
          const response = await getUpdateStatus(updateJobId);
          if (response.data.success) {
            setUpdateStatus(response.data.status);
            if (
              response.data.status === "completed" ||
              response.data.status === "stopped"
            ) {
              clearInterval(interval);
              setUpdateJobId(null);
              setModalMessage("Actualización de metadata completada.");
            }
          }
        } catch (error) {
          console.error("Error consultando estado de actualización:", error);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [updateJobId]);

  // Función para refrescar la lista de tags (toggle)
  const handleTagsUpdate = () => {
    setTagRefreshFlag(prev => !prev);
  };

  // Botón "Exportar"
  const handleExport = () => {
    if (!userId) {
      setModalMessage("No se encontró user_id.");
      setStatusModalOpen(true);
      return;
    }
    window.open(
      `${API_URL}?action=exportImages&user_id=${userId}`,
      '_blank'
    );
  };

  // Botón "Importar imágenes"
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
        setJobId(response.data.job_id);
        setImportStatus("running");
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

  // Botón "Actualizar Metadata"
  const handleUpdateMetadata = async () => {
    if (loggedUser !== 'admin') return;
    if (!userId) {
      setModalMessage("No se encontró user_id en localStorage.");
      setStatusModalOpen(true);
      return;
    }
    try {
      setUpdateLoading(true);
      const response = await startUpdate(userId);
      if (response.data.success) {
        setUpdateJobId(response.data.job_id);
        setUpdateStatus("running");
        setModalMessage("La actualización de metadata ha comenzado. Puedes cerrar esta ventana");
        setStatusModalOpen(true);
      } else {
        setModalMessage(response.data.message || "Error al iniciar la actualización.");
        setStatusModalOpen(true);
      }
    } catch (error) {
      setModalMessage("Error al actualizar metadata.");
      setStatusModalOpen(true);
    } finally {
      setUpdateLoading(false);
    }
  };

  // Botón "Stop Import"
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

  // Botón "Stop Update"
  const handleCancelUpdate = async () => {
    if (!updateJobId) return;
    try {
      const response = await stopUpdate(updateJobId);
      if (response.data.success) {
        setUpdateStatus("stopped");
        setModalMessage("Actualización detenida.");
      } else {
        setModalMessage("Error deteniendo la actualización.");
      }
    } catch (error) {
      setModalMessage("Error deteniendo la actualización.");
    } finally {
      setStatusModalOpen(true);
    }
  };

  // Botón "Cerrar sesión"
  const handleLogout = () => {
    localStorage.removeItem('username');
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
    window.location.href = "/image_tagger/login";
  };

  // Funciones para Doomsday (Nuke y Clear Database)
  const handleDoomsday = () => {
    setDoomsdayCommand("");
    setDoomsdayModalOpen(true);
  };

  const confirmDoomsdayNuke = async () => {
    if (doomsdayCommand !== "confirm_doomsday") {
      setModalMessage("Comando incorrecto. Debe escribir 'confirm_doomsday'");
      return;
    }
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
      setDoomsdayModalOpen(false);
      setStatusModalOpen(true);
    }
  };

  const confirmDoomsdayClear = async () => {
    if (doomsdayCommand !== "confirm_doomsday") {
      setModalMessage("Comando incorrecto. Debe escribir 'confirm_doomsday'");
      return;
    }
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
      setDoomsdayModalOpen(false);
      setStatusModalOpen(true);
    }
  };

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h2>Admin</h2>
      </div>

      <div className="admin-userstats-container">
  <UserCard userId={userId} username={loggedUser} />
  <AdminStats />
</div>

      <div className="admin-buttons">
        <button
          onClick={handleExport}
          disabled={deleteLoading || importLoading || updateLoading}
          className="export-button"
        >
          Exportar
        </button>
        {loggedUser === 'admin' && (
          <>
            <button
              onClick={() => setImportModalOpen(true)}
              disabled={importLoading || jobId}
              className="import-button"
            >
              {importLoading ? "Importando..." : "Importar imágenes"}
            </button>
            <button
              onClick={handleUpdateMetadata}
              disabled={updateLoading || updateJobId}
              className="update-button"
            >
              {updateLoading ? "Actualizando..." : "Actualizar Metadata"}
            </button>
          </>
        )}
        {loggedUser === 'admin' && (
          <button
            onClick={handleDoomsday}
            disabled={clearDbLoading || deleteLoading}
            className="doomsday-button"
          >
            Doomsday
          </button>
        )}
        <button onClick={handleLogout} className="logout-button">
          Cerrar sesión
        </button>
      </div>

      {/* Botones para detener jobs en ejecución */}
      <div className="admin-buttons">
        {loggedUser === 'admin' && jobId && (
          <button
            onClick={handleCancelImport}
            disabled={importLoading}
            className="cancel-import-button"
          >
            Stop Import
          </button>
        )}
        {loggedUser === 'admin' && updateJobId && (
          <button
            onClick={handleCancelUpdate}
            disabled={updateLoading}
            className="cancel-update-button"
          >
            Stop Update
          </button>
        )}
      </div>

      {/* Modal para Doomsday */}
      <Modal
        isOpen={doomsdayModalOpen}
        onRequestClose={() => setDoomsdayModalOpen(false)}
        className="admin-modal"
      >
        <h2>Doomsday</h2>
        <p>
          Para confirmar, escriba el comando: <strong>confirm_doomsday</strong>
        </p>
        <input
          type="text"
          value={doomsdayCommand}
          onChange={(e) => setDoomsdayCommand(e.target.value)}
          placeholder="Escribe confirm_doomsday"
          style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
        />
        <div>
          <button onClick={confirmDoomsdayNuke} className="admin-modal-confirm-button">
            Nuke Database
          </button>
          <button onClick={confirmDoomsdayClear} className="admin-modal-confirm-button">
            Limpiar Database
          </button>
        </div>
        <button onClick={() => setDoomsdayModalOpen(false)} className="admin-modal-cancel-button">
          Cancelar
        </button>
      </Modal>

      {/* Modal para importar imágenes */}
      <Modal
        isOpen={importModalOpen}
        onRequestClose={() => setImportModalOpen(false)}
        className="admin-modal"
      >
        <h2>¿Importar imágenes?</h2>
        <button onClick={handleImportImages} className="admin-modal-confirm-button">
          Sí, importar
        </button>
        <button onClick={() => setImportModalOpen(false)} className="admin-modal-cancel-button">
          Cancelar
        </button>
      </Modal>

      {/* Modal para mostrar estado y mensajes */}
      <Modal
        isOpen={statusModalOpen}
        onRequestClose={() => setStatusModalOpen(false)}
        className="admin-modal"
      >
        <h2>{modalMessage}</h2>
        {jobId && importStatus === "running" ? (
          <>
            <p>Estado import: {importStatus}</p>
            <button onClick={handleCancelImport} className="admin-modal-cancel-button">
              Cancelar Import
            </button>
            <button onClick={() => setStatusModalOpen(false)} className="admin-modal-cancel-button">
              Cerrar
            </button>
          </>
        ) : updateJobId && updateStatus === "running" ? (
          <>
            <p>Estado update: {updateStatus}</p>
            <button onClick={handleCancelUpdate} className="admin-modal-cancel-button">
              Cancelar Update
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
                modalMessage === "Base de datos limpia exitosamente." ||
                modalMessage === "Importación completada." ||
                modalMessage === "Actualización de metadata completada." ||
                modalMessage.includes("Se han borrado los registros de imágenes")
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

      <div className="admin-tag-components-container">
        <div className="admin-tag-row">
          <TagInfo refreshFlag={tagRefreshFlag} />
          <UpdateTag onUpdate={handleTagsUpdate} />
        </div>
        <div className="admin-tag-row">
          <TagChart />
        </div>
      </div>
    </div>
  );
};

export default Admin;
