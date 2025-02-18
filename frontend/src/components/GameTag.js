import React, { useState, useImperativeHandle, forwardRef, useRef, useEffect } from 'react';
import './GameTag.css';

const GameTag = forwardRef((props, ref) => {
  const [count, setCount] = useState(0);
  const [showStreak, setShowStreak] = useState(false);
  const [visible, setVisible] = useState(false);
  const hideTimeoutRef = useRef(null);

  // Estado para la posición de la imagen streak (inicialmente centrada)
  const [position, setPosition] = useState({ left: '50vw', top: '50vh' });

  // Estados para la barra de progreso del streak
  const [streak, setStreak] = useState(0);
  const [streakTime, setStreakTime] = useState(60); // tiempo en segundos
  const streakIntervalRef = useRef(null);

  const resetStreakTimer = () => {
    if (streakIntervalRef.current) {
      clearInterval(streakIntervalRef.current);
    }
    setStreakTime(60);
    streakIntervalRef.current = setInterval(() => {
      setStreakTime(prevTime => {
        if (prevTime <= 0.1) {
          clearInterval(streakIntervalRef.current);
          streakIntervalRef.current = null;
          setStreak(0); // Reinicia el streak al expirar el tiempo
          return 60;
        }
        return prevTime - 0.1;
      });
    }, 100);
  };

  useImperativeHandle(ref, () => ({
    increment: () => {
      setCount(prevCount => {
        const newCount = prevCount + 1;
        // Mostrar el contador
        setVisible(true);
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
        }
        // Ocultar el contador después de 1 segundo
        hideTimeoutRef.current = setTimeout(() => {
          setVisible(false);
        }, 1000);

        // Cada 10 tags, mostrar el overlay de streak (imagen y mensaje)
        if (newCount % 10 === 0) {
          setShowStreak(true);
          // Se mantiene visible el overlay durante 5 segundos
          setTimeout(() => {
            setShowStreak(false);
            // Reiniciar la posición a centro al ocultar el overlay
            setPosition({ left: '50vw', top: '50vh' });
          }, 5000);
        }
        return newCount;
      });

      // Incrementar streak y reiniciar el timer
      setStreak(prev => prev + 1);
      resetStreakTimer();
    },
    reset: () => {
      setCount(0);
      setStreak(0);
      setStreakTime(60);
      if (streakIntervalRef.current) {
        clearInterval(streakIntervalRef.current);
        streakIntervalRef.current = null;
      }
    }
  }));

  // Efecto para animar el movimiento de la imagen de streak por 4 puntos aleatorios
  useEffect(() => {
    if (showStreak) {
      // Genera 4 puntos aleatorios (con márgenes para que no queden pegados al borde)
      const randomPoints = Array.from({ length: 4 }, () => ({
        left: `${Math.random() * 80 + 10}vw`, // entre 10vw y 90vw
        top: `${Math.random() * 80 + 10}vh`    // entre 10vh y 90vh
      }));

      let currentIndex = 0;
      const interval = setInterval(() => {
        if (currentIndex < randomPoints.length) {
          setPosition(randomPoints[currentIndex]);
          currentIndex++;
        } else {
          clearInterval(interval);
        }
      }, 1000); // Cada 1 segundo se mueve a la siguiente posición

      return () => clearInterval(interval);
    }
  }, [showStreak]);

  // Limpieza de intervalos al desmontar el componente
  useEffect(() => {
    return () => {
      if (streakIntervalRef.current) clearInterval(streakIntervalRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  return (
    <>
      {/* Contador en la esquina inferior izquierda */}
      <div className={`game-tag-counter ${visible ? 'visible' : ''}`}>
        x{count}
      </div>

      {/* Barra de progreso del streak */}
      {streak > 0 && (
        <div className="streak-progress-container">
          <div className="streak-progress-bar-container">
            <div 
              className="streak-progress-bar"
              style={{ width: `${(streakTime / 60) * 100}%` }}
            ></div>
            <div className="streak-progress-number">{streak}</div>
          </div>
        </div>
      )}

      {/* Overlay de streak: la imagen se mueve y el mensaje permanece fijo */}
      {showStreak && (
        <div className="game-tag-streak-overlay">
          {/* Contenedor de la imagen móvil */}
          <div 
            className="streak-image-container"
            style={{
              position: 'absolute',
              left: position.left,
              top: position.top,
              transition: 'left 1s ease, top 1s ease'
            }}
          >
            <img 
              src="/image_tagger/images/streak.png" 
              alt="Streak" 
              className="game-tag-streak-image" 
            />
          </div>
          {/* Contenedor del mensaje fijo */}
          <div className="streak-message-container">
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
