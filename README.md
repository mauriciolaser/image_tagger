# image_tagger

Frontend: React. 

Backend: Configurado para ser implementado en un servidor Apache.
Reemplazar las variables de entorno y gestionarlas con vlucas/phpdotenv.

## Sobre el programa

Carga las imágenes y tagéalas. 
Los usuarios solo pueden ver sus tags. 
Al exportar los tags se puede ver todos los tags agregados y trabajar en un merge.

## Notas

La carga de imágenes no está limitada. Es posible que el batch falle si son demasiadas y el servidor no está acondicionada para recibirlas. Más importantemente, se ha probado subiendo un batch de 5k imágenes y se ha corrompido las tablas 'beyond repair'. 
