// src/components/UserCard.js
import React from 'react';
import './UserCard.css';

const UserCard = ({ userId, username }) => {
  // Construye la URL que apunte a getUserCard.php (ajusta si tu backend está en otra ruta)
  const profileUrl = `${process.env.REACT_APP_API_URL}?action=getUserCard&user_id=${userId}`;

  return (
    <div className="user-card">
      <img
        src={profileUrl}
        alt="Foto de perfil"
        className="user-card-pic"
      />
      <h3 className="user-card-name">{username}</h3>
    </div>
  );
};

export default UserCard;
