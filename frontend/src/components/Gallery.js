import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Modal from 'react-modal';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import './Gallery.css';

Modal.setAppElement('#root');

const Gallery = () => {
  const [allImages, setAllImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);

  // Estados de modales
  const [confirmDeleteModalOpen, setConfirmDeleteModalOpen] = useState(false);
  const [successDeleteModalOpen, setSuccessDeleteModalOpen] = useState(false);
  const [confirmArchiveModalOpen, setConfirmArchiveModalOpen] = useState(false);
  const [successArchiveModalOpen, setSuccessArchiveModalOpen] = useState(false);

  // Nombres de imagen para mostrar en modal
  const [deleteImageName, setDeleteImageName] = useState('');
  const [archiveImageName, setArchiveImageName] = useState('');

  // Para la vista full screen
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Estado para saber si hay más imágenes
  const [hasMoreImages, setHasMoreImages] = useState(true);

  const API_URL = process.env.REACT_APP_API_URL; 
  const IMAGE_URL = process.env.REACT_APP_IMAGE_URL; 

  useEffect(() => {
    loadRandomImages();
  }, []);

  // Carga 100 imágenes aleatorias sin duplicados
  const loadRandomImages = async () => {
    try {
      // Construimos la lista de IDs a excluir
      const excludeIdsParam = allImages.map(img => img.id).join(',');
      const response = await axios.get(API_URL, {
        params: { exclude_ids: excludeIdsParam }
      });

      if (response.data && response.data.success && Array.isArray(response.data.images)) {
        const newImages = response.data.images;
        
        // Si el backend devolvió menos de 100, probablemente no hay más
        if (newImages.length < 100) {
          setHasMoreImages(false); 
        }

        // Agregar las nuevas imágenes a las anteriores
        setAllImages(prev => [...prev, ...newImages]);
      }
    } catch (error) {
      console.error('Error fetching images:', error);
    }
  };

  // "Cargar más" solo funcionará si hasMoreImages es true
  const handleLoadMore = () => {
    if (hasMoreImages) {
      loadRandomImages();
    }
  };

  // Generar URL de imagen
  const getImageUrl = (filename) => `${IMAGE_URL}&file=${encodeURIComponent(filename)}`;

  const handleSelectImage = (image) => {
    setSelectedImage(image);
  };

  // -- Borrar imagen --
  const openConfirmDeleteModal = () => {
    if (selectedImage) {
      setDeleteImageName(selectedImage.original_name || selectedImage.filename);
      setConfirmDeleteModalOpen(true);
    }
  };

  const deleteImage = async () => {
    if (!selectedImage) return;
    try {
      const response = await axios.delete(`${API_URL}?action=deleteImage`, {
        data: { image_id: selectedImage.id }
      });
      
      if (response.data.success) {
        setConfirmDeleteModalOpen(false);
        setSuccessDeleteModalOpen(true);
        // Remover la imagen borrada de la lista
        setAllImages(prev => prev.filter(img => img.id !== selectedImage.id));
        setSelectedImage(null);
      } else {
        alert(response.data.message || 'Error al eliminar la imagen.');
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      alert('Error deleting image.');
    }
  };

  // -- Archivar imagen --
  const openConfirmArchiveModal = () => {
    if (selectedImage) {
      setArchiveImageName(selectedImage.original_name || selectedImage.filename);
      setConfirmArchiveModalOpen(true);
    }
  };

  const archiveImage = async () => {
    if (!selectedImage) return;
    try {
      const response = await axios.post(`${API_URL}?action=archiveImage`, {
        image_id: selectedImage.id
      });

      if (response.data.success) {
        setConfirmArchiveModalOpen(false);
        setSuccessArchiveModalOpen(true);
        // Remover de la lista
        setAllImages(prev => prev.filter(img => img.id !== selectedImage.id));
        setSelectedImage(null);
      } else {
        alert(response.data.message || 'Error al archivar la imagen.');
      }
    } catch (error) {
      console.error('Error archiving image:', error);
      alert('Error al archivar la imagen.');
    }
  };

  return (
    <div className="gallery-container">
      <div className="gallery-main-section">
        <h2>Gallery</h2>
        <div className="gallery-grid">
          {allImages.map((image, index) => (
            <div
              key={`${image.id}-${index}`}
              className="gallery-thumbnail"
              onClick={() => handleSelectImage(image)}
            >
              <img
                src={getImageUrl(image.filename)}
                alt={image.original_name || image.filename}
                className="gallery-thumbnail-img"
              />
              <p className="gallery-thumbnail-label">
                {image.original_name || image.filename}
              </p>
            </div>
          ))}
        </div>

        {/* Botón "Cargar más" y mensaje si no hay más */}
        {hasMoreImages ? (
          <div className="gallery-load-more">
            <button onClick={handleLoadMore}>
              Cargar más imágenes
            </button>
          </div>
        ) : (
          <p>No hay más imágenes para mostrar.</p>
        )}
      </div>

      {/* Sección de vista previa */}
      <div className="gallery-preview-section">
        {selectedImage && (
          <div className="gallery-preview">
            <h3 className="gallery-preview-title">Imagen seleccionada</h3>
            <p className="tag-thumbnail-label">
              {selectedImage.original_name || selectedImage.filename}
            </p>
            <img
              src={getImageUrl(selectedImage.filename)}
              alt={selectedImage.original_name || selectedImage.filename}
              className="gallery-preview-image"
              onClick={() => setIsFullScreen(true)}
            />
            <div className="gallery-preview-buttons">
              <button 
                className="gallery-archive-button" 
                onClick={openConfirmArchiveModal}
              >
                Archivar Imagen
              </button>
              <button 
                className="gallery-delete-button" 
                onClick={openConfirmDeleteModal}
              >
                Borrar Imagen
              </button>
            </div>
          </div>
        )}
      </div>

      {/* -- Modales -- */}
      <Modal
        isOpen={confirmDeleteModalOpen}
        className="gallery-modal-content"
        overlayClassName="gallery-modal-overlay"
      >
        <h2 className="gallery-modal-title">
          ¿Estás seguro que quieres borrar la imagen "{deleteImageName}"?
        </h2>
        <div className="gallery-modal-buttons">
          <button onClick={deleteImage}>Continuar</button>
          <button onClick={() => setConfirmDeleteModalOpen(false)}>Cancelar</button>
        </div>
      </Modal>

      <Modal
        isOpen={successDeleteModalOpen}
        className="gallery-modal-content"
        overlayClassName="gallery-modal-overlay"
      >
        <h2 className="gallery-modal-title">
          Se borró exitosamente la imagen "{deleteImageName}"
        </h2>
        <button onClick={() => setSuccessDeleteModalOpen(false)}>Cerrar</button>
      </Modal>

      <Modal
        isOpen={confirmArchiveModalOpen}
        className="gallery-modal-content"
        overlayClassName="gallery-modal-overlay"
      >
        <h2 className="gallery-modal-title">
          ¿Archivar esta imagen "{archiveImageName}"?
        </h2>
        <div className="gallery-modal-buttons">
          <button onClick={archiveImage}>Continuar</button>
          <button onClick={() => setConfirmArchiveModalOpen(false)}>Cancelar</button>
        </div>
      </Modal>

      <Modal
        isOpen={successArchiveModalOpen}
        className="gallery-modal-content"
        overlayClassName="gallery-modal-overlay"
      >
        <h2 className="gallery-modal-title">
          Se archivó exitosamente la imagen "{archiveImageName}"
        </h2>
        <button onClick={() => setSuccessArchiveModalOpen(false)}>Cerrar</button>
      </Modal>

      {/* Vista a pantalla completa */}
      {isFullScreen && selectedImage && (
        <div
          className="fullscreen-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsFullScreen(false);
            }
          }}
        >
          <TransformWrapper
            limitToBounds={false}
            wrapperStyle={{ width: '100%', height: '100%' }}
            defaultScale={1}
            defaultPositionX={0}
            defaultPositionY={0}
          >
            {({ zoomIn, zoomOut, resetTransform }) => (
              <>
                <div
                  className="fullscreen-controls"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button onClick={(e) => { e.stopPropagation(); zoomIn(); }}>+</button>
                  <button onClick={(e) => { e.stopPropagation(); zoomOut(); }}>-</button>
                  <button onClick={(e) => { e.stopPropagation(); resetTransform(); }}>Reset</button>
                </div>
                <TransformComponent>
                  <img
                    src={getImageUrl(selectedImage.filename)}
                    alt={selectedImage.original_name || selectedImage.filename}
                    className="fullscreen-image"
                    onClick={(e) => e.stopPropagation()}
                  />
                </TransformComponent>
              </>
            )}
          </TransformWrapper>
        </div>
      )}
    </div>
  );
};

export default Gallery;
