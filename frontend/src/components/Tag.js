import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Modal from 'react-modal';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import LoadingIcon from './LoadingIcon'; 
import './Tag.css';

Modal.setAppElement('#root');

const Tags = () => {
  // == Estados principales ==
  const [allImages, setAllImages] = useState([]);
  const [displayedImages, setDisplayedImages] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const imagesPerPage = 300;

  const [filter, setFilter] = useState("with"); // "all" | "with" | "without"

  const [imageTagsMap, setImageTagsMap] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedImageTags, setSelectedImageTags] = useState([]);
  const [showOtherTags, setShowOtherTags] = useState(true);
  const [selectedImageOtherTags, setSelectedImageOtherTags] = useState([]);

  const [tagText, setTagText] = useState('');
  const [message, setMessage] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [userId, setUserId] = useState(null);

  const [isFullScreen, setIsFullScreen] = useState(false);

  // Barra búsqueda
  const [searchMode, setSearchMode] = useState(false);
  const [searchFileName, setSearchFileName] = useState('');
  const [searchedImageUrl, setSearchedImageUrl] = useState('');

  // Tags incluidos / excluidos
  const [includedTags, setIncludedTags] = useState([]);
  const [excludedTags, setExcludedTags] = useState([]);
  const [includedTagInput, setIncludedTagInput] = useState('');
  const [excludedTagInput, setExcludedTagInput] = useState('');

  // Archivado
  const [confirmArchiveModalOpen, setConfirmArchiveModalOpen] = useState(false);
  const [successArchiveModalOpen, setSuccessArchiveModalOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveImageName, setArchiveImageName] = useState('');

  // == Estados de carga separados ==
  const [loadingImages, setLoadingImages] = useState(false); // Solo para traer imágenes
  const [loadingTags, setLoadingTags] = useState(false);     // Para traer tags

  const API_URL = process.env.REACT_APP_API_URL;
  const IMAGE_URL = process.env.REACT_APP_IMAGE_URL;

  // == Al montar, obtener userId ==
  useEffect(() => {
    const storedUserId = localStorage.getItem('user_id');
    if (storedUserId) {
      setUserId(storedUserId);
    } else {
      console.error('No se pudo obtener el user_id.');
    }
  }, []);

  // == Carga inicial: "with" ==
  useEffect(() => {
    if (userId) {
      fetchImages(1, true, 1); // with_tags=1
    }
  }, [userId]);

  // == Paginación front ==
  useEffect(() => {
    setDisplayedImages(allImages.slice(0, currentPage * imagesPerPage));
  }, [allImages, currentPage]);

  // == Cada vez que hay displayedImages, pedimos sus tags (si no los tenemos) ==
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

  // == Generar URL de la imagen ==
  const getImageUrl = (filename) => (
    `${IMAGE_URL}&file=${encodeURIComponent(filename)}`
  );

  // == Llamada a getTaggedImages ==
  const fetchImages = async (page, reset = false, withTagsParam = null) => {
    try {
      setLoadingImages(true);
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
    } finally {
      setLoadingImages(false);
    }
  };

  // == Traer todas las imágenes (getImages.php) ==
  const fetchAllImages = async (page, reset = false) => {
    try {
      setLoadingImages(true);
      const excludeIds = reset ? [] : allImages.map((img) => img.id);
      const params = {
        archived: 0,
        exclude_ids: excludeIds.join(',')
      };
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
    } finally {
      setLoadingImages(false);
    }
  };

  // == Obtener tags de la grilla (varios IDs) ==
  const fetchAllTagsForGrid = async (imageIds) => {
    try {
      setLoadingTags(true);
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
    } finally {
      setLoadingTags(false);
    }
  };

  // == Filtrado local (con / sin tags, incluidos/excluidos) ==
  const matchIncludedExcluded = (tags) => {
    const tagNames = tags.map((t) => t.name.toLowerCase());
    for (let inc of includedTags) {
      if (!tagNames.includes(inc.toLowerCase())) return false;
    }
    for (let exc of excludedTags) {
      if (tagNames.includes(exc.toLowerCase())) return false;
    }
    return true;
  };

  const filteredImages = displayedImages.filter((image) => {
    const tags = imageTagsMap[image.id] || [];
    if (filter === "with") {
      return tags.length > 0 && matchIncludedExcluded(tags);
    } else if (filter === "without") {
      return tags.length === 0;
    } else if (filter === "all") {
      return true;
    }
    return true;
  });

  // == Seleccionar imagen ==
  const handleSelectImage = (image) => {
    setSelectedImage(image);
    fetchImageTags(image.id);
    setSelectedImageOtherTags([]);
    fetchOtherImageTags(image.id);
  };

  // == Obtener tags del usuario para esa imagen ==
  const fetchImageTags = async (imageId) => {
    if (!userId) return;
    try {
      setLoadingTags(true);
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
    } finally {
      setLoadingTags(false);
    }
  };

  // == Obtener tags de otros ==
  const fetchOtherImageTags = async (imageId) => {
    if (!userId) return;
    try {
      setLoadingTags(true);
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
    } finally {
      setLoadingTags(false);
    }
  };

  // == Agregar tags ==
  const handleTagSubmit = async (e) => {
    e.preventDefault();
    if (!selectedImage || !tagText.trim() || !userId) return;

    const splittedTags = tagText.split(",").map((t) => t.trim()).filter(Boolean);
    if (splittedTags.length === 0) return;

    setLoadingTags(true);
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
    await fetchAllTagsForGrid([selectedImage.id]);
    setLoadingTags(false);

    if (successCount > 0) {
      setModalMessage(`Se agregaron ${successCount} tag(s) correctamente.`);
      setModalOpen(true);
    } else {
      setMessage('No se pudo agregar ningún tag.');
    }
    setTagText('');
  };

  // == Borrar un tag ==
  const handleTagDelete = async (tagId, tagName) => {
    if (!selectedImage || !userId) return;
    try {
      setLoadingTags(true);
      const response = await axios.post(API_URL, {
        action: "deleteTag",
        image_id: selectedImage.id,
        tag_id: tagId,
        user_id: userId
      });
      if (response.data.success) {
        await fetchImageTags(selectedImage.id);
        await fetchAllTagsForGrid([selectedImage.id]);
        setModalMessage(`Borraste el tag "${tagName}"`);
        setModalOpen(true);
      } else {
        setMessage(response.data.message || 'No se pudo eliminar el tag.');
      }
    } catch (error) {
      console.error("Error deleting tag:", error);
      setMessage('Error al eliminar el tag.');
    } finally {
      setLoadingTags(false);
    }
  };

  // == Botón "Cargar más" ==
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

  // == Botones de filtro ==
  const handleShowAllImages = () => {
    setFilter("all");
    setCurrentPage(1);
    setAllImages([]);
    setSearchMode(false);
    fetchAllImages(1, true);
  };

  const handleShowWithTags = () => {
    setFilter("with");
    setCurrentPage(1);
    setAllImages([]);
    setSearchMode(false);
    fetchImages(1, true, 1);
  };

  const handleShowWithoutTags = () => {
    setFilter("without");
    setCurrentPage(1);
    setAllImages([]);
    setSearchMode(false);
    fetchImages(1, true, 0);
  };

  // == Modo Búsqueda por filename ==
  const toggleSearchMode = () => {
    if (searchMode) {
      setSearchFileName('');
      setSearchedImageUrl('');
    }
    setSearchMode(!searchMode);
  };

  const handleSearchByFilename = async () => {
    if (!searchFileName.trim()) return;
    try {
      setLoadingImages(true);
      const response = await axios.get(
        `${IMAGE_URL}&file=${encodeURIComponent(searchFileName.trim())}`,
        { responseType: 'blob' }
      );
      if (response.status === 200) {
        const blob = response.data;
        const objectUrl = URL.createObjectURL(blob);
        setSearchedImageUrl(objectUrl);
      } else {
        setSearchedImageUrl('');
      }
    } catch (error) {
      console.error("Error al buscar la imagen:", error);
      setSearchedImageUrl('');
    } finally {
      setLoadingImages(false);
    }
  };

  // == Manejo tags incluidos/excluidos ==
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

  // == Archivar/Restaurar ==
  const archiveButtonText =
    selectedImage && selectedImage.archived === 1
      ? "Restaurar Imagen"
      : "Archivar Imagen";

  const archiveModalText =
    selectedImage && selectedImage.archived === 1
      ? `¿Restaurar la imagen "${archiveImageName}"?`
      : `¿Archivar la imagen "${archiveImageName}"?`;

  const successArchiveText =
    selectedImage && selectedImage.archived === 1
      ? `Se restauró exitosamente la imagen "${archiveImageName}"`
      : `Se archivó exitosamente la imagen "${archiveImageName}"`;

  const openConfirmArchiveModal = () => {
    if (!selectedImage) return;
    setArchiveImageName(selectedImage.original_name || selectedImage.filename);
    setConfirmArchiveModalOpen(true);
  };

  const handleArchiveToggle = async () => {
    if (!selectedImage) return;
    setIsArchiving(true);
    try {
      setLoadingImages(true);
      const newArchivedValue = selectedImage.archived === 1 ? 0 : 1;
      const response = await axios.post(`${API_URL}?action=archiveImage`, {
        image_id: selectedImage.id,
        archived: newArchivedValue
      });

      if (response.data.success) {
        setConfirmArchiveModalOpen(false);
        setSuccessArchiveModalOpen(true);
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
      setLoadingImages(false);
    }
  };

  // ====================================================
  // ==================== RENDER ========================
  // ====================================================
  return (
    <div className="tag-container">
      <div className="tag-main-section">
        <h2>Herramienta de taggeo</h2>

        <div className="tag-filter-bar">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={handleShowAllImages}
          >
            Todos
          </button>
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

        {/* Búsqueda por filename */}
        {searchMode && (
          <div style={{ marginBottom: '20px' }}>
            <div className="search-by-filename">
              <input
                type="text"
                placeholder="Buscar imagen por nombre exacto..."
                value={searchFileName}
                onChange={(e) => setSearchFileName(e.target.value)}
              />
              <button onClick={handleSearchByFilename}>Buscar</button>
            </div>

            {/* Muestra loading si se está buscando */}
            {loadingImages ? (
              <div style={{ marginTop: 20 }}>
                <LoadingIcon />
              </div>
            ) : (
              searchedImageUrl && (
                <div className="searched-image-result" style={{ marginTop: 20 }}>
                  <img src={searchedImageUrl} alt="Resultado" />
                </div>
              )
            )}
          </div>
        )}

        {/* Si filter="with", mostramos campos para tags incluidos/excluidos */}
        {filter === "with" && (
          <div className="tag-search-container">
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

        {/* Zona central de imágenes: si loadingImages es true => LoadingIcon; si no => grilla */}
        {loadingImages ? (
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <LoadingIcon />
          </div>
        ) : (
          <>
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
          </>
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

            {/* Botón Archivar/Restaurar */}
            <button className="tag-archive-button" onClick={openConfirmArchiveModal}>
              {archiveButtonText}
            </button>

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

              <div className="tag-list-others">
                <div
                  className="tag-list-others-header"
                  onClick={() => setShowOtherTags(!showOtherTags)}
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

      {/* Modal acciones con tags */}
      <Modal
        isOpen={modalOpen}
        onRequestClose={() => setModalOpen(false)}
        contentLabel="Tag asignado"
        className="tag-modal-content"
        overlayClassName="tag-modal-overlay"
      >
        <div className="tag-modal-wrapper">
          <img src="/image_tagger/images/tag.png" alt="Tag" className="tag-modal-image" />
          <div className="tag-modal-inner">
            <h2>{modalMessage}</h2>
            <button onClick={() => setModalOpen(false)}>Cerrar</button>
          </div>
        </div>
      </Modal>

      {/* Modal de Confirmación para Archivar/Restaurar */}
      <Modal
        isOpen={confirmArchiveModalOpen}
        onRequestClose={() => setConfirmArchiveModalOpen(false)}
        className="tag-modal-content"
        overlayClassName="tag-modal-overlay"
      >
        <div className="tag-modal-wrapper">
          <img src="/image_tagger/images/tag.png" alt="Tag" className="tag-modal-image" />
          <div className="tag-modal-inner">
            <h2>{archiveModalText}</h2>
            <div className="tag-modal-buttons">
              <button
                onClick={handleArchiveToggle}
                disabled={isArchiving}
                className="tag-archive-confirm"
              >
                {isArchiving ? "Procesando..." : "Continuar"}
              </button>
              <button
                className="tag-modal-cancel"
                onClick={() => setConfirmArchiveModalOpen(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal de Éxito al Archivar/Restaurar */}
      <Modal
        isOpen={successArchiveModalOpen}
        onRequestClose={() => setSuccessArchiveModalOpen(false)}
        overlayClassName="tag-modal-overlay"
        className="tag-modal-content"
      >
        <div className="tag-modal-wrapper">
          <img src="/image_tagger/images/tag.png" alt="Tag" className="tag-modal-image" />
          <div className="tag-modal-inner">
            <h2>{successArchiveText}</h2>
            <button
              className="tag-modal-close"
              onClick={() => setSuccessArchiveModalOpen(false)}
            >
              Cerrar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Tags;
