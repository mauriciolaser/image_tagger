// src/services/adminService.js
import axios from 'axios';

// Podemos definir la URL base (API_URL) dentro del servicio.
const API_URL = process.env.REACT_APP_API_URL;

/**
 * Consulta el estado de un proceso de importación.
 * @param {string} jobId Identificador del proceso de importación.
 */
export function getImportStatus(jobId) {
  return axios.get(`${API_URL}?action=importStatus&job_id=${jobId}`);
}

/**
 * Elimina todas las imágenes.
 */
export function deleteAllImages() {
  return axios.delete(`${API_URL}?action=deleteAllImages`);
}

/**
 * Inicia la importación de imágenes.
 * @param {string} userId Identificador del usuario.
 */
export function startImport(userId) {
  return axios.get(`${API_URL}?action=startImport&user_id=${userId}`);
}

/**
 * Detiene la importación de imágenes.
 * @param {string} jobId Identificador del proceso de importación.
 */
export function stopImport(jobId) {
  return axios.get(`${API_URL}?action=stopImport&job_id=${jobId}`);
}

/**
 * Limpia la base de datos.
 */
export function clearDatabase() {
  return axios.delete(`${API_URL}?action=clearDatabase`);
}
