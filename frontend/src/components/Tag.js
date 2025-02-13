import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Modal from 'react-modal';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import './Tag.css';

Modal.setAppElement('#root');

const Tags = () => {
  const [allImages, setAllImages] = useState([]);
  const [displayedImages, setDisplayedImages] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const imagesPerPage = 300;

  // Por defecto, filtramos "with" (imágenes con tags)
  const [filter, setFilter] = useState("with");

  const [imageTagsMap, setImageTagsMap] = useState({});

  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedImageTags, setSelectedImageTags] = useState([]);
  const [selectedImageOtherTags, setSelectedImageOtherTags] = useState([]);
  const [showOtherTags, setShowOtherTags] = useState(false);

  const [tagText, setTagText] = useState('');
  const [message, setMessage] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [userId, setUserId] = useState(null);

  const [isFullScreen, setIsFullScreen] = useState(false);

  const API_URL = process.env.REACT_APP_API_URL;
  const IMAGE_URL = process.env.REACT_APP_IMAGE_URL;

  // [NUEVO] Estados para búsquedas (tags incluidos / excluidos)
  const [includedTags, setIncludedTags] = useState([]);     // Lista de strings
  const [excludedTags, setExcludedTags] = useState([]);     // Lista de strings
  const [includedTagInput, setIncludedTagInput] = useState('');
  const [excludedTagInput, setExcludedTagInput] = useState('');

  // Generar la URL pública de la imagen
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

  // Una vez obtenido el user_id, se cargan las imágenes con archived=0 y por defecto "with_tags=1"
  useEffect(() => {
    if (userId) {
      fetchImages(1, true, 1);
    }
  }, [userId]);

  // Actualiza las imágenes mostradas en función de la paginación (interno en el front)
  useEffect(() => {
    setDisplayedImages(allImages.slice(0, currentPage * imagesPerPage));
  }, [allImages, currentPage]);

  /**
   * Obtener imágenes desde el backend usando action=getTaggedImages
   * @param {number} page
   * @param {boolean} reset
   * @param {number|null} withTagsParam - 1 => con tags, 0 => sin tags, null => todas
   */
  const fetchImages = async (page, reset = false, withTagsParam = null) => {
    try {
      const params = {
        action: 'getTaggedImages',
        page,
        archived: 0
      };
      if (withTagsParam !== null) {
        params.with_tags = withTagsParam;
      }

      const response = await axios.get(API_URL, { params });

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

  // Obtiene los tags de un grupo de imágenes (para mostrar en la grilla)
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

  // Cada vez que cambia displayedImages, llamamos a fetchAllTagsForGrid
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

  /**
   * [NUEVO] Función que revisa si `tags` (array de objetos {id, name})
   * cumple con las condiciones de includedTags y excludedTags.
   */
  const matchIncludedExcluded = (tags) => {
    // Obtenemos el array de strings (lowercase) de los nombres de los tags
    const tagNames = tags.map(t => t.name.toLowerCase());

    // Verificar que estén TODOS los incluidos
    for (let inc of includedTags) {
      if (!tagNames.includes(inc.toLowerCase())) {
        return false;
      }
    }
    // Verificar que NO esté ninguno de los excluidos
    for (let exc of excludedTags) {
      if (tagNames.includes(exc.toLowerCase())) {
        return false;
      }
    }
    return true;
  };

  // Filtrado local de imágenes
  const filteredImages = displayedImages.filter(image => {
    const tags = imageTagsMap[image.id] || [];

    if (filter === "with") {
      // Deben tener al menos 1 tag,
      // y adicionalmente cumplir con included/excluded
      return tags.length > 0 && matchIncludedExcluded(tags);
    } else if (filter === "without") {
      // Deben tener 0 tags
      // (No se aplica el matchIncludedExcluded, porque "without" no va con esa búsqueda)
      return tags.length === 0;
    }
    return true;
  });

  // Seleccionar una imagen
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

  // Agregar un tag a la imagen seleccionada
  const handleTagSubmit = async (e) => {
    e.preventDefault();
    if (!selectedImage || !tagText.trim() || !userId) return;
  
    // 1) Separa por comas y limpia espacios
    const splittedTags = tagText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean); // filtra vacíos
  
    if (splittedTags.length === 0) return;
  
    let successCount = 0;
    for (const singleTag of splittedTags) {
      try {
        const response = await axios.post(API_URL, {
          action: "tagImage",
          image_id: selectedImage.id,
          tag: singleTag,
          user_id: userId
        });
        // Si la API responde "success" en cada tag
        if (response.data.success) {
          successCount++;
        }
      } catch (error) {
        console.error(`Error agregando el tag "${singleTag}":`, error);
        // No salimos del bucle, continuamos con los demás
      }
    }
  
    // 2) Refrescamos la lista de tags de la imagen y el grid
    await fetchImageTags(selectedImage.id);
    fetchAllTagsForGrid([selectedImage.id]);
  
    // 3) Mostramos un mensaje (puedes personalizarlo)
    if (successCount > 0) {
      setModalMessage(`Se agregaron ${successCount} tag(s) correctamente.`);
      setModalOpen(true);
    } else {
      setMessage('No se pudo agregar ningún tag.');
    }
  
    // 4) Limpia el input
    setTagText('');
  };  

  // Eliminar un tag de la imagen seleccionada
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

  // Cargar más imágenes
  const loadMoreImages = () => {
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);

    if (filter === 'with') {
      fetchImages(nextPage, false, 1);
    } else if (filter === 'without') {
      fetchImages(nextPage, false, 0);
    } else {
      fetchImages(nextPage, false, null);
    }
  };

  // Mostrar solo imágenes "con tags"
  const handleShowWithTags = () => {
    setFilter("with");
    setCurrentPage(1);
    setAllImages([]);
    fetchImages(1, true, 1);
  };

  // Mostrar solo imágenes "sin tags"
  const handleShowWithoutTags = () => {
    setFilter("without");
    setCurrentPage(1);
    setAllImages([]);
    fetchImages(1, true, 0);
  };

  // [NUEVO] Agregar un tag a la lista de incluidos
  const handleAddIncludedTag = () => {
    if (!includedTagInput.trim()) return;
    // Evita duplicados simples
    if (!includedTags.includes(includedTagInput.trim())) {
      setIncludedTags([...includedTags, includedTagInput.trim()]);
    }
    setIncludedTagInput('');
  };

  // [NUEVO] Agregar un tag a la lista de excluidos
  const handleAddExcludedTag = () => {
    if (!excludedTagInput.trim()) return;
    // Evita duplicados simples
    if (!excludedTags.includes(excludedTagInput.trim())) {
      setExcludedTags([...excludedTags, excludedTagInput.trim()]);
    }
    setExcludedTagInput('');
  };

  // [NUEVO] Eliminar un tag de incluidos
  const handleRemoveIncludedTag = (tag) => {
    setIncludedTags((prev) => prev.filter(t => t !== tag));
  };

  // [NUEVO] Eliminar un tag de excluidos
  const handleRemoveExcludedTag = (tag) => {
    setExcludedTags((prev) => prev.filter(t => t !== tag));
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

        {/*
          [NUEVO] SOLO MOSTRAR estas 2 barras de búsqueda (tags incluidos / excluidos)
          CUANDO se está en el filtro "Con Tags"
        */}
        {filter === "with" && (
          <div className="tag-search-container">
            {/* Tags incluidos */}
            <div className="tag-search-included">
              <label className="search-label">Tags incluidos:</label>
              <div className="search-input-row">
                <input
                  type="text"
                  value={includedTagInput}
                  onChange={(e) => setIncludedTagInput(e.target.value)}
                  placeholder="Agregar tag..."
                />
                <button onClick={handleAddIncludedTag}>Agregar</button>
              </div>
              {/* Lista de tags incluidos */}
              <div className="search-tags-row">
                {includedTags.map((tag) => (
                  <div key={tag} className="search-tag-item">
                    {tag}
                    <button onClick={() => handleRemoveIncludedTag(tag)}>x</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Tags excluidos */}
            <div className="tag-search-excluded">
              <label className="search-label">Tags excluidos:</label>
              <div className="search-input-row">
                <input
                  type="text"
                  value={excludedTagInput}
                  onChange={(e) => setExcludedTagInput(e.target.value)}
                  placeholder="Agregar tag..."
                />
                <button onClick={handleAddExcludedTag}>Agregar</button>
              </div>
              {/* Lista de tags excluidos */}
              <div className="search-tags-row">
                {excludedTags.map((tag) => (
                  <div key={tag} className="search-tag-item">
                    {tag}
                    <button onClick={() => handleRemoveExcludedTag(tag)}>x</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Grilla de imágenes ya filtradas en el front */}
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
                      <p className="tag-empty-message">
                        No hay tags de otros usuarios.
                      </p>
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