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
  const [deleteImageName, setDeleteImageName] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const imagesPerPage = 20;
  const API_URL = process.env.REACT_APP_API_URL;

  // Al montar el componente, cargar la primera página
  useEffect(() => {
    fetchImages(1);
  }, []);

  // Cada vez que cambie allImages o currentPage, actualizamos las imágenes mostradas
  useEffect(() => {
    // Mostramos las imágenes hasta el índice correspondiente a currentPage * imagesPerPage
    setDisplayedImages(allImages.slice(0, currentPage * imagesPerPage));
  }, [allImages, currentPage]);

  // Función que solicita la página de imágenes (se asume que el backend soporta ?page=)
  const fetchImages = async (page) => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}`, {
        params: { action: "getImages", page }
      });
      
      if (response.data && Array.isArray(response.data.images)) {
        // Si es la primera página, reemplazamos; si no, agregamos
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

  // Maneja la selección de imagen para mostrar el preview
  const handleSelectImage = (image) => {
    setSelectedImage(image);
  };

  // Abre el modal de confirmación de borrado para la imagen seleccionada
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
      const response = await axios.post(`${process.env.REACT_APP_API_URL}`, { 
        action: "deleteImage", 
        image_id: selectedImage.id 
      });
      
      if (response.data.success) {
        setConfirmDeleteModalOpen(false);
        setSuccessDeleteModalOpen(true);
        // Elimina la imagen eliminada del array allImages
        setAllImages(prevImages => prevImages.filter(image => image.id !== selectedImage.id));
        // También elimina de displayedImages (si se mantiene independiente; si displayedImages se deriva de allImages, se actualizará con el useEffect)
        setDisplayedImages(prevImages => prevImages.filter(image => image.id !== selectedImage.id));
        // Limpia la imagen seleccionada
        setSelectedImage(null);
      } else {
        alert(response.data.message || 'Error al eliminar la imagen.');
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      alert('Error deleting image.');
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
                src={`${API_URL}${image.path}`}
                alt={image.original_name || image.filename}
                className="gallery-thumbnail-img"
              />
              <p className="gallery-thumbnail-label">{image.original_name || image.filename}</p>
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
            <p className="tag-thumbnail-label">{selectedImage.original_name || selectedImage.filename}</p>
            <img
              src={`${API_URL}${selectedImage.path}`}
              alt={selectedImage.original_name || selectedImage.filename}
              className="gallery-preview-image"
            />
            <button className="gallery-delete-button" onClick={openConfirmDeleteModal}>
              Borrar Imagen
            </button>
          </div>
        )}
      </div>

      {/* Modals (permanecen igual excepto por las clases) */}
      <Modal
        isOpen={confirmDeleteModalOpen}
        // ... (props permanecen iguales)
        className="gallery-modal-content"
        overlayClassName="gallery-modal-overlay"
      >
        <h2 className="gallery-modal-title">¿Estás seguro que quieres borrar la imagen "{deleteImageName}"?</h2>
        <div className="gallery-modal-buttons">
          <button className="gallery-modal-confirm" onClick={deleteImage}>Continuar</button>
          <button className="gallery-modal-cancel" onClick={() => setConfirmDeleteModalOpen(false)}>Cancelar</button>
        </div>
      </Modal>

      <Modal
        isOpen={successDeleteModalOpen}
        // ... (props permanecen iguales)
        className="gallery-modal-content"
        overlayClassName="gallery-modal-overlay"
      >
        <h2 className="gallery-modal-title">Se borró exitosamente la imagen "{deleteImageName}"</h2>
        <button className="gallery-modal-close" onClick={() => setSuccessDeleteModalOpen(false)}>Cerrar</button>
      </Modal>
    </div>
  );
};

export default Gallery;