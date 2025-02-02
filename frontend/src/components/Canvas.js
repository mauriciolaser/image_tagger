import React, { useEffect, useRef } from "react";
import p5 from "p5";

const Canvas = () => {
  const canvasRef = useRef(null);
  const p5InstanceRef = useRef(null);
  let imgSize = 100; // Tamaño inicial

  useEffect(() => {
    if (p5InstanceRef.current) {
      p5InstanceRef.current.remove();
      p5InstanceRef.current = null;
    }

    const sketch = (p) => {
      let character;
      let x, y;
      let dx, dy;
      let changeDirectionTime = p.millis() + p.random(5000, 8000);
      let isHovered = false;

      // Tirar un dado para elegir personaje
      const diceRoll = Math.floor(p.random(1, 7)); // Número entre 1 y 6
      const selectedCharacter = diceRoll <= 3 ? "pikachu.png" : "tails.webp";
      console.log(`🎲 Dado: ${diceRoll}, seleccionando ${selectedCharacter}`);

      p.preload = () => {
        character = p.loadImage(`/images/${selectedCharacter}`,
          () => console.log(`✅ ${selectedCharacter} cargado correctamente`),
          () => console.error(`❌ Error al cargar ${selectedCharacter}`)
        );
      };

      p.setup = () => {
        p.createCanvas(window.innerWidth, window.innerHeight).parent(canvasRef.current);
        x = p.width / 2;
        y = p.height / 2;
        dx = p.random(-2, 2);
        dy = p.random(-2, 2);
        console.log("🔹 Setup completo: Personaje en", { x, y });
      };

      p.draw = () => {
        p.clear();

        // Cambiar dirección cada 5-8 segundos
        if (p.millis() >= changeDirectionTime) {
          dx = p.random(-2, 2);
          dy = p.random(-2, 2);
          changeDirectionTime = p.millis() + p.random(5000, 8000);
          console.log("🔄 Cambiando dirección:", { dx, dy });
        }

        // Mover personaje
        x += dx;
        y += dy;

        // Rebote en los bordes
        if (x <= 50 || x >= p.width - 50) dx *= -1;
        if (y <= 50 || y >= p.height - 50) dy *= -1;

        // Detectar si el mouse está sobre el personaje
        isHovered = p.mouseX >= x - imgSize / 2 && p.mouseX <= x + imgSize / 2 &&
                    p.mouseY >= y - imgSize / 2 && p.mouseY <= y + imgSize / 2;

        // Ajustar tamaño progresivamente sin cambiar posición
        if (isHovered && imgSize < 500) {
          imgSize += 10; // Crecimiento gradual
          console.log("🖱️ Mouse sobre personaje - Tamaño:", imgSize);
        } else if (!isHovered && imgSize > 100) {
          imgSize -= 5; // Contracción gradual
          console.log("🚫 Mouse fuera de personaje - Tamaño:", imgSize);
        }

        p.imageMode(p.CENTER);
        p.push();

        if (isHovered) {
          p.tint(p.random(255), p.random(255), p.random(255)); // Efecto psicodélico
        } else {
          p.noTint();
        }

        p.image(character, x, y, imgSize, imgSize);
        p.pop();
      };

      p.windowResized = () => {
        p.resizeCanvas(window.innerWidth, window.innerHeight);
        console.log("📏 Canvas redimensionado");
      };
    };

    if (!p5InstanceRef.current) {
      p5InstanceRef.current = new p5(sketch, canvasRef.current);
    }

    return () => {
      if (p5InstanceRef.current) {
        p5InstanceRef.current.remove();
        p5InstanceRef.current = null;
        console.log("🗑️ Instancia de p5 eliminada");
      }
    };
  }, []); // Sin dependencias para evitar re-renderizados

  return <div ref={canvasRef} className="canvas-container" />;
};

export default Canvas;
