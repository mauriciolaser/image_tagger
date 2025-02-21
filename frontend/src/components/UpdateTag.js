// src/components/UpdateTag.js
import React, { useState } from 'react';
import axios from 'axios';
import Modal from 'react-modal';
import './UpdateTag.css';

const API_URL = process.env.REACT_APP_API_URL; // Asegúrate de que apunte a updateTag.php

Modal.setAppElement('#root');

const UpdateTag = ({ onUpdate }) => {
  const [oldTag, setOldTag] = useState('');
  const [newTag, setNewTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [totalTags, setTotalTags] = useState(0);

  // Consulta cuántos registros se modificarían (confirm: false)
  const handleCheckUpdate = async () => {
    if (!oldTag.trim() || !newTag.trim()) {
      setMessage('Por favor, ingresa ambos nombres de tag.');
      return;
    }
    setMessage('');
    setLoading(true);
    try {
      const response = await axios.post(
        API_URL,
        {
          action: 'updateTag',
          old_tag: oldTag.trim(),
          new_tag: newTag.trim(),
          confirm: false
        },
        { headers: { 'Content-Type': 'application/json' } }
      );
      if (response.data && response.data.success) {
        setTotalTags(response.data.total_tags);
        setModalOpen(true);
      } else {
        setMessage(response.data.message || 'Error al consultar los tags.');
      }
    } catch (error) {
      setMessage('Error en la solicitud: ' + error.message);
    }
    setLoading(false);
  };

  // Ejecuta la actualización (confirm: true)
  const handleConfirmUpdate = async () => {
    setModalOpen(false);
    setLoading(true);
    try {
      const response = await axios.post(
        API_URL,
        {
          action: 'updateTag',
          old_tag: oldTag.trim(),
          new_tag: newTag.trim(),
          confirm: true
        },
        { headers: { 'Content-Type': 'application/json' } }
      );
      if (response.data && response.data.success) {
        setMessage(response.data.message);
        // Resetear campos tras una actualización exitosa
        setOldTag('');
        setNewTag('');
        // Llamar al callback para refrescar TagInfo
        if (onUpdate) onUpdate();
      } else {
        setMessage(response.data.message || 'Error al actualizar los tags.');
      }
    } catch (error) {
      setMessage('Error en la solicitud: ' + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="update-tag-container">
      <h2>Actualizar Tag</h2>
      <div className="update-form-group">
        <label>Nombre actual:</label>
        <input
          type="text"
          value={oldTag}
          onChange={(e) => setOldTag(e.target.value)}
          placeholder="Nombre actual del tag"
        />
      </div>
      <div className="update-form-group">
        <label>Nuevo nombre:</label>
        <input
          type="text"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          placeholder="Nuevo nombre del tag"
        />
      </div>
      <button
        className="update-button"
        onClick={handleCheckUpdate}
        disabled={loading || !oldTag || !newTag}
      >
        {loading ? 'Procesando...' : 'Modificar Tag'}
      </button>
      {message && <p className="update-tag-message">{message}</p>}

      <Modal
        isOpen={modalOpen}
        onRequestClose={() => setModalOpen(false)}
        contentLabel="Confirmar actualización"
        className="update-tag-modal"
        overlayClassName="update-tag-overlay"
      >
        <div>
          <p>
            Confirma la modificación de {totalTags} tag{totalTags !== 1 ? 's' : ''}
          </p>
          <div className="update-modal-buttons">
            <button className="update-button" onClick={handleConfirmUpdate}>Aceptar</button>
            <button className="update-button" onClick={() => setModalOpen(false)}>Cancelar</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default UpdateTag;
