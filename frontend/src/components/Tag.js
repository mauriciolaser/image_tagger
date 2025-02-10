import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Modal from 'react-modal';
import './Tag.css';

Modal.setAppElement('#root');

const Tag = () => {
  const [images, setImages] = useState([]);
  const [filteredImages, setFilteredImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedImageTags, setSelectedImageTags] = useState([]);
  const [selectedImageOtherTags, setSelectedImageOtherTags] = useState([]); // Nuevos tags de otros
  const [showOtherTags, setShowOtherTags] = useState(false); // Controla si se muestran los tags de otros
  const [tagText, setTagText] = useState('');
  const [message, setMessage] = useState('');
  const [userId, setUserId] = useState(null);
  const [filterType, setFilterType] = useState('Todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [modalMessage, setModalMessage] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const imagesPerPage = 20;

  const API_URL = process.env.REACT_APP_API_URL;
  const IMAGE_URL = process.env.REACT_APP_IMAGE_URL;

  // Genera la URL pública de la imagen
  const getImageUrl = (filename) => {
    return `${IMAGE_URL}&file=${encodeURIComponent(filename)}`;
  };

  useEffect(() => {
    fetchUserId();
  }, []);

  useEffect(() => {
    if (userId) {
      fetchImages(1, true); // Cargar imágenes desde la página 1 al cambiar usuario o filtro
    }
  }, [filterType, userId]);

  useEffect(() => {
    if (selectedImage) {
      fetchImageTags(selectedImage.id);
      // Cada vez que se selecciona una imagen, se oculta la sección de tags de otros
      setShowOtherTags(false);
      setSelectedImageOtherTags([]);
    }
  }, [selectedImage]);

  useEffect(() => {
    let filtered = images;
    if (filterType === 'Con Tag') {
      filtered = images.filter((img) => img.tags && img.tags.length > 0);
    } else if (filterType === 'Sin Tag') {
      filtered = images.filter((img) => !img.tags || img.tags.length === 0);
    }
    setFilteredImages(filtered);
  }, [images, filterType]);

  const fetchImages = async (page, reset = false) => {
    if (!userId) return;
    try {
      const response = await axios.get(API_URL, {
        params: { action: "getImageTags", page, user_id: userId },
      });
      if (response.data && Array.isArray(response.data.images)) {
        setImages((prev) =>
          reset ? response.data.images : [...prev, ...response.data.images]
        );
        setCurrentPage(page);
      }
    } catch (error) {
      console.error("Error fetching images:", error);
    }
  };

  const fetchUserId = async () => {
    const storedUserId = localStorage.getItem('user_id');
    if (storedUserId) {
      setUserId(storedUserId);
    } else {
      console.error('No se pudo obtener el user_id.');
    }
  };

  // Obtiene los tags agregados por el usuario actual
  const fetchImageTags = async (imageId) => {
    if (!userId) return;
    try {
      const response = await axios.get(API_URL, {
        params: { action: "getImageTags", image_id: imageId, user_id: userId },
      });
      if (
        response.data &&
        Array.isArray(response.data.images) &&
        response.data.images.length > 0
      ) {
        const image = response.data.images[0];
        setSelectedImageTags(image?.tags || []);
      } else {
        setSelectedImageTags([]);
      }
    } catch (error) {
      console.error("Error fetching image tags:", error);
      setSelectedImageTags([]);
    }
  };

  // Obtiene los tags agregados por otros usuarios
  const fetchOtherImageTags = async (imageId) => {
    if (!userId) return;
    try {
      const response = await axios.get(API_URL, {
        params: { action: "getImageTags", image_id: imageId, user_id: userId, others: 1 },
      });
      if (
        response.data &&
        Array.isArray(response.data.images) &&
        response.data.images.length > 0
      ) {
        const image = response.data.images[0];
        setSelectedImageOtherTags(image?.tags || []);
      } else {
        setSelectedImageOtherTags([]);
      }
    } catch (error) {
      console.error("Error fetching other image tags:", error);
      setSelectedImageOtherTags([]);
    }
  };

  const handleSelectImage = (image) => {
    setSelectedImage(image);
  };

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
        // Actualizar tags inmediatamente
        await fetchImageTags(selectedImage.id);
        const username = localStorage.getItem('username') || "UsuarioReal";
        setModalMessage(`Tag: ${tagText.trim()} asignado correctamente para el usuario ${username}`);
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

  const handleTagDelete = async (tagId) => {
    if (!selectedImage || !userId) return;
    try {
      const response = await axios.post(API_URL, {
        action: "deleteTag",
        image_id: selectedImage.id,
        tag_id: tagId,
        user_id: Number(userId),
      });
      if (response.data.success) {
        await fetchImageTags(selectedImage.id);
      } else {
        setMessage(response.data.message || 'No se pudo eliminar el tag.');
      }
    } catch (error) {
      console.error("Error deleting tag:", error);
      setMessage('Error al eliminar el tag.');
    }
  };

  const loadMoreImages = () => {
    fetchImages(currentPage + 1);
  };

  return (
    <div className="tag-container">
      <div className="tag-main-section">
        <div className="tag-header">
          <h2 className="tag-title">Tag Images</h2>
        </div>
        <div className="tag-controls">
          <div className="tag-filter-container">
            <label className="tag-filter-label">Filtrar por:</label>
            <select 
              className="tag-filter-select"
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="Todos">Todos</option>
              <option value="Con Tag">Con Tag</option>
              <option value="Sin Tag">Sin Tag</option>
            </select>
          </div>
        </div>
        <div className="tag-images-grid">
          {filteredImages.map((image) => (
            <div 
              key={image.id} 
              className="tag-thumbnail" 
              onClick={() => handleSelectImage(image)}
            >
              <img 
                src={getImageUrl(image.filename)} 
                alt={image.original_name || image.filename} 
                className="tag-thumbnail-img" 
              />
              <p className="tag-thumbnail-label">
                {image.original_name || image.filename}
              </p>
            </div>
          ))}
        </div>
        {filteredImages.length >= currentPage * imagesPerPage && (
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
            <h3 className="tag-preview-title">Imagen Seleccionada</h3>
            <p className="tag-preview-name">
              Nombre: {selectedImage.original_name || 'Desconocido'}
            </p>
            <img 
              src={getImageUrl(selectedImage.filename)} 
              alt={selectedImage.original_name || selectedImage.filename} 
              className="tag-preview-image"
            />
            <p className="tag-preview-id">ID: {selectedImage.id}</p>
            <div className="tag-management">
              <div className="tag-list-container">
                <h4 className="tag-list-title">Tags agregados por mí:</h4>
                {selectedImageTags.length > 0 ? (
                  <ul className="tag-list">
                    {selectedImageTags.map((tag) => (
                      <li key={tag.id} className="tag-list-item">
                        <span className="tag-item-name">{tag.name}</span>
                        <button 
                          className="tag-delete-button"
                          onClick={() => handleTagDelete(tag.id)}
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
                    // Si se abre la sección, se solicita la información
                    if (!showOtherTags) {
                      fetchOtherImageTags(selectedImage.id);
                    }
                  }}
                  style={{ cursor: "pointer", marginTop: "1rem" }}
                >
                  <span className="toggle-icon">{showOtherTags ? '−' : '+'}</span> Tags de otros
                </div>
                {showOtherTags && (
                  <div className="tag-list-others-content">
                    {selectedImageOtherTags.length > 0 ? (
                      <ul className="tag-list">
                        {selectedImageOtherTags.map((tag) => (
                          <li key={tag.id} className="tag-list-item">
                            <span className="tag-item-name">{tag.name}</span>
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
                <h4 className="tag-input-title">Agregar un tag</h4>
                <form className="tag-input-form" onSubmit={handleTagSubmit}>
                  <input
                    type="text"
                    className="tag-input-field"
                    placeholder="Escribe un tag..."
                    value={tagText}
                    onChange={(e) => setTagText(e.target.value)}
                  />
                  <button type="submit" className="tag-submit-button">
                    Agregar
                  </button>
                </form>
                {message && <p className="tag-error-message">{message}</p>}
              </div>
            </div>
          </div>
        </div>
      )}
      {modalOpen && (
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
      )}
    </div>
  );
};

export default Tag;
