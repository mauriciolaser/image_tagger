import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Modal from 'react-modal';
import './Gallery.css';

// Configura el elemento raíz para react-modal
Modal.setAppElement('#root');

const Gallery = () => {
  const [allImages, setAllImages] = useState([]); // Todas las imágenes cargadas hasta el momento
  const [displayedImages, setDisplayedImages] = useState([]); // Imágenes actualmente mostradas
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc': más reciente, 'asc': más antiguo
  const [selectedImage, setSelectedImage] = useState(null);
  const [confirmDeleteModalOpen, setConfirmDeleteModalOpen] = useState(false);
  const [successDeleteModalOpen, setSuccessDeleteModalOpen] = useState(false);
  
  // Estados para el modal de archivar
  const [confirmArchiveModalOpen, setConfirmArchiveModalOpen] = useState(false);
  const [successArchiveModalOpen, setSuccessArchiveModalOpen] = useState(false);
  const [archiveImageName, setArchiveImageName] = useState('');

  const [deleteImageName, setDeleteImageName] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const imagesPerPage = 20;
  const API_URL = process.env.REACT_APP_API_URL; 
  const IMAGE_URL = process.env.REACT_APP_IMAGE_URL; 

  // Al montar el componente, cargar la primera página
  useEffect(() => {
    fetchImages(1);
  }, []);

  // Actualiza las imágenes mostradas cuando cambian allImages o currentPage
  useEffect(() => {
    setDisplayedImages(allImages.slice(0, currentPage * imagesPerPage));
  }, [allImages, currentPage]);

  // Función para solicitar una página de imágenes
  const fetchImages = async (page) => {
    try {
      const response = await axios.get(API_URL, {
        params: { action: "getImages", page }
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

  // Genera la URL de la imagen usando el endpoint del API
  const getImageUrl = (filename) => {
    return `${IMAGE_URL}&file=${encodeURIComponent(filename)}`;
  };

  // Maneja la selección de imagen para mostrar el preview
  const handleSelectImage = (image) => {
    setSelectedImage(image);
  };

  // Abrir modal de confirmación para borrar imagen
  const openConfirmDeleteModal = () => {
    if (selectedImage) {
      setDeleteImageName(selectedImage.original_name || selectedImage.filename);
      setConfirmDeleteModalOpen(true);
    }
  };

  // Función para borrar la imagen seleccionada
  const deleteImage = async () => {
    if (!selectedImage) return;
    try {
      const response = await axios.delete(`${API_URL}?action=deleteImage`, {
        data: { image_id: selectedImage.id }
      });
      
      if (response.data.success) {
        setConfirmDeleteModalOpen(false);
        setSuccessDeleteModalOpen(true);
        // Remover la imagen eliminada de la lista
        setAllImages(prevImages => prevImages.filter(image => image.id !== selectedImage.id));
        setDisplayedImages(prevImages => prevImages.filter(image => image.id !== selectedImage.id));
        setSelectedImage(null);
      } else {
        alert(response.data.message || 'Error al eliminar la imagen.');
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      alert('Error deleting image.');
    }
  };

  // Abrir modal de confirmación para archivar imagen
  const openConfirmArchiveModal = () => {
    if (selectedImage) {
      setArchiveImageName(selectedImage.original_name || selectedImage.filename);
      setConfirmArchiveModalOpen(true);
    }
  };

  // Función para archivar la imagen seleccionada
  const archiveImage = async () => {
    if (!selectedImage) return;
    try {
      const response = await axios.post(`${API_URL}?action=archiveImage`, { image_id: selectedImage.id });
      
      if (response.data.success) {
        setConfirmArchiveModalOpen(false);
        setSuccessArchiveModalOpen(true);
        // Remover la imagen archivada de la lista
        setAllImages(prevImages => prevImages.filter(image => image.id !== selectedImage.id));
        setDisplayedImages(prevImages => prevImages.filter(image => image.id !== selectedImage.id));
        // Deseleccionamos la imagen
        setSelectedImage(null);
      } else {
        alert(response.data.message || 'Error al archivar la imagen.');
      }
    } catch (error) {
      console.error('Error archiving image:', error);
      alert('Error al archivar la imagen.');
    }
  };

  // Función para cargar más imágenes (la siguiente página)
  const loadMoreImages = () => {
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    fetchImages(nextPage);
  };

  return (
    <div className="gallery-container">
      <div className="gallery-main-section">
        <h2>Gallery</h2>
        <div className="gallery-controls">
          <div className="gallery-sort-controls">
            <label htmlFor="sortOrder">Ordenar por fecha: </label>
            <select
              id="sortOrder"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            >
              <option value="desc">Más reciente</option>
              <option value="asc">Más antiguo</option>
            </select>
          </div>
        </div>

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

        {allImages.length >= currentPage * imagesPerPage && (
          <div className="gallery-load-more">
            <button className="gallery-load-more-button" onClick={loadMoreImages}>
              Cargar más imágenes
            </button>
          </div>
        )}
      </div>

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
            />
            <div className="gallery-preview-buttons">
              <button className="gallery-archive-button" onClick={openConfirmArchiveModal}>
                Archivar Imagen
              </button>
              <button className="gallery-delete-button" onClick={openConfirmDeleteModal}>
                Borrar Imagen
              </button>
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
          <button className="gallery-modal-confirm" onClick={deleteImage}>
            Continuar
          </button>
          <button className="gallery-modal-cancel" onClick={() => setConfirmDeleteModalOpen(false)}>
            Cancelar
          </button>
        </div>
      </Modal>

      {/* Modal de Confirmación para Archivar */}
      <Modal
        isOpen={confirmArchiveModalOpen}
        className="gallery-modal-content"
        overlayClassName="gallery-modal-overlay"
      >
        <h2 className="gallery-modal-title">
          ¿Archivar esta imagen "{archiveImageName}"?
        </h2>
        <div className="gallery-modal-buttons">
          <button className="gallery-modal-confirm" onClick={archiveImage}>
            Continuar
          </button>
          <button className="gallery-modal-cancel" onClick={() => setConfirmArchiveModalOpen(false)}>
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
        <button className="gallery-modal-close" onClick={() => setSuccessDeleteModalOpen(false)}>
          Cerrar
        </button>
      </Modal>

      {/* Modal de Éxito al Archivar */}
      <Modal
        isOpen={successArchiveModalOpen}
        className="gallery-modal-content"
        overlayClassName="gallery-modal-overlay"
      >
        <h2 className="gallery-modal-title">
          Se archivó exitosamente la imagen "{archiveImageName}"
        </h2>
        <button className="gallery-modal-close" onClick={() => setSuccessArchiveModalOpen(false)}>
          Cerrar
        </button>
      </Modal>
    </div>
  );
};

export default Gallery;
