import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Modal from 'react-modal';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { FaSearch } from 'react-icons/fa'; // Para el ícono de lupa
import './Gallery.css';

// Configura el elemento raíz para react-modal
Modal.setAppElement('#root');

const Gallery = () => {
  // Pestaña activa: "search" | "filtrados" | "archivados"
  const [activeTab, setActiveTab] = useState("filtrados");

  // Lista de imágenes y paginación
  const [allImages, setAllImages] = useState([]);         
  const [displayedImages, setDisplayedImages] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const imagesPerPage = 20;

  // Modo fullscreen
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Imagen seleccionada para previsualizar
  const [selectedImage, setSelectedImage] = useState(null);

  // Estado de archivado
  const [viewArchived, setViewArchived] = useState(false);

  // Modales de confirmación (borrar) y éxito
  const [confirmDeleteModalOpen, setConfirmDeleteModalOpen] = useState(false);
  const [successDeleteModalOpen, setSuccessDeleteModalOpen] = useState(false);

  // Modales de confirmación (archivar/restaurar) y éxito
  const [confirmArchiveModalOpen, setConfirmArchiveModalOpen] = useState(false);
  const [successArchiveModalOpen, setSuccessArchiveModalOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  // Nombre de la imagen en los modales
  const [archiveImageName, setArchiveImageName] = useState('');
  const [deleteImageName, setDeleteImageName] = useState('');

  // Usuario logueado
  const [loggedUser, setLoggedUser] = useState('');

  // Estados para la búsqueda individual
  const [searchFileName, setSearchFileName] = useState('');
  const [searchedImageObj, setSearchedImageObj] = useState(null);

  // Rutas de la API
  const API_URL = process.env.REACT_APP_API_URL;     
  const IMAGE_URL = process.env.REACT_APP_IMAGE_URL; 

  // Al montar: obtener el usuario y cargar por defecto "Filtrados" (archived=0)
  useEffect(() => {
    const storedUser = localStorage.getItem('username');
    if (storedUser) {
      setLoggedUser(storedUser);
    }
    fetchImages(1, 0); // Filtrados por defecto
  }, []);

  // Cada vez que cambien allImages o currentPage, actualiza displayedImages
  useEffect(() => {
    setDisplayedImages(allImages.slice(0, currentPage * imagesPerPage));
  }, [allImages, currentPage]);

  /**
   * Llama al backend (getImages.php) con archived=0 ó 1, y página
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
          setAllImages(response.data.images);
        } else {
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

  // Seleccionar imagen para panel de previsualización
  const handleSelectImage = (image) => {
    setSelectedImage(image);
  };

  // -------------- Borrar Imagen --------------
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
        // Sacar la imagen de la lista actual
        setAllImages(prev => prev.filter(img => img.id !== selectedImage.id));
        setDisplayedImages(prev => prev.filter(img => img.id !== selectedImage.id));
        setSelectedImage(null);
      } else {
        alert(response.data.message || 'Error al eliminar la imagen.');
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      alert('Error deleting image.');
    }
  };

  // -------------- Archivar / Restaurar --------------
  const openConfirmArchiveModal = () => {
    if (!selectedImage) return;
    setArchiveImageName(selectedImage.original_name || selectedImage.filename);
    setConfirmArchiveModalOpen(true);
  };

  const handleArchiveToggle = async () => {
    if (!selectedImage) return;
    setIsArchiving(true);

    const newArchivedValue = selectedImage.archived === 1 ? 0 : 1;
    try {
      const response = await axios.post(`${API_URL}?action=archiveImage`, {
        image_id: selectedImage.id,
        archived: newArchivedValue
      });

      if (response.data.success) {
        setConfirmArchiveModalOpen(false);
        setSuccessArchiveModalOpen(true);
        // Quitar la imagen de la lista
        setAllImages(prev => prev.filter(img => img.id !== selectedImage.id));
        setSelectedImage(null);
      } else {
        alert(response.data.message || 'Error al modificar estado de la imagen.');
      }
    } catch (error) {
      console.error('Error toggling archive state:', error);
      alert('Error al modificar estado de la imagen.');
    } finally {
      setIsArchiving(false);
    }
  };

  // -------------- Botones para Filtrados/Archivados/Cargar más --------------
  const showNonArchived = () => {
    setActiveTab("filtrados"); // <-- nuevo
    setViewArchived(false);
    setCurrentPage(1);
    setAllImages([]);
    fetchImages(1, 0);
  };

  const showArchived = () => {
    setActiveTab("archivados"); // <-- nuevo
    setViewArchived(true);
    setCurrentPage(1);
    setAllImages([]);
    fetchImages(1, 1);
  };

  const loadMoreImages = () => {
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    fetchImages(nextPage, viewArchived ? 1 : 0);
  };

  // -------------- Modo Búsqueda --------------
  const handleClickSearch = () => {
    // Cuando clicamos "Búsqueda", activamos esa pestaña
    setActiveTab("search");
    // Si ya teníamos un 'searchedImageObj' o algo, no lo limpiamos a menos que quieras
    // (Depende de la preferencia. Si deseas limpiar cada vez, haz setSearchedImageObj(null))
  };

  // Al cambiar la pestaña a Filtrados/Archivados, no se anula la búsqueda, 
  // pero dejaremos de mostrar la barra de búsqueda (ver lógica en return).
  
  // Manejo de input + Enter
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    handleSearch();
  };

  const handleSearch = async () => {
    if (!searchFileName.trim()) {
      alert("Debes ingresar un nombre de archivo (filename)");
      return;
    }
    try {
      const response = await axios.get(API_URL, {
        params: {
          action: "getImages",
          filename: searchFileName.trim()
        }
      });
      if (response.data.success && response.data.images.length > 0) {
        setSearchedImageObj(response.data.images[0]);
      } else {
        // No se encontró
        setSearchedImageObj(null);
      }
    } catch (error) {
      console.error("Error al buscar la imagen:", error);
      setSearchedImageObj(null);
    }
  };

  // Texto dinámico del botón Archivar/Restaurar
  const archiveButtonText =
    selectedImage && selectedImage.archived === 1
      ? "Restaurar Imagen"
      : "Archivar Imagen";

  // Texto para el modal de confirmación de archivado
  const archiveModalText =
    selectedImage && selectedImage.archived === 1
      ? `¿Restaurar la imagen "${archiveImageName}"?`
      : `¿Archivar la imagen "${archiveImageName}"?`;

  // Texto para el modal de éxito al archivar/restaurar
  const successArchiveText =
    selectedImage && selectedImage.archived === 1
      ? `Se restauró exitosamente la imagen "${archiveImageName}"`
      : `Se archivó exitosamente la imagen "${archiveImageName}"`;

  // Lógica para mostrar/ocultar la barra de búsqueda:
  const isSearchTabActive = (activeTab === "search");

  return (
    <div className="gallery-container">
      <div className="gallery-main-section">
        <h2>Galería de imágenes</h2>

        <div className="gallery-controls">
          <div className="gallery-filter-buttons">
            {/* Botón "Búsqueda" */}
            <button
              className={`gallery-filter-button ${activeTab === 'search' ? 'active' : ''}`}
              onClick={handleClickSearch}
            >
              Búsqueda
            </button>

            {/* Botón "Filtrados" */}
            <button
              className={`gallery-filter-button ${activeTab === 'filtrados' ? 'active' : ''}`}
              onClick={showNonArchived}
            >
              Filtrados
            </button>

            {/* Botón "Archivados" */}
            <button
              className={`gallery-filter-button ${activeTab === 'archivados' ? 'active' : ''}`}
              onClick={showArchived}
            >
              Archivados
            </button>
          </div>
        </div>

        {/* Barra de búsqueda, visible solo si activeTab === 'search' */}
        {isSearchTabActive && (
          <div style={{ marginBottom: "20px" }}>
            <form
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "10px"
              }}
              onSubmit={handleSearchSubmit}
            >
              <input
                type="text"
                placeholder="Ingresa el filename exacto..."
                value={searchFileName}
                onChange={(e) => setSearchFileName(e.target.value)}
                style={{
                  width: "300px",
                  padding: "8px",
                  borderRadius: "5px",
                  border: "2px solid #ccc"
                }}
              />
              <button
                type="submit"
                style={{
                  padding: "8px 16px",
                  borderRadius: "5px",
                  border: "none",
                  backgroundColor: "#2196F3",
                  color: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center"
                }}
              >
                <FaSearch />
              </button>
            </form>

            {/* Mostrar resultado (si existe) */}
            {searchedImageObj && (
              <div style={{ marginTop: "20px" }}>
                <img
                  src={getImageUrl(searchedImageObj.filename)}
                  alt={searchedImageObj.original_name || searchedImageObj.filename}
                  style={{
                    maxWidth: "200px",
                    border: "2px solid #ccc",
                    borderRadius: "6px",
                    cursor: 'pointer'
                  }}
                  onClick={() => handleSelectImage(searchedImageObj)}
                />
                <p style={{ fontSize: "0.9em", color: "#555" }}>
                  {searchedImageObj.original_name || searchedImageObj.filename}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Grilla de imágenes (solo si la pestaña activa NO es "search") */}
        {activeTab !== 'search' && (
          <>
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

            {/* Botón "Cargar más imágenes" si corresponden */}
            {allImages.length >= currentPage * imagesPerPage && (
              <div className="gallery-load-more">
                <button className="gallery-load-more-button" onClick={loadMoreImages}>
                  Cargar más imágenes
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Panel de previsualización (selectedImage) */}
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
              {/* Botón para Archivar/Restaurar */}
              <button 
                className="gallery-archive-button" 
                onClick={openConfirmArchiveModal}
              >
                {archiveButtonText}
              </button>
              
              {/* Botón para Borrar (solo admin) */}
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

      {/* Vista a pantalla completa (fullscreen) */}
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
                  <button onClick={(e) => { e.stopPropagation(); resetTransform(); }}>
                    Reset
                  </button>
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
