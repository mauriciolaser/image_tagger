import React, { useState, useEffect } from "react";
import Masonry from "react-masonry-css";
import axios from "axios";
import "./Showcase.css";

const API_URL = process.env.REACT_APP_API_URL;

const Showcase = () => {
  const [images, setImages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [seed, setSeed] = useState(null);

  // Definimos el límite de imágenes por request (500 en este caso)
  const limit = 500;

  // Función que obtiene las imágenes para la página indicada
  const fetchImages = async (pageNumber) => {
    try {
      setIsLoading(true);
      const params = { action: "getRandomImages", page: pageNumber, limit };
      // Si ya tenemos seed, lo incluimos
      if (seed) {
        params.seed = seed;
      }
      const response = await axios.get(API_URL, { params });

      if (response.data && Array.isArray(response.data.images)) {
        // Almacenar el seed recibido en la primera petición
        if (!seed && response.data.seed) {
          setSeed(response.data.seed);
        }
        // Si es la primera página se reemplaza el estado, si no se concatenan las imágenes
        if (pageNumber === 1) {
          setImages(response.data.images);
        } else {
          setImages((prev) => [...prev, ...response.data.images]);
        }
        // Si la cantidad de imágenes recibidas es menor que el límite, ya no hay más
        if (response.data.images.length < limit) {
          setHasMore(false);
        }
      }
    } catch (error) {
      console.error("Error fetching images:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Carga inicial (página 1)
  useEffect(() => {
    fetchImages(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Función para cargar la siguiente página
  const loadMoreImages = () => {
    const nextPage = page + 1;
    fetchImages(nextPage);
    setPage(nextPage);
  };

  const breakpointColumnsObj = {
    default: 4,
    1024: 3,
    768: 2,
    480: 1,
  };

  return (
    <>
      {/* Overlay de carga solo si aún no se han obtenido imágenes */}
      {isLoading && images.length === 0 && (
        <div className="loading-overlay">
          <div className="loading-text">Cargando</div>
        </div>
      )}

      <div
        className="showcase-container"
        style={{ display: images.length === 0 && isLoading ? "none" : "block" }}
      >
        <Masonry
          breakpointCols={breakpointColumnsObj}
          className="masonry-grid"
          columnClassName="masonry-column"
        >
          {images.map((img) => (
            <div key={img.id} className="masonry-item">
              <img src={img.public_url} alt={img.original_name} loading="lazy" />
            </div>
          ))}
        </Masonry>
        {/* Botón para cargar más imágenes (se muestra solo si quedan imágenes por cargar) */}
        {hasMore && (
          <div className="load-more-container">
            <button
              className="load-more-button"
              onClick={loadMoreImages}
              disabled={isLoading}
            >
              Cargar más imágenes
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default Showcase;
