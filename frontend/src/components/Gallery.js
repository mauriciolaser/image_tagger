import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Modal from 'react-modal';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import './Gallery.css';

// Configura el elemento raíz para react-modal
Modal.setAppElement('#root');

const Gallery = () => {
  const [allImages, setAllImages] = useState([]);         
  const [displayedImages, setDisplayedImages] = useState([]);
  
  const [viewArchived, setViewArchived] = useState(false); 
  const [selectedImage, setSelectedImage] = useState(null);

  // Modales de confirmación y éxito para eliminar
  const [confirmDeleteModalOpen, setConfirmDeleteModalOpen] = useState(false);
  const [successDeleteModalOpen, setSuccessDeleteModalOpen] = useState(false);

  // Modales de confirmación y éxito para archivar/restaurar
  const [confirmArchiveModalOpen, setConfirmArchiveModalOpen] = useState(false);
  const [successArchiveModalOpen, setSuccessArchiveModalOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  // Para mostrar en el modal el nombre de la imagen que se está archivando/borrando
  const [archiveImageName, setArchiveImageName] = useState('');
  const [deleteImageName, setDeleteImageName] = useState('');

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const imagesPerPage = 20;

  // Rutas
  const API_URL = process.env.REACT_APP_API_URL;
  const IMAGE_URL = process.env.REACT_APP_IMAGE_URL;

  // Vista fullscreen
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Usuario logueado
  const [loggedUser, setLoggedUser] = useState('');

  // Al montar, obtener el usuario y cargar la página 1 con archived=0
  useEffect(() => {
    const storedUser = localStorage.getItem('username');
    if (storedUser) {
      setLoggedUser(storedUser);
    }
    fetchImages(1, 0); // Por defecto, "Filtrados" (archived=0)
  }, []);

  // Actualiza las imágenes que se muestran cuando cambian allImages o currentPage
  useEffect(() => {
    setDisplayedImages(allImages.slice(0, currentPage * imagesPerPage));
  }, [allImages, currentPage]);

  /**
   * Llama al backend para obtener imágenes con archived=0 o archived=1.
   * @param {number} page - Página a solicitar
   * @param {number} archivedValor - 0 para no archivadas, 1 para archivadas
   */
  const fetchImages = async (page, archivedValor) => {
    try {
      const response = await axios.get(API_URL, {
        params: { 
          action: "getImages", 
          page,
          archived: archivedValor
        }
      });
      if (response.data && Array.isArray(response.data.images)) {
        if (page === 1) {
          // Reinicia la lista
          setAllImages(response.data.images);
        } else {
          // Agrega más resultados
          setAllImages(prev => [...prev, ...response.data.images]);
        }
      }
    } catch (error) {
      console.error('Error fetching images:', error);
    }
  };

  // Genera la URL de la imagen
  const getImageUrl = (filename) => {
    return `${IMAGE_URL}&file=${encodeURIComponent(filename)}`;
  };

  // Selecciona una imagen para previsualizar
  const handleSelectImage = (image) => {
    setSelectedImage(image);
  };

  // ---------- Borrar Imagen ----------
  const openConfirmDeleteModal = () => {
    if (loggedUser !== 'admin' || !selectedImage) return;
    setDeleteImageName(selectedImage.original_name || selectedImage.filename);
    setConfirmDeleteModalOpen(true);
  };

  const deleteImage = async () => {
    if (loggedUser !== 'admin' || !selectedImage) return;
    try {
      const response = await axios.delete(`${API_URL}?action=deleteImage`, {
        data: { image_id: selectedImage.id }
      });

      if (response.data.success) {
        setConfirmDeleteModalOpen(false);
        setSuccessDeleteModalOpen(true);
        // Remover la imagen de la lista
        setAllImages(prev => prev.filter(image => image.id !== selectedImage.id));
        setDisplayedImages(prev => prev.filter(image => image.id !== selectedImage.id));
        setSelectedImage(null);
      } else {
        alert(response.data.message || 'Error al eliminar la imagen.');
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      alert('Error deleting image.');
    }
  };

  // ---------- Archivar / Restaurar Imagen ----------
  // Abre el modal de confirmación para archivar o restaurar
  const openConfirmArchiveModal = () => {
    if (!selectedImage) return;
    setArchiveImageName(selectedImage.original_name || selectedImage.filename);
    setConfirmArchiveModalOpen(true);
  };

  // Acción de archivar o restaurar en base al estado actual de la imagen
  const handleArchiveToggle = async () => {
    if (!selectedImage) return;
    setIsArchiving(true);

    // Si la imagen está archivada (=1), la "restauramos" (ponemos archived=0).
    // De lo contrario, la "archivamos" (archived=1).
    const newArchivedValue = selectedImage.archived === 1 ? 0 : 1;

    try {
      const response = await axios.post(`${API_URL}?action=archiveImage`, {
        image_id: selectedImage.id,
        archived: newArchivedValue
      });

      if (response.data.success) {
        setConfirmArchiveModalOpen(false);
        setSuccessArchiveModalOpen(true);

        // Actualizamos la lista de imágenes:
        // Si la vista actual es "Filtrados" (archived=0) y acabamos de archivar, la quitamos.
        // Si la vista actual es "Archivados" (archived=1) y acabamos de restaurar, la quitamos.
        setAllImages(prev => prev.filter(img => img.id !== selectedImage.id));

        setSelectedImage(null); 
      } else {
        alert(response.data.message || 'Error al modificar el estado de la imagen.');
      }
    } catch (error) {
      console.error('Error toggling archive state:', error);
      alert('Error al modificar el estado de la imagen.');
    } finally {
      setIsArchiving(false);
    }
  };

  // Carga más imágenes en la vista actual
  const loadMoreImages = () => {
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    fetchImages(nextPage, viewArchived ? 1 : 0);
  };

  // Vista filtrados (archived=0)
  const showNonArchived = () => {
    setViewArchived(false);
    setCurrentPage(1);
    setAllImages([]);
    fetchImages(1, 0);
  };

  // Vista archivados (archived=1)
  const showArchived = () => {
    setViewArchived(true);
    setCurrentPage(1);
    setAllImages([]);
    fetchImages(1, 1);
  };

  // Texto dinámico para el botón (Archivar vs Restaurar)
  const archiveButtonText = selectedImage && selectedImage.archived === 1
    ? "Restaurar Imagen"
    : "Archivar Imagen";

  // Texto dinámico para el modal de confirmación (¿Archivar...? vs ¿Restaurar...?)
  const archiveModalText = selectedImage && selectedImage.archived === 1
    ? `¿Restaurar esta imagen "${archiveImageName}"?`
    : `¿Archivar esta imagen "${archiveImageName}"?`;

  // Texto dinámico para el modal de éxito (Se archivó... vs Se restauró...)
  const successArchiveText = selectedImage && selectedImage.archived === 1
    ? `Se restauró exitosamente la imagen "${archiveImageName}"`
    : `Se archivó exitosamente la imagen "${archiveImageName}"`;

  return (
    <div className="gallery-container">
      
      <div className="gallery-main-section">
        <h2>Gallery</h2>

        {/* Controles de filtrado */}
        <div className="gallery-controls">
          <div className="gallery-filter-buttons">
            <button
              className={`gallery-filter-button ${!viewArchived ? 'active' : ''}`}
              onClick={showNonArchived}
            >
              Filtrados
            </button>
            <button
              className={`gallery-filter-button ${viewArchived ? 'active' : ''}`}
              onClick={showArchived}
            >
              Archivados
            </button>
          </div>
        </div>

        {/* Grid de imágenes */}
        <div className="gallery-grid">
          {displayedImages.map((image, index) => (
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

        {/* Botón para cargar más */}
        {allImages.length >= currentPage * imagesPerPage && (
          <div className="gallery-load-more">
            <button className="gallery-load-more-button" onClick={loadMoreImages}>
              Cargar más imágenes
            </button>
          </div>
        )}
      </div>

      {/* Panel de previsualización */}
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
              {/* Botón que cambia Archivar/Restaurar según archived */}
              <button 
                className="gallery-archive-button" 
                onClick={openConfirmArchiveModal}
              >
                {archiveButtonText}
              </button>
              
              {/* El botón Borrar solo aparece si es usuario admin */}
              {loggedUser === 'admin' && (
                <button 
                  className="gallery-delete-button" 
                  onClick={openConfirmDeleteModal}
                >
                  Borrar Imagen
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal de Confirmación para Borrar */}
      <Modal
        isOpen={confirmDeleteModalOpen}
        className="gallery-modal-content"
        overlayClassName="gallery-modal-overlay"
      >
        <h2 className="gallery-modal-title">
          ¿Estás seguro que quieres borrar la imagen "{deleteImageName}"?
        </h2>
        <div className="gallery-modal-buttons">
          <button 
            className="gallery-modal-confirm" 
            onClick={deleteImage}
          >
            Continuar
          </button>
          <button 
            className="gallery-modal-cancel" 
            onClick={() => setConfirmDeleteModalOpen(false)}
          >
            Cancelar
          </button>
        </div>
      </Modal>

      {/* Modal de Confirmación para Archivar/Restaurar */}
      <Modal
        isOpen={confirmArchiveModalOpen}
        className="gallery-modal-content"
        overlayClassName="gallery-modal-overlay"
      >
        <h2 className="gallery-modal-title">
          {archiveModalText}
        </h2>
        <div className="gallery-modal-buttons">
          <button 
            onClick={handleArchiveToggle} 
            disabled={isArchiving} 
            className="gallery-archive-button"
          >
            {isArchiving ? "Procesando..." : "Continuar"}
          </button>
          <button 
            className="gallery-modal-cancel" 
            onClick={() => setConfirmArchiveModalOpen(false)}
          >
            Cancelar
          </button>
        </div>
      </Modal>

      {/* Modal de Éxito al Borrar */}
      <Modal
        isOpen={successDeleteModalOpen}
        className="gallery-modal-content"
        overlayClassName="gallery-modal-overlay"
      >
        <h2 className="gallery-modal-title">
          Se borró exitosamente la imagen "{deleteImageName}"
        </h2>
        <button 
          className="gallery-modal-close" 
          onClick={() => setSuccessDeleteModalOpen(false)}
        >
          Cerrar
        </button>
      </Modal>

      {/* Modal de Éxito al Archivar/Restaurar */}
      <Modal
        isOpen={successArchiveModalOpen}
        className="gallery-modal-content"
        overlayClassName="gallery-modal-overlay"
      >
        <h2 className="gallery-modal-title">
          {successArchiveText}
        </h2>
        <button 
          className="gallery-modal-close" 
          onClick={() => setSuccessArchiveModalOpen(false)}
        >
          Cerrar
        </button>
      </Modal>

      {/* Vista a pantalla completa con zoom y paneo */}
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
                <div className="fullscreen-controls" onClick={(e) => e.stopPropagation()}>
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
