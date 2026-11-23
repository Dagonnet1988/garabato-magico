/* Dibujo de ejemplo: Parrot Ninja, con sus partes ya marcadas para mostrar cómo funciona.
   Los polígonos están en coordenadas de la foto original (base 1500 x 2000). */
(function (GM) {
  'use strict';
  const BW = 1500, BH = 2000;

  function circulo(cx, cy, r, n) {
    const pts = [];
    for (let i = 0; i < (n || 28); i++) { const a = (i / (n || 28)) * Math.PI * 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    return pts;
  }

  GM.MUESTRA = {
    nombre: 'Parrot Ninja',
    foto: 'assets/parrot-ninja.jpg',
    // El orden importa: lo último pinta encima.
    partes: [
      { tipo: 'cuerpo', poli: [[600, 1150], [700, 1150], [820, 1400], [870, 1700], [770, 1800], [630, 1800], [560, 1700], [560, 1300]] },
      { tipo: 'cabeza', poli: circulo(683, 968, 190) },
      { tipo: 'ojo', poli: circulo(690, 893, 38, 16) },
      { tipo: 'plumas', nombre: 'Cresta', poli: [[425, 530], [725, 530], [705, 805], [545, 805], [470, 700], [425, 600]] },
      { tipo: 'cinta', poli: [[280, 730], [518, 730], [512, 1010], [380, 1110], [270, 1100]] },
      { tipo: 'pico', poli: [[845, 890], [1070, 1090], [848, 1095]] },
      { tipo: 'ala', poli: [[628, 1355], [795, 1355], [795, 1645], [655, 1645]] },
      { tipo: 'espada', poli: [[390, 1325], [485, 1325], [612, 1515], [612, 1645], [540, 1645], [390, 1430]] },
      { tipo: 'pierna', nombre: 'Pierna izquierda', poli: [[90, 1440], [310, 1440], [470, 1560], [595, 1575], [600, 1650], [110, 1770], [85, 1700]] },
      { tipo: 'pierna', nombre: 'Pierna derecha', poli: [[860, 1700], [1140, 1270], [1340, 1270], [1340, 1630], [1170, 1570], [880, 1790]] },
    ],
    cuento: 'Parrot Ninja vive en el bosque. Un día salta muy alto para ver el mundo. Después vuela sobre los árboles. ¡Saca su espada y practica! En la noche duerme feliz.',
  };

  /** Convierte un polígono de la foto base a coordenadas del dibujo recortado. */
  GM.MUESTRA.mapear = function (poli, fuente, transf) {
    return poli.map(([x, y]) => [((x / BW) * fuente.w - transf.ox) * transf.k, ((y / BH) * fuente.h - transf.oy) * transf.k]);
  };
})(window.GM);
