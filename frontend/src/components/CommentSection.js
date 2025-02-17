// CommentSection.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './CommentSection.css';

const CommentSection = ({ selectedImage, API_URL }) => {
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentSubmitStatus, setCommentSubmitStatus] = useState(null);
  const [loggedUser, setLoggedUser] = useState('');

  // Obtenemos el user_id desde localStorage (o se podría pasar como prop)
  const userId = localStorage.getItem('user_id');
  useEffect(() => {
    const storedUser = localStorage.getItem('username');
    if (storedUser) setLoggedUser(storedUser);
  }, []);

  // Al cambiar la imagen seleccionada, se obtienen sus comentarios
  useEffect(() => {
    if (selectedImage) {
      fetchComments();
    } else {
      setComments([]);
    }
  }, [selectedImage]);

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const response = await axios.get(API_URL, {
        params: { action: 'getComments', image_id: selectedImage.id }
      });
      if (response.data && Array.isArray(response.data.comments)) {
        setComments(response.data.comments);
      } else {
        setComments([]);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || !selectedImage || !userId) return;
    try {
      const response = await axios.post(API_URL, {
        action: 'addComment',
        image_id: selectedImage.id,
        user_id: userId,
        comment: commentText.trim(),
        author: loggedUser  // Enviar el nombre del usuario como autor
      }, { headers: { 'Content-Type': 'application/json' } });

      if (response.data.success) {
        setCommentSubmitStatus({ message: 'Comentario agregado correctamente.', type: 'success' });
        setCommentText('');
        fetchComments();
      } else {
        setCommentSubmitStatus({ message: 'No se pudo agregar el comentario.', type: 'error' });
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      setCommentSubmitStatus({ message: 'Error al agregar el comentario.', type: 'error' });
    } finally {
      setTimeout(() => setCommentSubmitStatus(null), 3000);
    }
  };

  const handleArchiveComment = async (commentId) => {
    try {
      const response = await axios.post(API_URL, {
        action: 'archiveComment',
        comment_id: commentId
      }, { headers: { 'Content-Type': 'application/json' } });

      if (response.data.success) {
        // Se elimina el comentario archivado de la lista
        setComments(prev => prev.filter(comment => comment.id !== commentId));
      } else {
        setCommentSubmitStatus({ message: 'No se pudo archivar el comentario.', type: 'error' });
      }
    } catch (error) {
      console.error('Error archiving comment:', error);
      setCommentSubmitStatus({ message: 'Error al archivar el comentario.', type: 'error' });
    } finally {
      setTimeout(() => setCommentSubmitStatus(null), 3000);
    }
  };

  return (
    <div className="comment-section">
      <h4>Comentarios</h4>
      {loadingComments ? (
        <p>Cargando comentarios...</p>
      ) : (
        <>
          {comments.length > 0 ? (
            <ul className="comment-list">
              {comments.map(comment => (
                <li key={comment.id} className="comment-item">
                  <p className="comment-text">{comment.comment}</p>
                  <div className="comment-meta">
                    <span className="comment-author">{comment.author || 'Anónimo'}</span>
                    <button
                      onClick={() => handleArchiveComment(comment.id)}
                      className="archive-comment-button"
                    >
                      Archivar comentario
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>No hay comentarios</p>
          )}
        </>
      )}

      <form className="comment-form" onSubmit={handleAddComment}>
        <input
          type="text"
          className="comment-input"
          placeholder="Agregar un comentario..."
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
        />
        <button type="submit" className="comment-submit-button">
          Agregar comentario
        </button>
      </form>

      {commentSubmitStatus && (
        <div
          className="comment-status-modal"
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            backgroundColor:
              commentSubmitStatus.type === "success"
                ? '#27ae60'
                : commentSubmitStatus.type === "error"
                  ? '#e74c3c'
                  : '#333',
            color: '#fff',
            padding: '10px',
            borderRadius: '5px',
            zIndex: 1000
          }}
        >
          {commentSubmitStatus.message}
        </div>
      )}
    </div>
  );
};

export default CommentSection;
