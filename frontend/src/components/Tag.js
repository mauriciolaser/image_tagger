import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Modal from 'react-modal';
import './Tag.css';

Modal.setAppElement('#root');

const Tags = () => {
  // Estados para la carga de imágenes y paginación (igual que en Gallery)
  const [allImages, setAllImages] = useState([]);
  const [displayedImages, setDisplayedImages] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const imagesPerPage = 20;

  // Estado para el filtro de la grilla: "all" (Todas), "with" (Con Tags) o "without" (Sin Tags)
  const [filter, setFilter] = useState("all");
  // Mapeo de image_id a su arreglo de tags (obtenido de getAllTags)
  const [imageTagsMap, setImageTagsMap] = useState({});

  // Estados para la imagen seleccionada y sus tags (consulta individual para el usuario)
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedImageTags, setSelectedImageTags] = useState([]);
  const [selectedImageOtherTags, setSelectedImageOtherTags] = useState([]);
  const [showOtherTags, setShowOtherTags] = useState(false);

  // Otros estados para agregar tags, mostrar mensajes, modal, etc.
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

  // Al montar el componente, se obtiene el user_id de localStorage
  useEffect(() => {
    const storedUserId = localStorage.getItem('user_id');
    if (storedUserId) {
      setUserId(storedUserId);
    } else {
      console.error('No se pudo obtener el user_id.');
    }
  }, []);

  // Una vez obtenido el user_id, se cargan las imágenes mediante la acción "getImages"
  useEffect(() => {
    if (userId) {
      fetchImages(1, true);
    }
  }, [userId]);

  // Cada vez que cambian allImages o currentPage, se actualiza el listado mostrado
  useEffect(() => {
    setDisplayedImages(allImages.slice(0, currentPage * imagesPerPage));
  }, [allImages, currentPage]);

  // Función para cargar imágenes (sin cambios respecto a tu código original)
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

  // Función para llamar al endpoint getAllTags para un listado de imágenes
  // Se espera recibir un array de IDs de imágenes y se construye el parámetro image_ids
  const fetchAllTagsForGrid = async (imageIds) => {
    try {
      const response = await axios.get(API_URL, {
        params: {
          action: "getAllTags",
          image_ids: imageIds.join(',')
        }
      });
      if (response.data.success) {
        // Se actualiza el state fusionando los tags recibidos con los ya almacenados
        setImageTagsMap(prev => ({ ...prev, ...response.data.tags }));
      }
    } catch (error) {
      console.error("Error fetching all tags:", error);
    }
  };

  // Cuando se actualizan las imágenes mostradas, se consulta el endpoint para obtener los tags
  useEffect(() => {
    if (userId && displayedImages.length > 0) {
      // Se seleccionan aquellas imágenes para las cuales aún no se han obtenido tags
      const idsToFetch = displayedImages
        .map(image => image.id)
        .filter(id => !(id in imageTagsMap));
      if (idsToFetch.length > 0) {
        fetchAllTagsForGrid(idsToFetch);
      }
    }
  }, [displayedImages, userId, imageTagsMap]);

  // Se filtran las imágenes mostradas en la grilla según el estado filter y la info en imageTagsMap
  const filteredImages = displayedImages.filter(image => {
    const tags = imageTagsMap[image.id] || [];
    if (filter === "all") return true;
    if (filter === "with") return tags.length > 0;
    if (filter === "without") return tags.length === 0;
    return true;
  });

  // Al seleccionar una imagen, se guarda en selectedImage y se consultan sus tags (acción individual)
  const handleSelectImage = (image) => {
    setSelectedImage(image);
    fetchImageTags(image.id);
    // Reinicia la sección de tags de otros
    setShowOtherTags(false);
    setSelectedImageOtherTags([]);
  };

  // Consulta los tags asignados por el usuario para la imagen seleccionada (acción getImageTags)
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

  // Consulta los tags asignados por otros usuarios para la imagen seleccionada (others=1)
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
        // Actualiza la grilla para reflejar el nuevo tag en la imagen seleccionada
        fetchAllTagsForGrid([selectedImage.id]);
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

  // Manejo de la eliminación de un tag
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
        // Actualiza la grilla para reflejar la eliminación en la imagen seleccionada
        fetchAllTagsForGrid([selectedImage.id]);
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
        {/* Barra de filtros */}
        <div className="tag-filter-bar">
          <button 
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            Todas
          </button>
          <button 
            className={filter === "with" ? "active" : ""}
            onClick={() => setFilter("with")}
          >
            Con Tags
          </button>
          <button 
            className={filter === "without" ? "active" : ""}
            onClick={() => setFilter("without")}
          >
            Sin Tags
          </button>
        </div>
        {/* Grilla de imágenes (se muestran las filtradas) */}
        <div className="tag-images-grid">
          {filteredImages.map(image => (
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
              {/* Sección colapsable para mostrar los tags de otros usuarios */}
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
