import React, { useState, useEffect } from "react";
import Masonry from "react-masonry-css";
import axios from "axios";
import "./Showcase.css";

const API_URL = process.env.REACT_APP_API_URL;

const Showcase = () => {
  const [images, setImages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchImages = async () => {
    try {
      // Inicia cargando
      setIsLoading(true);

      const response = await axios.get(API_URL, {
        params: { action: "getRandomImages" },
      });

      if (response.data && Array.isArray(response.data.images)) {
        setImages(response.data.images);
      }
    } catch (error) {
      console.error("Error fetching images:", error);
    } finally {
      // Finaliza cargando
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const breakpointColumnsObj = {
    default: 4,
    1024: 3,
    768: 2,
    480: 1,
  };

  return (
    <>
      {/* Overlay de Cargando */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-text">Cargando</div>
        </div>
      )}

      {/* Contenedor de la galería: se muestra solo cuando no está cargando */}
      <div className="showcase-container" style={{ display: isLoading ? "none" : "block" }}>
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
      </div>
    </>
  );
};

export default Showcase;
