import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaBars, FaTimes } from 'react-icons/fa'; // Hamburguesa y "X"
import './Navbar.css';

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  return (
    <nav className="navbar">
      {/* Encabezado del Navbar (logo + ícono) */}
      <div className="navbar-header">
        <div className="logo-container">
          <img
            src="/image_tagger/images/logo.png"
            alt="Logo"
            className="navbar-logo"
          />
        </div>
        <div className="menu-icon" onClick={toggleMenu}>
          {menuOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
        </div>
      </div>

      {/* Lista de navegación */}
      <ul className={`nav-list ${menuOpen ? 'expanded' : ''}`}>

      <li className="nav-item">
          <Link to="/tag" className="nav-link" onClick={toggleMenu}>
            Taggear
          </Link>
        </li>
        
        <li className="nav-item">
          <Link to="/gallery" className="nav-link" onClick={toggleMenu}>
            Galería
          </Link>
        </li>

        <li className="nav-item">
          <Link to="/dashboard" className="nav-link" onClick={toggleMenu}>
            Dashboard
          </Link>
        </li>
        
      </ul>
    </nav>
  );
};

export default Navbar;
