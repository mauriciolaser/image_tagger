import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Modal from 'react-modal';
import './imageUpload.css';

// Importante: establece el elemento raíz para react-modal.
Modal.setAppElement('#root');

const ImageUpload = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [uploadModalMessage, setUploadModalMessage] = useState('');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const API_URL = process.env.REACT_APP_API_URL;
  
  // Obtener user_id y username desde localStorage.
  const userId = localStorage.getItem('user_id');  
  const username = localStorage.getItem('username');

  useEffect(() => {
    let interval;
    if (
      statusMessage.startsWith("TRABAJANDO") ||
      statusMessage.startsWith("FINALIZANDO")
    ) {
      interval = setInterval(() => {
        setStatusMessage((prev) => {
          if (prev.endsWith("...")) return prev.slice(0, -3) + ".";
          if (prev.endsWith("..")) return prev + ".";
          if (prev.endsWith(".")) return prev + ".";
          return prev + ".";
        });
      }, 500);
    }
    return () => clearInterval(interval);
  }, [statusMessage]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!files.length) {
      alert("Por favor, selecciona al menos un archivo.");
      return;
    }

    if (!userId) {
      alert("Error: No se encontró user_id. Inicia sesión nuevamente.");
      return;
    }

    console.log("Archivos a subir:", files);

    const formData = new FormData();
    files.forEach((file) => formData.append('images[]', file));
    
    // Enviar user_id en la solicitud
    formData.append("user_id", userId);
    formData.append("action", "upload"); // Se agrega la acción para que api.php sepa qué hacer

    setLoading(true);
    setProgress(0);
    setStatusMessage("Subiendo... 0%");

    try {
      const response = await axios.post(`${API_URL}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setProgress(percentCompleted);
          setStatusMessage(`Subiendo... ${percentCompleted}%`);

          if (percentCompleted === 100) {
            setStatusMessage("TRABAJANDO EN EL SERVIDOR.");
          }
        },
      });

      // Simular un pequeño tiempo de procesamiento antes de finalizar
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setStatusMessage("FINALIZANDO.");

      console.log("Esperando confirmación del backend...");

      // Simular el final del proceso
      await new Promise((resolve) => setTimeout(resolve, 2000));

      console.log("Procesamiento del servidor finalizado.");
      setStatusMessage("Listo.");

      if (
        response.data &&
        Array.isArray(response.data.results) &&
        response.data.results.length > 0
      ) {
        const successfulResults = response.data.results.filter((r) => r.success);
        let modalMessage = "";

        if (successfulResults.length > 1) {
          if (successfulResults.length > 10) {
            const firstTenNames = successfulResults
              .slice(0, 10)
              .map((r) => r.original_name)
              .join(', ');
            const extraCount = successfulResults.length - 10;
            modalMessage = `Se han subido ${successfulResults.length} imágenes: ${firstTenNames} y otras ${extraCount} imágenes extra.`;
          } else {
            const names = successfulResults.map((r) => r.original_name).join(', ');
            modalMessage = `Se han subido ${successfulResults.length} imágenes: ${names}`;
          }
        } else if (successfulResults.length === 1) {
          modalMessage = `Se ha subido: ${successfulResults[0].original_name}`;
        }

        setUploadModalMessage(modalMessage);
        setUploadModalOpen(true);
      } else {
        setUploadModalMessage("No se subió ninguna imagen exitosamente.");
        setUploadModalOpen(true);
      }
      
      setFiles([]); 
      setTimeout(() => setStatusMessage(""), 3000); // Limpiar mensaje después de 3 segundos
    } catch (error) {
      console.error("Error uploading images:", error);
      const errorMsg = error.response?.data?.message || error.message;
      alert(`Error uploading images: ${errorMsg}`);
      setStatusMessage("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="image-upload-container">
      <h1>Carga de Imágenes</h1>
      {username ? (
        <p>Usuario: {username}</p>
      ) : (
        <p style={{ color: 'red' }}>
          ⚠️ Debes iniciar sesión para subir imágenes.
        </p>
      )}
      
      <form onSubmit={handleUpload}>
        <label htmlFor="fileInput">Selecciona las imágenes:</label>
        <input
          id="fileInput"
          name="images[]"
          type="file"
          multiple
          onChange={(e) => setFiles([...e.target.files])}
        />
        <button type="submit" disabled={loading || !userId}>
          {loading ? "Subiendo..." : "Upload"}
        </button>

        {/* Mostrar mensaje dinámico */}
        {statusMessage && <p>{statusMessage}</p>}
      </form>
      
      {uploadModalOpen && (
        <Modal
          isOpen={uploadModalOpen}
          onRequestClose={() => setUploadModalOpen(false)}
          contentLabel="Resultado de la carga"
        >
          <h2>{uploadModalMessage}</h2>
          <button onClick={() => setUploadModalOpen(false)}>Cerrar</button>
        </Modal>
      )}
    </div>
  );
};

export default ImageUpload;
