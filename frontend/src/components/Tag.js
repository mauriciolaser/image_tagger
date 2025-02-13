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

  // Filtro principal: "all", "with", "without"
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

  // [NUEVO] Estados para la barra "Buscar" (una sola imagen por nombre)
  const [searchMode, setSearchMode] = useState(false); // si está activa la barra de búsqueda
  const [searchFileName, setSearchFileName] = useState('');
  const [searchedImageUrl, setSearchedImageUrl] = useState('');

  // [NUEVO] Estados para búsquedas (tags incluidos / excluidos) - solo para 'with'
  const [includedTags, setIncludedTags] = useState([]);
  const [excludedTags, setExcludedTags] = useState([]);
  const [includedTagInput, setIncludedTagInput] = useState('');
  const [excludedTagInput, setExcludedTagInput] = useState('');

  const API_URL = process.env.REACT_APP_API_URL;    // getImages.php / getTaggedImages (si action)
  const IMAGE_URL = process.env.REACT_APP_IMAGE_URL; // getImage.php?file=

  // Generar la URL pública de la imagen
  const getImageUrl = (filename) => {
    return `${IMAGE_URL}&file=${encodeURIComponent(filename)}`;
  };

  // Al montar, obtener user_id
  useEffect(() => {
    const storedUserId = localStorage.getItem('user_id');
    if (storedUserId) {
      setUserId(storedUserId);
    } else {
      console.error('No se pudo obtener el user_id.');
    }
  }, []);

  // Carga inicial por defecto => "with"
  useEffect(() => {
    if (userId) {
      fetchImages(1, true, 1); // con tags => getTaggedImages
    }
  }, [userId]);

  // Manejo de la paginación en el front
  useEffect(() => {
    setDisplayedImages(allImages.slice(0, currentPage * imagesPerPage));
  }, [allImages, currentPage]);

  /**
   * Llamada a getTaggedImages (con/ sin tags).
   * @param {number} page
   * @param {boolean} reset
   * @param {number|null} withTagsParam - 1 => con tags, 0 => sin tags, null => no filtra (aunque no se usa)
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
          setAllImages((prev) => [...prev, ...response.data.images]);
        }
        setCurrentPage(page);
      }
    } catch (error) {
      console.error("Error fetching images:", error);
    }
  };

  /**
   * [NUEVO] Obtener todas las imágenes usando getImages.php (sin 'action' ni 'with_tags').
   * Aplica exclude_ids para paginación simulada.
   */
  const fetchAllImages = async (page, reset = false) => {
    try {
      const excludeIds = reset ? [] : allImages.map((img) => img.id);
      const params = {
        archived: 0,
        exclude_ids: excludeIds.join(',')
      };

      // Este endpoint es getImages.php (según tu snippet), sin action
      const response = await axios.get(API_URL, { params });
      if (response.data && response.data.success && Array.isArray(response.data.images)) {
        if (reset) {
          setAllImages(response.data.images);
        } else {
          setAllImages((prev) => [...prev, ...response.data.images]);
        }
        setCurrentPage(page);
      }
    } catch (error) {
      console.error("Error fetching all images:", error);
    }
  };

  // Trae tags (de varios ids) para la grilla
  const fetchAllTagsForGrid = async (imageIds) => {
    try {
      const response = await axios.get(API_URL, {
        params: {
          action: "getAllTags",
          image_ids: imageIds.join(',')
        }
      });
      if (response.data.success) {
        setImageTagsMap((prev) => ({ ...prev, ...response.data.tags }));
      }
    } catch (error) {
      console.error("Error fetching all tags:", error);
    }
  };

  // Cada vez que cambia displayedImages, obtenemos tags
  useEffect(() => {
    if (userId && displayedImages.length > 0) {
      const idsToFetch = displayedImages
        .map((img) => img.id)
        .filter((id) => !(id in imageTagsMap));
      if (idsToFetch.length > 0) {
        fetchAllTagsForGrid(idsToFetch);
      }
    }
  }, [displayedImages, userId, imageTagsMap]);

  // Chequea si un array de {id, name} cumple con includedTags y excludedTags
  const matchIncludedExcluded = (tags) => {
    const tagNames = tags.map((t) => t.name.toLowerCase());
    // Must contain ALL included
    for (let inc of includedTags) {
      if (!tagNames.includes(inc.toLowerCase())) {
        return false;
      }
    }
    // Must NOT contain ANY excluded
    for (let exc of excludedTags) {
      if (tagNames.includes(exc.toLowerCase())) {
        return false;
      }
    }
    return true;
  };

  // Filtrado local final, depende de filter
  const filteredImages = displayedImages.filter((image) => {
    const tags = imageTagsMap[image.id] || [];
    if (filter === "with") {
      return tags.length > 0 && matchIncludedExcluded(tags);
    } else if (filter === "without") {
      return tags.length === 0;
    } else if (filter === "all") {
      // sin filtrar
      return true;
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

  // Obtener tags del usuario
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

  // Obtener tags de otros usuarios
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

  // Agregar tags (separados por comas)
  const handleTagSubmit = async (e) => {
    e.preventDefault();
    if (!selectedImage || !tagText.trim() || !userId) return;

    const splittedTags = tagText.split(",").map((t) => t.trim()).filter(Boolean);
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
        if (response.data.success) {
          successCount++;
        }
      } catch (error) {
        console.error(`Error agregando el tag "${singleTag}":`, error);
      }
    }

    await fetchImageTags(selectedImage.id);
    fetchAllTagsForGrid([selectedImage.id]);

    if (successCount > 0) {
      setModalMessage(`Se agregaron ${successCount} tag(s) correctamente.`);
      setModalOpen(true);
    } else {
      setMessage('No se pudo agregar ningún tag.');
    }
    setTagText('');
  };

  // Borrar un tag
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

  // Botón "Cargar más"
  const loadMoreImages = () => {
    const nextPage = currentPage + 1;
    if (filter === 'with') {
      fetchImages(nextPage, false, 1);
    } else if (filter === 'without') {
      fetchImages(nextPage, false, 0);
    } else if (filter === 'all') {
      fetchAllImages(nextPage, false);
    }
  };

  // Botón "Todos"
  const handleShowAllImages = () => {
    setFilter("all");
    setCurrentPage(1);
    setAllImages([]);
    setSearchMode(false);  // Desactivamos la barra de búsqueda
    fetchAllImages(1, true);
  };

  // Botón "Con Tags"
  const handleShowWithTags = () => {
    setFilter("with");
    setCurrentPage(1);
    setAllImages([]);
    setSearchMode(false);
    fetchImages(1, true, 1);
  };

  // Botón "Sin Tags"
  const handleShowWithoutTags = () => {
    setFilter("without");
    setCurrentPage(1);
    setAllImages([]);
    setSearchMode(false);
    fetchImages(1, true, 0);
  };

  // Botón "Buscar" - togglear la barra de búsqueda
  const toggleSearchMode = () => {
    // Si se desactiva, limpiamos
    if (searchMode) {
      setSearchFileName('');
      setSearchedImageUrl('');
    }
    setSearchMode(!searchMode);
  };

  // Búsqueda de una imagen por nombre exacto (getImage.php?file=...)
  const handleSearchByFilename = async () => {
    if (!searchFileName.trim()) return;
    try {
      const response = await axios.get(
        `${IMAGE_URL}&file=${encodeURIComponent(searchFileName.trim())}`,
        { responseType: 'blob' }
      );
      if (response.status === 200) {
        const blob = response.data;
        const objectUrl = URL.createObjectURL(blob);
        setSearchedImageUrl(objectUrl);
      }
    } catch (error) {
      console.error("Error al buscar la imagen:", error);
      setSearchedImageUrl('');
    }
  };

  // Manejo tags incluidos
  const handleAddIncludedTag = () => {
    if (!includedTagInput.trim()) return;
    if (!includedTags.includes(includedTagInput.trim())) {
      setIncludedTags([...includedTags, includedTagInput.trim()]);
    }
    setIncludedTagInput('');
  };
  const handleRemoveIncludedTag = (tag) => {
    setIncludedTags((prev) => prev.filter((t) => t !== tag));
  };

  // Manejo tags excluidos
  const handleAddExcludedTag = () => {
    if (!excludedTagInput.trim()) return;
    if (!excludedTags.includes(excludedTagInput.trim())) {
      setExcludedTags([...excludedTags, excludedTagInput.trim()]);
    }
    setExcludedTagInput('');
  };
  const handleRemoveExcludedTag = (tag) => {
    setExcludedTags((prev) => prev.filter((t) => t !== tag));
  };

  return (
    <div className="tag-container">
      <div className="tag-main-section">
        <h2>Herramienta de taggeo</h2>

        {/* Barra principal de botones */}
        <div className="tag-filter-bar">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={handleShowAllImages}
          >
            Todos
          </button>

          {/* Nuevo botón "Buscar" para activar la barra de búsqueda */}
          <button
            className={searchMode ? "active" : ""}
            onClick={toggleSearchMode}
          >
            Búsqueda
          </button>

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

        {/* Barra de búsqueda activada con "Buscar" */}
        {searchMode && (
          <div>
            <div className="search-by-filename">
              <input
                type="text"
                placeholder="Buscar imagen por nombre exacto..."
                value={searchFileName}
                onChange={(e) => setSearchFileName(e.target.value)}
              />
              <button onClick={handleSearchByFilename}>Buscar</button>
            </div>
            {searchedImageUrl && (
              <div className="searched-image-result">
                <img src={searchedImageUrl} alt="Resultado" />
              </div>
            )}
          </div>
        )}

        {/* SOLO si filter === "with" mostramos la búsqueda de tags incluidos/excluidos */}
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

        {/* Grilla de imágenes (filtradas en front) */}
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

        {/* Botón de "Cargar más" si procede */}
        {allImages.length >= currentPage * imagesPerPage && (
          <div className="tag-load-more">
            <button className="tag-load-more-button" onClick={loadMoreImages}>
              Cargar más imágenes
            </button>
          </div>
        )}
      </div>

      {/* Sección derecha: preview y asignación de tags */}
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
                    {selectedImageTags.map((tag) => (
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

              {/* Tags de otros */}
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
                        {selectedImageOtherTags.map((tag) => (
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

              {/* Form para agregar un tag */}
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

      {/* Modo fullscreen con zoom */}
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

      {/* Modal para mensajes en acciones con tags */}
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
