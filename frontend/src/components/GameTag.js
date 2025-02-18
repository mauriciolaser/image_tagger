import React, { useState, useImperativeHandle, forwardRef, useRef } from 'react';
import './GameTag.css';

const GameTag = forwardRef((props, ref) => {
  const [count, setCount] = useState(0);
  const [showStreak, setShowStreak] = useState(false);
  const [visible, setVisible] = useState(false);
  const hideTimeoutRef = useRef(null);

  useImperativeHandle(ref, () => ({
    increment: () => {
      setCount(prevCount => {
        const newCount = prevCount + 1;
        // Mostrar el contador en la esquina
        setVisible(true);
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
        }
        // Ocultar el contador después de 1 segundo
        hideTimeoutRef.current = setTimeout(() => {
          setVisible(false);
        }, 1000);

        // Cada 10 tags, mostrar la animación de streak (imagen y mensaje)
        if (newCount % 10 === 0) {
          setShowStreak(true);
          setTimeout(() => setShowStreak(false), 1000);
        }
        return newCount;
      });
    },
    reset: () => {
      setCount(0);
    }
  }));

  return (
    <>
      {/* Contador en la esquina inferior izquierda */}
      <div className={`game-tag-counter ${visible ? 'visible' : ''}`}>
        x{count}
      </div>

      {/* Overlay de streak: imagen giratoria y mensaje de felicitación */}
      {showStreak && (
        <div className="game-tag-streak-overlay">
          <div className="streak-content">
            <img 
              src="image_tagger/images/streak.png" 
              alt="Streak" 
              className="game-tag-streak-image" 
            />
            <div className="streak-message">
              ¡MUY BIEN, HAS HECHO {count} TAGS AL HILO
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default GameTag;
