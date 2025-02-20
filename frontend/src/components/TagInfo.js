// src/components/TagInfo.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './TagInfo.css';

const API_URL = process.env.REACT_APP_API_URL;

const TagInfo = () => {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const res = await axios.get(API_URL, { params: { action: 'getTagList' } });
        if (res.data && res.data.success) {
          // Ordenar alfabéticamente por el nombre del tag
          const sortedTags = res.data.tags.sort((a, b) => a.tag_name.localeCompare(b.tag_name));
          setTags(sortedTags);
        } else {
          setError('Error al obtener los tags');
        }
      } catch (err) {
        console.error("Error fetching tag list:", err);
        setError('Error al obtener los tags');
      } finally {
        setLoading(false);
      }
    };

    fetchTags();
  }, []);

  const handleTagClick = (tagName) => {
    // Navega a TagPage pasando por query string el modo "with" y el tag seleccionado.
    navigate(`/tag?mode=with&selectedTag=${encodeURIComponent(tagName)}`);
  };

  if (loading) {
    return <div className="tag-info-container">Cargando tags...</div>;
  }

  if (error) {
    return <div className="tag-info-container">{error}</div>;
  }

  return (
    <div className="tag-info-container">
      <h2>Lista de Tags</h2>
      <table className="tag-info-table">
        <thead>
          <tr>
            <th>Tag</th>
            <th>Frecuencia</th>
          </tr>
        </thead>
        <tbody>
          {tags.map((tag, index) => (
            <tr
              key={index}
              onClick={() => handleTagClick(tag.tag_name)}
              style={{ cursor: 'pointer' }}
            >
              <td data-label="Tag">{tag.tag_name}</td>
              <td data-label="Frecuencia">{tag.frequency}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TagInfo;
