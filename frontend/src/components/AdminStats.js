import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminStats.css';

const API_URL = process.env.REACT_APP_API_URL;

const AdminStats = () => {
  const [stats, setStats] = useState(null);
  const [todayTagged, setTodayTagged] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get(API_URL, { params: { action: 'getImageStats' } });
        if (res.data && res.data.success) {
          setStats({
            total: res.data.total,
            with_tags: res.data.with_tags,
            without_tags: res.data.without_tags,
          });
        }
      } catch (error) {
        console.error('Error fetching image stats:', error);
      }
    };

    const fetchTodayTagged = async () => {
      try {
        const res = await axios.get(API_URL, { params: { action: 'getTodayTaggedImages' } });
        if (res.data && res.data.success) {
          setTodayTagged(res.data.today_tagged);
        }
      } catch (error) {
        console.error('Error fetching today tagged images:', error);
      }
    };

    const fetchAll = async () => {
      await Promise.all([fetchStats(), fetchTodayTagged()]);
      setLoading(false);
    };

    fetchAll();
  }, []);

  if (loading) {
    return <div className="admin-stats-loading">Cargando estadísticas...</div>;
  }

  return (
    <div className="admin-stats">
      <p>Imágenes totales (sin archivar): {stats.total}</p>
      <p>Imágenes con tags: {stats.with_tags}</p>
      <p>Imágenes sin tags: {stats.without_tags}</p>
      <p>Imágenes taggeadas hoy: {todayTagged}</p>
    </div>
  );
};

export default AdminStats;
