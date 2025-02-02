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
  const [tagText, setTagText] = useState('');
  const [message, setMessage] = useState('');
  const [userId, setUserId] = useState(null);
  const [filterType, setFilterType] = useState('Todos');
  const [currentPage, setCurrentPage] = useState(1); // ✅ Manejo de páginas
  const imagesPerPage = 20; // ✅ Límite de imágenes por carga

  const API_URL = process.env.REACT_APP_API_URL;
  const IMAGE_URL = process.env.REACT_APP_IMAGE_URL;


  useEffect(() => {
    fetchUserId();
  }, []);

  useEffect(() => {
    if (userId) {
      fetchImages(1, true); // ✅ Cargar imágenes desde la página 1 al cambiar usuario
    }
  }, [filterType, userId]);

  useEffect(() => {
    if (selectedImage) {
      fetchImageTags(selectedImage.id);
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
      const response = await axios.get(`${process.env.REACT_APP_API_URL}`, {
        params: { action: "getImageTags", page, user_id: userId },
      });
      
      if (response.data && Array.isArray(response.data.images)) {
        setImages((prev) => (reset ? response.data.images : [...prev, ...response.data.images]));
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

  const fetchImageTags = async (imageId) => {
    if (!userId) return;
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}`, {
        params: { action: "getImageTags", image_id: imageId, user_id: userId },
      });
      

      if (response.data && Array.isArray(response.data.images)) {
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

  const handleSelectImage = (image) => {
    setSelectedImage(image);
  };

  const handleTagSubmit = async (e) => {
    e.preventDefault();
    if (!selectedImage || !tagText.trim() || !userId) return;

    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}`, {
        action: "tagImage",
        image_id: selectedImage.id,
        tag: tagText.trim(),
        user_id: userId,
      });
      

      if (response.data.success) {
        setTagText('');
        await fetchImageTags(selectedImage.id);
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
      const response = await axios.post(`${process.env.REACT_APP_API_URL}`, {
        action: "deleteTag",
        image_id: selectedImage.id,
        tag_id: tagId,
        user_id: Number(userId),
      });
      

      if (response.data.success) {
        fetchImageTags(selectedImage.id);
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
                src={`${IMAGE_URL}${image.path}`} 
                alt={image.original_name || image.filename} 
                className="tag-thumbnail-img" 
              />
              <p className="tag-thumbnail-label">{image.original_name || image.filename}</p>
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
            <p className="tag-preview-name">Nombre: {selectedImage.original_name || 'Desconocido'}</p>

            <img 
              src={`${API_URL}${selectedImage.path}`} 
              alt={selectedImage.original_name || selectedImage.filename} 
              className="tag-preview-image"
            />
            <p className="tag-preview-id">ID: {selectedImage.id}</p>

            <div className="tag-management">
              <div className="tag-list-container">
                <h4 className="tag-list-title">Tags agregados:</h4>
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
    </div>
  );
};

export default Tag;