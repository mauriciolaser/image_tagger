// src/components/TagChart.js
import React, { useState } from 'react';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import './TagChart.css';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const API_URL = process.env.REACT_APP_API_URL;

const TagChart = () => {
  const [selectedTags, setSelectedTags] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [chartData, setChartData] = useState(null);
  const [loadingChart, setLoadingChart] = useState(false);
  const [chartError, setChartError] = useState(null);

  // Función para consultar el API y actualizar el gráfico
  const fetchChartData = async (tagsArr) => {
    if (tagsArr.length === 0) {
      setChartData(null);
      return;
    }
    setLoadingChart(true);
    setChartError(null);
    try {
      const res = await axios.get(API_URL, { params: { action: 'getTagFrequencies', tags: JSON.stringify(tagsArr) } });
      if (res.data && res.data.success) {
        const tagsData = res.data.tags;
        const labels = tagsData.map(item => item.tag_name);
        // Convertir la frecuencia a entero sin decimales
        const frequencies = tagsData.map(item => parseInt(item.frequency, 10));
        setChartData({
          labels,
          datasets: [{
            label: 'Frecuencia',
            data: frequencies,
            backgroundColor: 'rgba(75, 192, 192, 0.6)',
            borderWidth: 1,
          }]
        });
      } else {
        setChartError("Error al obtener los datos del gráfico");
      }
    } catch (err) {
      console.error("Error fetching chart data:", err);
      setChartError("Error al obtener los datos del gráfico");
    } finally {
      setLoadingChart(false);
    }
  };

  // Agregar un tag y actualizar el gráfico
  const handleAddTag = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !selectedTags.includes(trimmed)) {
      if (selectedTags.length < 10) {
        const newTags = [...selectedTags, trimmed];
        setSelectedTags(newTags);
        fetchChartData(newTags);
      } else {
        alert("Máximo 10 tags permitidos.");
      }
    }
    setInputValue('');
  };

  // Eliminar un tag y actualizar el gráfico
  const handleRemoveTag = (tag) => {
    const newTags = selectedTags.filter(t => t !== tag);
    setSelectedTags(newTags);
    fetchChartData(newTags);
  };

  return (
    <div className="tag-chart-container">
      <h2>Gráfico de Frecuencias de Tags</h2>
      <div className="tag-input-section">
        <input 
          type="text" 
          placeholder="Ingresa un tag" 
          value={inputValue} 
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(); }}
        />
        <button className="btn-add" onClick={handleAddTag}>Añadir Tag</button>
      </div>
      <div className="selected-tags">
        {selectedTags.map((tag, index) => (
          <span key={index} className="tag-item">
            {tag} <button className="btn-remove" onClick={() => handleRemoveTag(tag)}>x</button>
          </span>
        ))}
      </div>
      <div className="chart-container">
        {loadingChart && <div className="loading">Cargando gráfico...</div>}
        {chartError && <div className="error">{chartError}</div>}
        {chartData && <Bar 
          data={chartData} 
          options={{
            responsive: true,
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  precision: 0,
                  callback: function(value) {
                    return Math.floor(value);
                  }
                }
              }
            },
            plugins: {
              legend: { position: 'top' },
              title: { display: true, text: 'Frecuencia de Tags' },
            },
          }} 
        />}
      </div>
    </div>
  );
};

export default TagChart;
