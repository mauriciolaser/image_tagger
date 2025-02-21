import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './TagInfo.css';

const API_URL = process.env.REACT_APP_API_URL;

const TagInfo = ({ refreshFlag }) => {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'tag_name', direction: 'asc' });
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const res = await axios.get(API_URL, { params: { action: 'getTagList' } });
        if (res.data && res.data.success) {
          setTags(res.data.tags);
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
  }, [refreshFlag]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedTags = useMemo(() => {
    if (!tags) return [];
    let sortableTags = [...tags];
    if (sortConfig.key === 'tag_name') {
      sortableTags.sort((a, b) =>
        sortConfig.direction === 'asc'
          ? a.tag_name.localeCompare(b.tag_name)
          : b.tag_name.localeCompare(a.tag_name)
      );
    } else if (sortConfig.key === 'frequency') {
      sortableTags.sort((a, b) =>
        sortConfig.direction === 'asc'
          ? a.frequency - b.frequency
          : b.frequency - a.frequency
      );
    }
    return sortableTags;
  }, [tags, sortConfig]);

  const handleTagClick = (tagName) => {
    const url = `/image_tagger/tag?mode=with&selectedTag=${encodeURIComponent(tagName)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
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
            <th onClick={() => handleSort('tag_name')} style={{ cursor: 'pointer' }}>
              Tag {sortConfig.key === 'tag_name' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
            </th>
            <th onClick={() => handleSort('frequency')} style={{ cursor: 'pointer' }}>
              Frecuencia {sortConfig.key === 'frequency' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedTags.map((tag, index) => (
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
