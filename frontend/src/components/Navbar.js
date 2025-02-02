import React from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => {
  return (
    <nav style={styles.navbar}>
      <ul style={styles.navList}>

      <li style={styles.navItem}>
          <Link to="/gallery" style={styles.navLink}>Galería</Link>
        </li>

        <li style={styles.navItem}>
          <Link to="/tag" style={styles.navLink}>Taggear</Link>
        </li>

        <li style={styles.navItem}>
          <Link to="/image-upload" style={styles.navLink}>Upload</Link>
        </li>

        <li style={styles.navItem}>
          <Link to="/admin" style={styles.navLink}>Admin</Link>
        </li>

      </ul>
    </nav>
  );
};

// Estilos para la Navbar
const styles = {
  navbar: {
    backgroundColor: '#333',
    padding: '10px 20px',
    color: '#fff',
  },
  navList: {
    listStyle: 'none',
    display: 'flex',
    justifyContent: 'space-around',
    margin: 0,
    padding: 0,
  },
  navItem: {
    margin: '0 10px',
  },
  navLink: {
    color: '#fff',
    textDecoration: 'none',
    fontSize: '16px',
  },
};

export default Navbar;