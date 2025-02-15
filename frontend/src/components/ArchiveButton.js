// src/components/ArchiveButton.js
import React, { useState } from "react";
import Modal from "react-modal";
import axios from "axios";
import "./ArchiveButton.css";

const ArchiveButton = ({ selectedImage, setAllImages, setSelectedImage, API_URL }) => {
  const [confirmArchiveModalOpen, setConfirmArchiveModalOpen] = useState(false);
  const [successArchiveModalOpen, setSuccessArchiveModalOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveImageName, setArchiveImageName] = useState("");

  if (!selectedImage) return null;

  const archiveButtonText = selectedImage.archived === 1 ? "Restaurar Imagen" : "Archivar Imagen";
  const archiveModalText = selectedImage.archived === 1
    ? `¿Restaurar la imagen "${selectedImage.original_name || selectedImage.filename}"?`
    : `¿Archivar la imagen "${selectedImage.original_name || selectedImage.filename}"?`;
  const successArchiveText = selectedImage.archived === 1
    ? `Se restauró exitosamente la imagen "${selectedImage.original_name || selectedImage.filename}"`
    : `Se archivó exitosamente la imagen "${selectedImage.original_name || selectedImage.filename}"`;

  const openConfirmArchiveModal = () => {
    setArchiveImageName(selectedImage.original_name || selectedImage.filename);
    setConfirmArchiveModalOpen(true);
  };

  const handleArchiveToggle = async () => {
    setIsArchiving(true);
    try {
      const newArchivedValue = selectedImage.archived === 1 ? 0 : 1;
      const response = await axios.post(`${API_URL}?action=archiveImage`, {
        image_id: selectedImage.id,
        archived: newArchivedValue,
      });

      if (response.data.success) {
        setConfirmArchiveModalOpen(false);
        setSuccessArchiveModalOpen(true);
        setAllImages((prev) => prev.filter((img) => img.id !== selectedImage.id));
        setSelectedImage(null);
      } else {
        alert(response.data.message || "Error al modificar estado de la imagen.");
      }
    } catch (error) {
      console.error("Error toggling archive state:", error);
      alert("Error al modificar estado de la imagen.");
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <>
      <button className="archive-button" onClick={openConfirmArchiveModal}>
        {archiveButtonText}
      </button>

      {/* Modal de Confirmación */}
      <Modal
        isOpen={confirmArchiveModalOpen}
        onRequestClose={() => setConfirmArchiveModalOpen(false)}
        className="archive-modal-content"
        overlayClassName="archive-modal-overlay"
      >
        <div className="archive-modal-wrapper">
          <h2>{archiveModalText}</h2>
          <div className="archive-modal-buttons">
            <button onClick={handleArchiveToggle} disabled={isArchiving} className="archive-confirm">
              {isArchiving ? "Procesando..." : "Continuar"}
            </button>
            <button className="archive-cancel" onClick={() => setConfirmArchiveModalOpen(false)}>
              Cancelar
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de Éxito */}
      <Modal
        isOpen={successArchiveModalOpen}
        onRequestClose={() => setSuccessArchiveModalOpen(false)}
        className="archive-modal-content"
        overlayClassName="archive-modal-overlay"
      >
        <div className="archive-modal-wrapper">
          <h2>{successArchiveText}</h2>
          <button className="archive-close" onClick={() => setSuccessArchiveModalOpen(false)}>
            Cerrar
          </button>
        </div>
      </Modal>
    </>
  );
};

export default ArchiveButton;
