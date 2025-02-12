import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Modal from 'react-modal';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import './Tag.css';

Modal.setAppElement('#root');

const Tags = () => {
  // Estados para carga de imágenes, paginación y filtrado
  const [allImages, setAllImages] = useState([]);
  const [displayedImages, setDisplayedImages] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const imagesPerPage = 300;

  // Por defecto, filtramos "with" (imágenes con tags)
  const [filter, setFilter] = useState("with");

  // Mapa de tags por imagen (para la vista en miniatura)
  const [imageTagsMap, setImageTagsMap] = useState({});

  // Estados para imagen seleccionada y sus tags
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedImageTags, setSelectedImageTags] = useState([]);
  const [selectedImageOtherTags, setSelectedImageOtherTags] = useState([]);
  const [showOtherTags, setShowOtherTags] = useState(false);

  // Otros estados para el manejo de tags, mensajes y modal
  const [tagText, setTagText] = useState('');
  const [message, setMessage] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [userId, setUserId] = useState(null);

  // Estado para la vista fullscreen de la imagen
  const [isFullScreen, setIsFullScreen] = useState(false);

  const API_URL = process.env.REACT_APP_API_URL;  // e.g. "https://valledemajes.website/image_tagger/api/index.php"
  const IMAGE_URL = process.env.REACT_APP_IMAGE_URL; 

  // Función para generar la URL pública de la imagen
  const getImageUrl = (filename) => {
    return `${IMAGE_URL}&file=${encodeURIComponent(filename)}`;
  };

  // Al montar el componente, obtenemos el user_id de localStorage
  useEffect(() => {
    const storedUserId = localStorage.getItem('user_id');
    if (storedUserId) {
      setUserId(storedUserId);
    } else {
      console.error('No se pudo obtener el user_id.');
    }
  }, []);

  // Una vez obtenido el user_id, se cargan las imágenes con archived=0
  // y por defecto estamos en "Con Tags" (filtro="with")
  useEffect(() => {
    if (userId) {
      // Cargamos la 1era página con "with_tags=1" => “Con Tags”
      fetchImages(1, true, 1);
    }
  }, [userId]);

  // Actualiza las imágenes mostradas en función de la paginación (interno en el front)
  useEffect(() => {
    setDisplayedImages(allImages.slice(0, currentPage * imagesPerPage));
  }, [allImages, currentPage]);

  /**
   * Función para obtener las imágenes desde el backend usando action=getTaggedImages
   * @param {number} page - Número de página
   * @param {boolean} reset - Si true, reinicia la lista
   * @param {number|null} withTagsParam - 1 => con tags, 0 => sin tags, null => todas
   */
  const fetchImages = async (page, reset = false, withTagsParam = null) => {
    try {
      const params = {
        action: 'getTaggedImages', // <-- Usamos esta action
        page,
        archived: 0
      };
      if (withTagsParam !== null) {
        params.with_tags = withTagsParam; // '1' o '0'
      }

      const response = await axios.get(API_URL, { params });

      if (response.data && Array.isArray(response.data.images)) {
        // Reemplaza o añade imágenes según reset
        if (reset) {
          setAllImages(response.data.images);
        } else {
          setAllImages(prev => [...prev, ...response.data.images]);
        }
        // Actualiza la página actual
        setCurrentPage(page);
      }
    } catch (error) {
      console.error("Error fetching images:", error);
    }
  };

  // Obtiene los tags de un grupo de imágenes (para la vista en miniatura)
  const fetchAllTagsForGrid = async (imageIds) => {
    try {
      const response = await axios.get(API_URL, {
        params: {
          action: "getAllTags",
          image_ids: imageIds.join(',')
        }
      });
      if (response.data.success) {
        setImageTagsMap(prev => ({ ...prev, ...response.data.tags }));
      }
    } catch (error) {
      console.error("Error fetching all tags:", error);
    }
  };

  // Cada vez que cambia displayedImages, llamamos a fetchAllTagsForGrid (si hay imágenes nuevas)
  useEffect(() => {
    if (userId && displayedImages.length > 0) {
      const idsToFetch = displayedImages
        .map(img => img.id)
        .filter(id => !(id in imageTagsMap));

      if (idsToFetch.length > 0) {
        fetchAllTagsForGrid(idsToFetch);
      }
    }
  }, [displayedImages, userId, imageTagsMap]);

  // Filtramos localmente las imágenes con tags o sin tags
  const filteredImages = displayedImages.filter(image => {
    const tags = imageTagsMap[image.id] || [];
    if (filter === "with") {
      return tags.length > 0;
    } else if (filter === "without") {
      return tags.length === 0;
    }
    return true;
  });

  // Seleccionar una imagen => se consulta sus tags de usuario
  const handleSelectImage = (image) => {
    setSelectedImage(image);
    fetchImageTags(image.id);
    setShowOtherTags(false);
    setSelectedImageOtherTags([]);
  };

  // Obtiene los tags (del usuario actual) de una imagen
  const fetchImageTags = async (imageId) => {
    if (!userId) return;
    try {
      const response = await axios.get(API_URL, {
        params: {
          action: "getImageTags",
          image_id: imageId,
          user_id: userId
        }
      });
      if (response.data?.images?.length > 0) {
        setSelectedImageTags(response.data.images[0].tags || []);
      } else {
        setSelectedImageTags([]);
      }
    } catch (error) {
      console.error("Error fetching image tags:", error);
      setSelectedImageTags([]);
    }
  };

  // Obtiene los tags (de otros usuarios) de la imagen
  const fetchOtherImageTags = async (imageId) => {
    if (!userId) return;
    try {
      const response = await axios.get(API_URL, {
        params: {
          action: "getImageTags",
          image_id: imageId,
          user_id: userId,
          others: 1
        }
      });
      if (response.data?.images?.length > 0) {
        setSelectedImageOtherTags(response.data.images[0].tags || []);
      } else {
        setSelectedImageOtherTags([]);
      }
    } catch (error) {
      console.error("Error fetching other image tags:", error);
      setSelectedImageOtherTags([]);
    }
  };

  // Agregar un tag
  const handleTagSubmit = async (e) => {
    e.preventDefault();
    if (!selectedImage || !tagText.trim() || !userId) return;
    try {
      const response = await axios.post(API_URL, {
        action: "tagImage",
        image_id: selectedImage.id,
        tag: tagText.trim(),
        user_id: userId
      });
      if (response.data.success) {
        await fetchImageTags(selectedImage.id);
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

  // Eliminar un tag
  const handleTagDelete = async (tagId, tagName) => {
    if (!selectedImage || !userId) return;
    try {
      const response = await axios.post(API_URL, {
        action: "deleteTag",
        image_id: selectedImage.id,
        tag_id: tagId,
        user_id: userId
      });
      if (response.data.success) {
        await fetchImageTags(selectedImage.id);
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

  // Cargar más imágenes => incrementamos la página. 
  // Reusamos el mismo with_tagsParam (según el filtro actual).
  const loadMoreImages = () => {
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);

    if (filter === 'with') {
      // with_tags=1
      fetchImages(nextPage, false, 1);
    } else if (filter === 'without') {
      // with_tags=0
      fetchImages(nextPage, false, 0);
    } else {
      // no tags param
      fetchImages(nextPage, false, null);
    }
  };

  // Cambiar a "Con Tags"
  const handleShowWithTags = () => {
    setFilter("with");
    setCurrentPage(1);
    setAllImages([]);
    // Llamada con with_tags=1
    fetchImages(1, true, 1);
  };

  // Cambiar a "Sin Tags"
  const handleShowWithoutTags = () => {
    setFilter("without");
    setCurrentPage(1);
    setAllImages([]);
    // Llamada con with_tags=0
    fetchImages(1, true, 0);
  };

  return (
    <div className="tag-container">
      <div className="tag-main-section">
        <h2>Tags</h2>
        
        {/* Barra de filtros (solo Con Tags y Sin Tags) */}
        <div className="tag-filter-bar">
          <button 
            className={filter === "with" ? "active" : ""}
            onClick={handleShowWithTags}
          >
            Con Tags
          </button>
          <button 
            className={filter === "without" ? "active" : ""}
            onClick={handleShowWithoutTags}
          >
            Sin Tags
          </button>
        </div>

        {/* Grilla de imágenes filtradas en front: */}
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
              <p className="tag-thumbnail-label">{image.original_name || image.filename}</p>
            </div>
          ))}
        </div>

        {/* Botón de "Cargar más" si hemos recibido al menos currentPage * imagesPerPage imágenes */}
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
            {/* Vista fullscreen al hacer clic */}
            <img
              src={getImageUrl(selectedImage.filename)}
              alt={selectedImage.original_name || selectedImage.filename}
              className="tag-preview-image"
              onClick={() => setIsFullScreen(true)}
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

              {/* Sección colapsable para los tags de otros usuarios */}
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
                  <span className="toggle-icon">{showOtherTags ? '−' : '+'}</span> 
                  Tags de otros
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

      {/* Vista fullscreen de la imagen con zoom/pan */}
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

      {/* Modal de mensaje (agregado/eliminado tag) */}
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
