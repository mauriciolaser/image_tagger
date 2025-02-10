import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Modal from 'react-modal';
import './Tag.css';

Modal.setAppElement('#root');

const Tags = () => {
  // Estados para la carga de imágenes (idénticos a Gallery)
  const [allImages, setAllImages] = useState([]);
  const [displayedImages, setDisplayedImages] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const imagesPerPage = 20;
  
  // Estados para la imagen seleccionada y la gestión de tags
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedImageTags, setSelectedImageTags] = useState([]);
  const [selectedImageOtherTags, setSelectedImageOtherTags] = useState([]);
  const [showOtherTags, setShowOtherTags] = useState(false);
  
  // Otros estados para agregar tags, mostrar mensajes, etc.
  const [tagText, setTagText] = useState('');
  const [message, setMessage] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [userId, setUserId] = useState(null);
  
  const API_URL = process.env.REACT_APP_API_URL;
  const IMAGE_URL = process.env.REACT_APP_IMAGE_URL;
  
  // Función para generar la URL pública de la imagen
  const getImageUrl = (filename) => {
    return `${IMAGE_URL}&file=${encodeURIComponent(filename)}`;
  };
  
  // Al montar el componente, se obtiene el user_id (igual que en Gallery)
  useEffect(() => {
    const storedUserId = localStorage.getItem('user_id');
    if (storedUserId) {
      setUserId(storedUserId);
    } else {
      console.error('No se pudo obtener el user_id.');
    }
  }, []);
  
  // Una vez que se obtiene el user_id, se cargan las imágenes usando la acción "getImages"
  useEffect(() => {
    if (userId) {
      fetchImages(1, true);
    }
  }, [userId]);
  
  // Cada vez que cambian allImages o currentPage, actualiza el listado mostrado
  useEffect(() => {
    setDisplayedImages(allImages.slice(0, currentPage * imagesPerPage));
  }, [allImages, currentPage]);
  
  // Función para cargar imágenes (usando la misma lógica que Gallery)
  const fetchImages = async (page, reset = false) => {
    try {
      const response = await axios.get(API_URL, {
        params: { action: "getImages", page }
      });
      if (response.data && Array.isArray(response.data.images)) {
        if (reset) {
          setAllImages(response.data.images);
        } else {
          setAllImages(prev => [...prev, ...response.data.images]);
        }
        setCurrentPage(page);
      }
    } catch (error) {
      console.error("Error fetching images:", error);
    }
  };
  
  // Al seleccionar una imagen, se guarda y se consultan sus tags propios
  const handleSelectImage = (image) => {
    setSelectedImage(image);
    fetchImageTags(image.id);
    // Reinicia la sección de tags de otros
    setShowOtherTags(false);
    setSelectedImageOtherTags([]);
  };
  
  // Consulta los tags asignados por el usuario para la imagen seleccionada (action "getImageTags")
  const fetchImageTags = async (imageId) => {
    if (!userId) return;
    try {
      const response = await axios.get(API_URL, {
        params: { action: "getImageTags", image_id: imageId, user_id: userId }
      });
      if (response.data && Array.isArray(response.data.images) && response.data.images.length > 0) {
        const imageData = response.data.images[0];
        setSelectedImageTags(imageData.tags || []);
      } else {
        setSelectedImageTags([]);
      }
    } catch (error) {
      console.error("Error fetching image tags:", error);
      setSelectedImageTags([]);
    }
  };
  
  // Consulta los tags asignados por otros usuarios para la imagen seleccionada (usando others=1)
  const fetchOtherImageTags = async (imageId) => {
    if (!userId) return;
    try {
      const response = await axios.get(API_URL, {
        params: { action: "getImageTags", image_id: imageId, user_id: userId, others: 1 }
      });
      if (response.data && Array.isArray(response.data.images) && response.data.images.length > 0) {
        const imageData = response.data.images[0];
        setSelectedImageOtherTags(imageData.tags || []);
      } else {
        setSelectedImageOtherTags([]);
      }
    } catch (error) {
      console.error("Error fetching other image tags:", error);
      setSelectedImageOtherTags([]);
    }
  };
  
  // Manejo del envío de un nuevo tag
  const handleTagSubmit = async (e) => {
    e.preventDefault();
    if (!selectedImage || !tagText.trim() || !userId) return;
    try {
      const response = await axios.post(API_URL, {
        action: "tagImage",
        image_id: selectedImage.id,
        tag: tagText.trim(),
        user_id: userId,
      });
      if (response.data.success) {
        await fetchImageTags(selectedImage.id);
        setModalMessage(`Tag: ${tagText.trim()} agregado`);
        setModalOpen(true);
        setTagText('');
      } else {
        setMessage(response.data.message || 'No se pudo agregar el tag.');
      }
    } catch (error) {
      console.error("Error tagging image:", error);
      setMessage('Error al enviar el tag.');
    }
  };
  
  // Manejo de la eliminación de un tag con modal al borrar
  const handleTagDelete = async (tagId, tagName) => {
    if (!selectedImage || !userId) return;
    try {
      const response = await axios.post(API_URL, {
        action: "deleteTag",
        image_id: selectedImage.id,
        tag_id: tagId,
        user_id: userId,
      });
      if (response.data.success) {
        await fetchImageTags(selectedImage.id);
        // Mostrar modal con mensaje de borrado exitoso y nombre del tag borrado
        setModalMessage(`Borraste el tag "${tagName}"`);
        setModalOpen(true);
      } else {
        setMessage(response.data.message || 'No se pudo eliminar el tag.');
      }
    } catch (error) {
      console.error("Error deleting tag:", error);
      setMessage('Error al eliminar el tag.');
    }
  };
  
  // Función para cargar más imágenes (la siguiente página)
  const loadMoreImages = () => {
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    fetchImages(nextPage);
  };
  
  return (
    <div className="tag-container">
      <div className="tag-main-section">
        <h2>Tags</h2>
        <div className="tag-images-grid">
          {displayedImages.map(image => (
            <div key={image.id} className="tag-thumbnail" onClick={() => handleSelectImage(image)}>
              <img
                src={getImageUrl(image.filename)}
                alt={image.original_name || image.filename}
                className="tag-thumbnail-img"
              />
              <p className="tag-thumbnail-label">{image.original_name || image.filename}</p>
            </div>
          ))}
        </div>
        {allImages.length >= currentPage * imagesPerPage && (
          <div className="tag-load-more">
            <button className="tag-load-more-button" onClick={loadMoreImages}>
              Cargar más imágenes
            </button>
          </div>
        )}
      </div>
      
      {selectedImage && (
        <div className="tag-preview-section">
          <div className="tag-preview-container">
            <h3>Imagen Seleccionada</h3>
            <p>{selectedImage.original_name || selectedImage.filename}</p>
            <img
              src={getImageUrl(selectedImage.filename)}
              alt={selectedImage.original_name || selectedImage.filename}
              className="tag-preview-image"
            />
            <div className="tag-management">
              <div className="tag-list-container">
                <h4>Mis Tags:</h4>
                {selectedImageTags.length > 0 ? (
                  <ul className="tag-list">
                    {selectedImageTags.map(tag => (
                      <li key={tag.id} className="tag-list-item">
                        <span>{tag.name}</span>
                        <button
                          className="tag-delete-button"
                          onClick={() => handleTagDelete(tag.id, tag.name)}
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="tag-empty-message">No hay tags para esta imagen.</p>
                )}
              </div>
              {/* Sección oculta para mostrar los tags de otros usuarios */}
              <div className="tag-list-others">
                <div
                  className="tag-list-others-header"
                  onClick={() => {
                    setShowOtherTags(!showOtherTags);
                    if (!showOtherTags) {
                      fetchOtherImageTags(selectedImage.id);
                    }
                  }}
                  style={{ cursor: 'pointer', marginTop: '1rem' }}
                >
                  <span className="toggle-icon">{showOtherTags ? '−' : '+'}</span> Tags de otros
                </div>
                {showOtherTags && (
                  <div className="tag-list-others-content">
                    {selectedImageOtherTags.length > 0 ? (
                      <ul className="tag-list">
                        {selectedImageOtherTags.map(tag => (
                          <li key={tag.id} className="tag-list-item">
                            <span>{tag.name}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="tag-empty-message">No hay tags de otros usuarios.</p>
                    )}
                  </div>
                )}
              </div>
              <div className="tag-input-wrapper">
                <h4>Agregar un tag</h4>
                <form className="tag-input-form" onSubmit={handleTagSubmit}>
                  <input
                    type="text"
                    className="tag-input-field"
                    placeholder="Escribe un tag..."
                    value={tagText}
                    onChange={(e) => setTagText(e.target.value)}
                  />
                  <button type="submit" className="tag-submit-button">Agregar</button>
                </form>
                {message && <p className="tag-error-message">{message}</p>}
              </div>
            </div>
          </div>
        </div>
      )}
      
      <Modal
        isOpen={modalOpen}
        onRequestClose={() => setModalOpen(false)}
        contentLabel="Tag asignado"
        style={{
          content: {
            width: '400px',
            height: '200px',
            margin: 'auto',
            textAlign: 'center'
          }
        }}
      >
        <h2>{modalMessage}</h2>
        <button onClick={() => setModalOpen(false)}>Cerrar</button>
      </Modal>
    </div>
  );
};

export default Tags;
