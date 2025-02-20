import React from 'react';
import './RefreshTag.css';

const RefreshTag = ({ onRefresh, loading }) => {
  return (
    <button 
      className="refresh-tag-button" 
      onClick={onRefresh} 
      disabled={loading}
    >
      {loading ? 'Refrescando...' : 'Refrescar tags'}
    </button>
  );
};

export default RefreshTag;
