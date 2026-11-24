/* Utilidades compartidas. Todo vive en el objeto global GM (sin build, funciona abriendo index.html). */
window.GM = window.GM || {};
(function (GM) {
  'use strict';

  GM.$ = (sel, root) => (root || document).querySelector(sel);
  GM.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  GM.crearCanvas = function (w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  };

  GM.clonarCanvas = function (src) {
    const c = GM.crearCanvas(src.width, src.height);
    c.getContext('2d').drawImage(src, 0, 0);
    return c;
  };

  /** Quita tildes y pasa a minúsculas: "Mamá" -> "mama". */
  GM.normalizar = function (s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ñ/g, 'n');
  };

  GM.uid = function () {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  };

  let avisoTimer = 0;
  GM.aviso = function (texto, ms) {
    const el = GM.$('#aviso');
    if (!el) return;
    el.textContent = texto;
    el.hidden = false;
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(() => { el.hidden = true; }, ms || 2600);
  };

  GM.debounce = function (fn, ms) {
    let t = 0;
    return function () {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms);
    };
  };

  GM.hexARgb = function (hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };

  /* Matrices afines 2D [a,b,c,d,e,f] (mismo orden que canvas setTransform). */
  /** Agranda el dibujo agregando espacio a los lados; lo que había se corre (izq, arriba). */
  GM.agrandarDibujo = function (d, izq, arriba, der, abajo) {
    const w = d.w + izq + der, h = d.h + arriba + abajo;
    const mover = (cv) => { const c = GM.crearCanvas(w, h); c.getContext('2d').drawImage(cv, izq, arriba); return c; };
    d.tinta = mover(d.tinta); d.color = mover(d.color);
    const e = new Uint8Array(w * h);
    for (let y = 0; y < d.h; y++) e.set(d.etiquetas.subarray(y * d.w, (y + 1) * d.w), (y + arriba) * w + izq);
    d.etiquetas = e;
    d.partes.forEach((p) => { if (p.pivote) p.pivote = { x: p.pivote.x + izq, y: p.pivote.y + arriba }; });
    d.w = w; d.h = h;
    d.version = (d.version || 0) + 1; d.tintaVer = (d.tintaVer || 0) + 1; d._rig = null;
  };

  GM.mat = {
    id: () => [1, 0, 0, 1, 0, 0],
    mul(m, n) {
      return [
        m[0] * n[0] + m[2] * n[1],
        m[1] * n[0] + m[3] * n[1],
        m[0] * n[2] + m[2] * n[3],
        m[1] * n[2] + m[3] * n[3],
        m[0] * n[4] + m[2] * n[5] + m[4],
        m[1] * n[4] + m[3] * n[5] + m[5],
      ];
    },
    /** Rotar r, escalar (sx,sy) alrededor de (px,py) y luego trasladar (dx,dy). */
    alrededor(px, py, r, sx, sy, dx, dy) {
      const c = Math.cos(r), s = Math.sin(r);
      const a = c * sx, b = s * sx, cc = -s * sy, d = c * sy;
      return [a, b, cc, d, px - (a * px + cc * py) + dx, py - (b * px + d * py) + dy];
    },
    aplicar(m, x, y) {
      return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
    },
  };

  /** Componentes conexas (8 vecinos) de una máscara binaria. Devuelve {ids:Int32Array, areas:[], bbox:[]}. */
  GM.componentes = function (mask, w, h) {
    const ids = new Int32Array(w * h).fill(-1);
    const areas = [], cajas = [], tocaBorde = [];
    const pila = new Int32Array(w * h);
    let n = 0;
    for (let i = 0; i < w * h; i++) {
      if (!mask[i] || ids[i] !== -1) continue;
      let top = 0, area = 0, x0 = w, y0 = h, x1 = 0, y1 = 0, borde = false;
      pila[top++] = i; ids[i] = n;
      while (top) {
        const p = pila[--top];
        area++;
        const x = p % w, y = (p - x) / w;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (x <= 1 || y <= 1 || x >= w - 2 || y >= h - 2) borde = true;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            const q = yy * w + xx;
            if (mask[q] && ids[q] === -1) { ids[q] = n; pila[top++] = q; }
          }
        }
      }
      areas.push(area); cajas.push([x0, y0, x1, y1]); tocaBorde.push(borde);
      n++;
    }
    return { ids, areas, cajas, tocaBorde, n };
  };

  GM.canvasABlob = function (canvas) {
    return new Promise((res) => {
      try { canvas.toBlob((b) => res(b), 'image/png'); } catch (e) { res(null); }
    });
  };

  GM.cargarImagen = function (src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = src;
    });
  };

  GM.blobACanvas = async function (blob, w, h) {
    const c = GM.crearCanvas(w, h);
    if (!blob) return c;
    const url = URL.createObjectURL(blob);
    try {
      const img = await GM.cargarImagen(url);
      c.getContext('2d').drawImage(img, 0, 0, w, h);
    } finally {
      URL.revokeObjectURL(url);
    }
    return c;
  };
})(window.GM);
