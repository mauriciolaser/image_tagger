import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Modal from 'react-modal';
import CommentSection from './CommentSection';
import ArchiveButton from "./ArchiveButton";
import GameTag from './GameTag';
import RefreshTag from './RefreshTag';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import LoadingIcon from './LoadingIcon';
import './Tag.css';
// MODIFICACIÓN: Importar useLocation
import { useLocation } from 'react-router-dom';

Modal.setAppElement('#root');

const Tags = () => {
  // Estados principales
  const [allImages, setAllImages] = useState([]);
  const [displayedImages, setDisplayedImages] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const imagesPerPage = 500;

  // "with" usa getTaggedImages; "all" para getImages; "without" para sin tags
  const [filter, setFilter] = useState("with");

  const [imageTagsMap, setImageTagsMap] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);
  // Al seleccionar una imagen se reiniciarán estos estados a null para mostrar "Cargando tags..."
  const [selectedImageTags, setSelectedImageTags] = useState([]);
  const [showOtherTags, setShowOtherTags] = useState(true);
  const [selectedImageOtherTags, setSelectedImageOtherTags] = useState([]);

  const [tagText, setTagText] = useState('');
  const [message, setMessage] = useState('');
  // Usamos el modal grande solo para errores críticos (por ejemplo, en búsqueda fallida)
  const [modalMessage, setModalMessage] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [userId, setUserId] = useState(null);

  const [isFullScreen, setIsFullScreen] = useState(false);

  // Estados para la búsqueda (por filename)
  const [searchMode, setSearchMode] = useState(false);
  const [searchFileName, setSearchFileName] = useState('');
  // Se utiliza metadata para mostrar la imagen buscada (como en Gallery.js)
  const [searchedImageObj, setSearchedImageObj] = useState(null);

  // Estados para tags incluidos/excluidos (solo se muestran en modo "Con Tags" y cuando no estamos en Búsqueda)
  const [includedTags, setIncludedTags] = useState([]);
  const [excludedTags, setExcludedTags] = useState([]);
  const [includedTagInput, setIncludedTagInput] = useState('');
  const [excludedTagInput, setExcludedTagInput] = useState('');

  // Archivado
  const [confirmArchiveModalOpen, setConfirmArchiveModalOpen] = useState(false);
  const [successArchiveModalOpen, setSuccessArchiveModalOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveImageName, setArchiveImageName] = useState('');

  // Estados de carga
  const [loadingImages, setLoadingImages] = useState(false);
  const [loadingTags, setLoadingTags] = useState(false);

  // Estado para mostrar mensajes no bloqueantes (modal inferior)
  // Formato: { message: string, type: "success" | "error" | "info" }
  const [tagSubmitStatus, setTagSubmitStatus] = useState(null);

  // Nuevo estado para stats (usando getImageStats.php)
  const [stats, setStats] = useState(null);

  const API_URL = process.env.REACT_APP_API_URL;
  const IMAGE_URL = process.env.REACT_APP_IMAGE_URL;

  const gameTagRef = useRef();
  // MODIFICACIÓN: Usar useLocation para leer parámetros de la URL
  const location = useLocation();

  // Al montar, obtener userId
  useEffect(() => {
    const storedUserId = localStorage.getItem('user_id');
    if (storedUserId) {
      setUserId(storedUserId);
    } else {
      console.error('No se pudo obtener el user_id.');
    }
  }, []);

  // MODIFICACIÓN: Leer parámetros de la URL y actualizar filtro y tags incluidos si se encuentra mode=with y selectedTag
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const modeParam = queryParams.get('mode');
    const selectedTag = queryParams.get('selectedTag');
    if (modeParam === 'with' && selectedTag) {
      setFilter('with');
      setIncludedTags(prev => prev.includes(selectedTag) ? prev : [...prev, selectedTag]);
    }
  }, [location]);

  // Al montar, obtener stats de imágenes (getImageStats.php)
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await axios.get(API_URL, { params: { action: 'getImageStats' } });
        if (response.data && response.data.success) {
          setStats({
            total: response.data.total,
            with_tags: response.data.with_tags,
            without_tags: response.data.without_tags
          });
        }
      } catch (error) {
        console.error("Error fetching image stats:", error);
      }
    };
    fetchStats();
  }, [API_URL]);

  // Carga inicial: "Con Tags"
  useEffect(() => {
    if (userId) {
      fetchImages(1, true, 1);
    }
  }, [userId]);

  // Actualizar la grilla (paginación front)
  useEffect(() => {
    setDisplayedImages(allImages.slice(0, currentPage * imagesPerPage));
  }, [allImages, currentPage]);

  // Cada vez que se muestren imágenes nuevas, solicitar sus tags
  useEffect(() => {
    if (userId && displayedImages.length > 0) {
      const idsToFetch = displayedImages
        .map(img => img.id)
        .filter(id => imageTagsMap[id] === undefined);
      if (idsToFetch.length > 0) {
        fetchAllTagsForGrid(idsToFetch);
      }
    }
  }, [displayedImages, userId, imageTagsMap]);

  // Función para generar URL de la imagen
  const getImageUrl = (filename) =>
    `${IMAGE_URL}&file=${encodeURIComponent(filename)}`;

  // Llamada a getTaggedImages (para "Con Tags" o "Sin Tags")
  const fetchImages = async (page, reset = false, withTagsParam = null) => {
    try {
      setLoadingImages(true);
      const params = { action: 'getTaggedImages', page, archived: 0 };
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
    } finally {
      setLoadingImages(false);
    }
  };

  // Para el modo "Todas", llamamos a getImages
  const fetchAllImages = async (page, reset = false) => {
    try {
      setLoadingImages(true);
      const response = await axios.get(API_URL, {
        params: { action: "getImages", page, archived: 0 }
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
      console.error("Error fetching all images:", error);
    } finally {
      setLoadingImages(false);
    }
  };

  // Obtener todos los tags de varias imágenes
  const fetchAllTagsForGrid = async (imageIds) => {
    try {
      setLoadingTags(true);
      const response = await axios.get(API_URL, {
        params: { action: "getAllTags", image_ids: imageIds.join(',') }
      });
      if (response.data.success) {
        const fetchedTags = {};
        imageIds.forEach(id => {
          fetchedTags[id] = response.data.tags && response.data.tags[id] !== undefined
            ? response.data.tags[id]
            : [];
        });
        setImageTagsMap(prev => ({ ...prev, ...fetchedTags }));
      }
    } catch (error) {
      console.error("Error fetching all tags:", error);
    } finally {
      setLoadingTags(false);
    }
  };

  // Función de filtrado para modos "with" y para aplicar tags incluidos/excluidos
  // Si se han seleccionado tags incluidos, se dividirán en:
  // - Exact Matches: imagen que contenga TODOS los tags incluidos
  // - Partial Matches: imagen que contenga al menos UNO de los tags incluidos (pero no todos)
  let exactMatches = [];
  let partialMatches = [];
  // Cuando estamos en modo "with", y además se ha definido al menos un tag incluido,
  // aplicamos el filtrado dividiendo en dos grupos.
  if (!searchMode && filter === "with" && includedTags.length > 0) {
    const lowerExcluded = excludedTags.map(tag => tag.toLowerCase());
    const lowerIncluded = includedTags.map(tag => tag.toLowerCase());
    // Primero se filtran todas las imágenes que tengan al menos un tag y NO contengan tags excluidos
    const imagesWithTags = displayedImages.filter(image => {
      const tags = imageTagsMap[image.id] || [];
      if (tags.length === 0) return false;
      const tagNames = tags.map(t => t.name.toLowerCase());
      // Si contiene algún tag excluido, se descarta
      if (lowerExcluded.some(exc => tagNames.includes(exc))) return false;
      return true;
    });
    // Ahora se dividen en exactas y parciales
    exactMatches = imagesWithTags.filter(image => {
      const tags = imageTagsMap[image.id] || [];
      const tagNames = tags.map(t => t.name.toLowerCase());
      return lowerIncluded.every(tag => tagNames.includes(tag));
    });
    partialMatches = imagesWithTags.filter(image => {
      const tags = imageTagsMap[image.id] || [];
      const tagNames = tags.map(t => t.name.toLowerCase());
      const count = lowerIncluded.filter(tag => tagNames.includes(tag)).length;
      return count > 0 && count < lowerIncluded.length;
    });
  }

  // Para otros modos, usamos el filtrado original (incluyendo/excluyendo) para imágenes con tags
  const filteredImages = displayedImages.filter((image) => {
    const tags = imageTagsMap[image.id] || [];
    if (filter === "with") {
      // Si no se han seleccionado tags incluidos, se muestran todas las imágenes que tengan al menos un tag
      if (includedTags.length === 0) {
        return tags.length > 0 && (() => {
          const tagNames = tags.map(t => t.name.toLowerCase());
          return excludedTags.every(exc => !tagNames.includes(exc.toLowerCase()));
        })();
      }
      // Cuando se hayan seleccionado tags, el filtrado se hace en las variables exactMatches y partialMatches
      return false;
    } else if (filter === "without") {
      return tags.length === 0;
    } else if (filter === "all") {
      return true;
    }
    return true;
  });

  // Al seleccionar una imagen, reiniciamos los tags y el mensaje de error
  const handleSelectImage = (image) => {
    setMessage('');
    setSelectedImage(image);
    setSelectedImageTags(null);
    setSelectedImageOtherTags(null);
    fetchImageTags(image.id);
    fetchOtherImageTags(image.id);
  };

  // Obtener tags del usuario para una imagen
  const fetchImageTags = async (imageId) => {
    if (!userId) return;
    try {
      setLoadingTags(true);
      const response = await axios.get(API_URL, {
        params: { action: "getImageTags", image_id: imageId, user_id: userId }
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

  // Obtener tags de otros usuarios para una imagen
  const fetchOtherImageTags = async (imageId) => {
    if (!userId) return;
    try {
      setLoadingTags(true);
      const response = await axios.get(API_URL, {
        params: { action: "getImageTags", image_id: imageId, user_id: userId, others: 1 }
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

  // Función auxiliar para extraer JSON de la respuesta (en caso de warnings)
  const parseResponseData = (res) => {
    let data = res.data;
    if (typeof data === 'string') {
      const jsonStart = data.indexOf('{');
      if (jsonStart !== -1) {
        try {
          data = JSON.parse(data.substring(jsonStart));
        } catch (e) {
          console.error("Error al parsear JSON:", e);
          data = {};
        }
      }
    }
    return data;
  };

  // Agregar tags a la imagen seleccionada
  const handleTagSubmit = async (e) => {
    e.preventDefault();
    if (!selectedImage || !tagText.trim() || !userId) return;
    const splittedTags = tagText.split(",").map(t => t.trim()).filter(Boolean);
    gameTagRef.current && gameTagRef.current.increment();
    if (splittedTags.length === 0) return;

    setLoadingTags(true);
    setTagSubmitStatus({ message: "Agregando tags...", type: "info" });

    try {
      const responses = await Promise.all(
        splittedTags.map(singleTag =>
          axios.post(
            API_URL,
            {
              action: "tagImage",
              image_id: selectedImage.id,
              tag: singleTag,
              user_id: userId
            },
            { headers: { "Content-Type": "application/json" } }
          )
            .then(res => ({ data: parseResponseData(res) }))
            .catch(error => {
              console.error(`Error agregando el tag "${singleTag}":`, error);
              return { data: { success: false } };
            })
        )
      );

      const successCount = responses.filter(
        res => res && res.data && (res.data.success === true || res.data.success === 1)
      ).length;

      if (successCount > 0) {
        setTagSubmitStatus({ message: `Se agregaron ${successCount} tag(s) correctamente.`, type: "success" });
      } else {
        setModalMessage("No se pudo agregar ningún tag.");
        setModalOpen(true);
      }

      setTagText('');

      await Promise.all([
        fetchImageTags(selectedImage.id),
        fetchAllTagsForGrid([selectedImage.id])
      ]);
    } catch (error) {
      console.error("Error al agregar tags:", error);
      setModalMessage("Error al agregar tags.");
      setModalOpen(true);
    } finally {
      setLoadingTags(false);
      setTimeout(() => setTagSubmitStatus(null), 3000);
    }
  };

  // Borrar un tag
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
      let data = response.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data.trim());
        } catch (e) {
          console.error("Error parseando la respuesta de deleteTag:", e);
          data = {};
        }
      }
      if (data && data.success) {
        await Promise.all([
          fetchImageTags(selectedImage.id),
          fetchAllTagsForGrid([selectedImage.id])
        ]);
        setTagSubmitStatus({ message: `Borraste el tag "${tagName}" correctamente.`, type: "success" });
      } else {
        setModalMessage(data && data.message ? data.message : 'No se pudo eliminar el tag.');
        setModalOpen(true);
      }
    } catch (error) {
      console.error("Error deleting tag:", error);
      setModalMessage("Error al eliminar el tag.");
      setModalOpen(true);
    } finally {
      setLoadingTags(false);
      setTimeout(() => setTagSubmitStatus(null), 3000);
    }
  };

  // Funciones para agregar/remover tags incluidos/excluidos
  const handleAddIncludedTag = () => {
    if (!includedTagInput.trim()) return;
    if (!includedTags.includes(includedTagInput.trim())) {
      setIncludedTags([...includedTags, includedTagInput.trim()]);
    }
    setIncludedTagInput('');
  };

  const handleRemoveIncludedTag = (tag) => {
    setIncludedTags(prev => prev.filter(t => t !== tag));
  };

  const handleAddExcludedTag = () => {
    if (!excludedTagInput.trim()) return;
    if (!excludedTags.includes(excludedTagInput.trim())) {
      setExcludedTags([...excludedTags, excludedTagInput.trim()]);
    }
    setExcludedTagInput('');
  };

  const handleRemoveExcludedTag = (tag) => {
    setExcludedTags(prev => prev.filter(t => t !== tag));
  };

  // Botón "Cargar más" según el modo actual
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

  // Botones de filtro
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

  // Modo Búsqueda (por filename)
  const toggleSearchMode = () => {
    if (searchMode) {
      setSearchFileName('');
      setSearchedImageObj(null);
    }
    setSearchMode(!searchMode);
  };

  const handleSearchByFilename = async () => {
    if (!searchFileName.trim()) {
      setSearchedImageObj(null);
      return;
    }
    try {
      setLoadingImages(true);
      const response = await axios.get(API_URL, {
        params: { action: "getImages", filename: searchFileName.trim() }
      });
      if (response.data.success && response.data.images.length > 0) {
        setSearchedImageObj(response.data.images[0]);
        // Opcional: mostrar mensaje no bloqueante de éxito
        setTagSubmitStatus({ message: "Imagen encontrada.", type: "success" });
      } else {
        setSearchedImageObj(null);
        setModalMessage("No se encontró la imagen.");
        setModalOpen(true);
      }
    } catch (error) {
      console.error("Error al buscar la imagen:", error);
      setSearchedImageObj(null);
      setModalMessage("Error al buscar la imagen.");
      setModalOpen(true);
    } finally {
      setLoadingImages(false);
      setTimeout(() => setTagSubmitStatus(null), 3000);
    }
  };

  // Archivar/Restaurar
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

  return (
    <div className="tag-container">
      <div className="tag-main-section">
        <h2>Herramienta de taggeo</h2>

        <div className="tag-filter-bar">
          <button
            className={`${!searchMode && filter === "all" ? "active" : ""}`}
            onClick={handleShowAllImages}
          >
            Todas
          </button>
          <button
            className={searchMode ? "active" : ""}
            onClick={toggleSearchMode}
          >
            Búsqueda
          </button>
          <button
            className={`${!searchMode && filter === "with" ? "active" : ""}`}
            onClick={handleShowWithTags}
          >
            Con Tags
          </button>
          <button
            className={`${!searchMode && filter === "without" ? "active" : ""}`}
            onClick={handleShowWithoutTags}
          >
            Sin Tags
          </button>
        </div>

        {/* Renderizado de stats encima de la grilla, según la pestaña */}
        {!searchMode && stats && (
          <div className="tag-stats">
            {filter === "all" && (
              <p>Mostrando {filteredImages.length} del total de {stats.total} imágenes</p>
            )}
            {filter === "with" && includedTags.length === 0 && (
              <p>Mostrando {filteredImages.length} del total de {stats.with_tags} imágenes con tags</p>
            )}
            {filter === "without" && (
              <p>Mostrando {filteredImages.length} del total de {stats.without_tags} imágenes sin tags</p>
            )}
          </div>
        )}

        {/* Modo Búsqueda */}
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
            {loadingImages ? (
              <div style={{ marginTop: 20 }}>
                <LoadingIcon />
              </div>
            ) : (
              searchedImageObj ? (
                <div className="searched-image-result" style={{ marginTop: 20 }}>
                  <img
                    src={getImageUrl(searchedImageObj.filename)}
                    alt={searchedImageObj.original_name || searchedImageObj.filename}
                    style={{ cursor: "pointer" }}
                    onClick={() => handleSelectImage(searchedImageObj)}
                  />
                  <p style={{ fontSize: "0.9em", color: "#555" }}>
                    {searchedImageObj.original_name || searchedImageObj.filename}
                  </p>
                </div>
              ) : (
                <p style={{ marginTop: 20 }}>No se obtuvo resultados</p>
              )
            )}
          </div>
        )}

        {/* Grilla de imágenes */}
        {!searchMode && (
          <>
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

            {loadingImages ? (
              <div style={{ marginTop: 20, textAlign: 'center' }}>
                <LoadingIcon />
              </div>
            ) : (
              <>
                {/* Si estamos en modo "Con Tags" y se han seleccionado tags incluidos, se dividen los resultados */}
                {filter === "with" && includedTags.length > 0 ? (
                  <>
                    <h3>Resultados Exactos</h3>
                    <div className="tag-images-grid">
                      {exactMatches.length > 0 ? exactMatches.map((image) => (
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
                      )) : <p style={{ margin: '20px auto' }}>No se encontraron resultados exactos.</p>}
                    </div>
                    <h3>Resultados con al menos un tag</h3>
                    <div className="tag-images-grid">
                      {partialMatches.length > 0 ? partialMatches.map((image) => (
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
                      )) : <p style={{ margin: '20px auto' }}>No se encontraron resultados parciales.</p>}
                    </div>
                  </>
                ) : (
                  // Para otros modos o cuando no se han seleccionado tags incluidos, se muestra la grilla normal
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
                )}
                {allImages.length >= currentPage * imagesPerPage && (
                  <div className="tag-load-more">
                    <button className="tag-load-more-button" onClick={loadMoreImages}>
                      Cargar más imágenes
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Panel de previsualización */}
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

            {/* Contenedor para alinear y espaciar el botón */}
            <div className="archive-button-container">
              <ArchiveButton
                selectedImage={selectedImage}
                setAllImages={setAllImages}
                setSelectedImage={setSelectedImage}
                API_URL={API_URL}
              />
              <RefreshTag 
                onRefresh={() => {
                  // Se refrescan tanto los tags propios como los de otros
                  fetchImageTags(selectedImage.id);
                  fetchOtherImageTags(selectedImage.id);
                }}
                loading={loadingTags}
              />
            </div>

            <div className="tag-management">
              <div className="tag-list-container">
                <h4>Mis Tags:</h4>
                {selectedImageTags === null ? (
                  <p className="tag-empty-message">Cargando tags...</p>
                ) : selectedImageTags.length > 0 ? (
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
                    {selectedImageOtherTags === null ? (
                      <p className="tag-empty-message">Cargando tags...</p>
                    ) : selectedImageOtherTags.length > 0 ? (
                      <ul className="tag-list">
                        {selectedImageOtherTags.map((tag) => (
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

            {/* Agregamos el componente de comentarios */}
            <CommentSection selectedImage={selectedImage} API_URL={API_URL} />
          </div>
        </div>
      )}

      {/* Vista fullscreen */}
      {isFullScreen && selectedImage && (
        <div
          className="fullscreen-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setIsFullScreen(false); }}
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
                <div className="fullscreen-controls" onClick={(e) => e.stopPropagation()}>
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

      {/* Modal grande (se usa solo cuando ocurre un error en búsqueda o en operaciones críticas) */}
      {modalOpen && (
        <Modal
          isOpen={modalOpen}
          onRequestClose={() => setModalOpen(false)}
          contentLabel="Error"
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
      )}

      {/* Mensaje no bloqueante (modal inferior) */}
      {tagSubmitStatus && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          backgroundColor: tagSubmitStatus.type === "success" ? '#27ae60' : (tagSubmitStatus.type === "error" ? '#e74c3c' : '#333'),
          color: '#fff',
          padding: '10px',
          borderRadius: '5px',
          zIndex: 1000
        }}>
          {tagSubmitStatus.message}
        </div>
      )}
      <GameTag ref={gameTagRef} />

    </div>
  );
};

export default Tags;