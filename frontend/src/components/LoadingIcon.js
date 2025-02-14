import React from 'react';
import './LoadingIcon.css';

const LoadingIcon = () => {
  return (
    <div className="loading-icon-overlay">
      <img
        src="/image_tagger/images/loading.png"
        alt="Cargando..."
        className="loading-icon-img"
      />
    </div>
  );
};

export default LoadingIcon;
