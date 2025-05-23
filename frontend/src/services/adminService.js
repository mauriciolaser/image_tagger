// src/services/adminService.js
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

/**
 * Consulta el estado de un proceso de importación.
 * @param {string} jobId Identificador del proceso de importación.
 */
export function getImportStatus(jobId) {
  return axios.get(`${API_URL}?action=importStatus&job_id=${jobId}`);
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
export const stopImport = (jobId) => {
  return axios.post(`${API_URL}?action=stopImport`, { job_id: jobId });
};

/**
 * Consulta el estado de un proceso de actualización de metadata.
 * @param {string} jobId Identificador del proceso de actualización.
 */
export function getUpdateStatus(jobId) {
  return axios.get(`${API_URL}?action=updateStatus&job_id=${jobId}`);
}

/**
 * Inicia la actualización de metadata de imágenes.
 * @param {string} userId Identificador del usuario.
 */
export function startUpdate(userId) {
  return axios.get(`${API_URL}?action=startUpdate&user_id=${userId}`);
}

/**
 * Detiene la actualización de metadata.
 * @param {string} jobId Identificador del proceso de actualización.
 */
export const stopUpdate = (jobId) => {
  return axios.post(`${API_URL}?action=stopUpdate`, { job_id: jobId });
};

/**
 * Inicia la actualización de metadata para una ciudad específica.
 * @param {string} userId Identificador del usuario.
 * @param {string} cityKey Llave de la ciudad (ej.: esp_bar_, fin_tam_, fin_hel_, ale_ber_).
 */
export function startUpdateCity(userId, cityKey) {
  return axios.get(`${API_URL}?action=startUpdateCity&user_id=${userId}&city=${cityKey}`);
}

/**
 * Elimina todas las imágenes.
 */
export function deleteAllImages() {
  return axios.delete(`${API_URL}?action=deleteAllImages`);
}

/**
 * Limpia la base de datos.
 */
export function clearDatabase() {
  return axios.delete(`${API_URL}?action=clearDatabase`);
}
