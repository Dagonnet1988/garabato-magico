/* Paso "Colorear": rellenar formas cerradas, crayón, lápiz (agrega líneas) y borrador.
   El color va en una capa debajo de las líneas, así el dibujo original no se pierde. */
(function (GM) {
  'use strict';
  const $ = GM.$;
  const COLORES = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#f06292', '#8d6e63', '#26c6da', '#c0ca33', '#212121', '#ffffff'];
  const S = { d: null, herr: 'cubeta', tam: 16, color: COLORES[3], pila: [], ult: null, corrido: { x: 0, y: 0 } };
  let L = null;

  function recordar() {
    const d = S.d;
    S.pila.push({
      dx: S.corrido.x, dy: S.corrido.y,
      c: d.color.getContext('2d').getImageData(0, 0, d.w, d.h),
      t: S.herr === 'lapiz' || S.herr === 'goma' ? d.tinta.getContext('2d').getImageData(0, 0, d.w, d.h) : null,
      u: d.colorUsado,
    });
    if (S.pila.length > 10) S.pila.shift();
  }

  function deshacer() {
    const u = S.pila.pop();
    if (!u) { GM.aviso('No hay nada que deshacer'); return; }
    // si la hoja creció después, lo de antes queda corrido
    const ox = S.corrido.x - u.dx, oy = S.corrido.y - u.dy;
    if (ox || oy || u.c.width !== S.d.w || u.c.height !== S.d.h) {
      S.d.color.getContext('2d').clearRect(0, 0, S.d.w, S.d.h);
      if (u.t) S.d.tinta.getContext('2d').clearRect(0, 0, S.d.w, S.d.h);
    }
    S.d.color.getContext('2d').putImageData(u.c, ox, oy);
    if (u.t) { S.d.tinta.getContext('2d').putImageData(u.t, ox, oy); S.d.tintaVer++; }
    S.d.colorUsado = u.u;
    cambiado();
  }

  function cambiado() {
    S.d.version++;
    GM.app.guardarLuego(S.d);
    L.pedir();
  }

  function rellenar(pt) {
    const d = S.d, w = d.w, h = d.h;
    const x0 = Math.round(pt.x), y0 = Math.round(pt.y);
    if (x0 < 0 || y0 < 0 || x0 >= w || y0 >= h) return;
    const pared = GM.imagen.mascara(d.tinta, 70);
    // engrosar las paredes 1 px para tapar huequitos
    const muro = pared.slice();
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (pared[p]) { muro[p - 1] = 1; muro[p + 1] = 1; muro[p - w] = 1; muro[p + w] = 1; }
    }
    if (muro[y0 * w + x0]) { GM.aviso('Toca dentro de una forma, no en la línea'); return; }
    const visto = new Uint8Array(w * h), pila = new Int32Array(w * h);
    let top = 0, n = 0, borde = false;
    pila[top++] = y0 * w + x0; visto[y0 * w + x0] = 1;
    while (top) {
      const p = pila[--top]; n++;
      const x = p % w, y = (p - x) / w;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) { borde = true; break; }
      const v = [p - 1, p + 1, p - w, p + w];
      for (let k = 0; k < 4; k++) { const q = v[k]; if (!visto[q] && !muro[q]) { visto[q] = 1; pila[top++] = q; } }
    }
    if (borde) { GM.aviso('Esa forma está abierta. Usa el crayón o cierra la línea con el lápiz.', 3400); return; }
    recordar();
    const ctx = d.color.getContext('2d');
    const img = ctx.getImageData(0, 0, w, h), o = img.data;
    const [r, g, b] = GM.hexARgb(S.color);
    for (let p = 0; p < w * h; p++) {
      if (!visto[p]) continue;
      // también 2 px debajo de la línea para que no quede borde blanco
      const x = p % w, y = (p - x) / w;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const q = yy * w + xx;
        if (!visto[q] && !muro[q] && (dx || dy)) continue;
        const i = q * 4; o[i] = r; o[i + 1] = g; o[i + 2] = b; o[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    d.colorUsado = true;
    cambiado();
  }

  /** Con Apple Pencil, apretar más hace la línea más gruesa. */
  function presion(ev) {
    if (!ev || ev.pointerType !== 'pen' || !ev.pressure) return 1;
    return 0.35 + ev.pressure * 1.3;
  }

  /** Si el trazo se sale del dibujo, la hoja del dibujo crece (para que la línea no se corte). */
  function hacerEspacio(pts, r) {
    const d = S.d, m = r + 2;
    let izq = 0, arr = 0, der = 0, aba = 0;
    for (const p of pts) {
      izq = Math.max(izq, m - p.x); arr = Math.max(arr, m - p.y);
      der = Math.max(der, p.x + m - d.w); aba = Math.max(aba, p.y + m - d.h);
    }
    if (izq <= 0 && arr <= 0 && der <= 0 && aba <= 0) return;
    const extra = 120, MAX = 2400;
    const L0 = izq > 0 ? Math.ceil(izq + extra) : 0, T0 = arr > 0 ? Math.ceil(arr + extra) : 0;
    const R0 = der > 0 ? Math.ceil(der + extra) : 0, B0 = aba > 0 ? Math.ceil(aba + extra) : 0;
    if (d.w + L0 + R0 > MAX || d.h + T0 + B0 > MAX) return; // ya es muy grande
    GM.agrandarDibujo(d, L0, T0, R0, B0);
    S.corrido.x += L0; S.corrido.y += T0;
    for (const p of pts) { p.x += L0; p.y += T0; }
    if (S.ult && pts.indexOf(S.ult) < 0) { S.ult.x += L0; S.ult.y += T0; }
    // la vista se corre igual, así el dibujo no salta en la pantalla
    L.vista.x -= L0 * L.vista.s; L.vista.y -= T0 * L.vista.s;
  }

  function trazo(a, b, ev) {
    const d = S.d;
    const r = S.tam * L.pxPorCss() * presion(ev);
    hacerEspacio(a === b ? [a] : [a, b], r);
    const capas = S.herr === 'goma' ? [d.color, d.tinta] : S.herr === 'lapiz' ? [d.tinta] : [d.color];
    capas.forEach((cv) => {
      const c = cv.getContext('2d');
      c.save();
      c.lineCap = 'round'; c.lineJoin = 'round';
      if (S.herr === 'goma') { c.globalCompositeOperation = 'destination-out'; c.lineWidth = r * 1.3; c.strokeStyle = '#000'; }
      else if (S.herr === 'lapiz') { c.lineWidth = Math.max(1.5, r * 0.35); c.strokeStyle = S.color === '#ffffff' ? '#2a2a35' : S.color; }
      else { c.lineWidth = r; c.strokeStyle = S.color; c.globalAlpha = 0.92; }
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x + 0.01, b.y); c.stroke();
      c.restore();
    });
    if (S.herr !== 'lapiz') d.colorUsado = true;
    if (S.herr !== 'crayon') d.tintaVer++;
    L.pedir();
  }

  const tocar = {
    inicio(pt, ev) {
      if (!S.d) return false;
      if (S.herr === 'cubeta') { rellenar(pt); return false; }
      recordar();
      S.ult = pt; trazo(pt, pt, ev);
      return true;
    },
    mover(pt, ev) { if (S.ult) { trazo(S.ult, pt, ev); S.ult = pt; } },
    fin() { S.ult = null; cambiado(); },
    cancelar() { S.ult = null; deshacer(); },
  };

  function elegirHerr(h) {
    S.herr = h;
    GM.$$('#pantalla-colorear .herr').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.herr === h)));
    $('#co-tamanos').style.visibility = h === 'cubeta' ? 'hidden' : 'visible';
  }

  GM.colorear = {
    init() {
      L = new GM.Lienzo($('#cv-colorear'), {
        tamano: () => (S.d ? { w: S.d.w, h: S.d.h } : { w: 100, h: 100 }),
        dibujar(ctx) {
          if (!S.d) return;
          if (S.d.colorUsado) ctx.drawImage(S.d.color, 0, 0);
          ctx.drawImage(S.d.tinta, 0, 0);
        },
        alTocar: tocar,
        // con Apple Pencil, el dedo igual puede rellenar con un toque
        dedoPermitido: () => S.herr === 'cubeta',
      });
      const pal = $('#co-paleta');
      COLORES.forEach((c) => {
        const b = document.createElement('button');
        b.className = 'color';
        b.style.setProperty('--c', c);
        b.setAttribute('aria-label', 'Color ' + c);
        b.setAttribute('aria-pressed', String(c === S.color));
        b.addEventListener('click', () => {
          S.color = c;
          if (S.herr === 'goma') elegirHerr('cubeta');
          GM.$$('.color', pal).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        });
        pal.appendChild(b);
      });
      GM.$$('#pantalla-colorear .herr').forEach((b) => b.addEventListener('click', () => elegirHerr(b.dataset.herr)));
      GM.$$('#co-tamanos .tam').forEach((b) => b.addEventListener('click', () => {
        S.tam = +b.dataset.tam;
        GM.$$('#co-tamanos .tam').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      }));
      GM.$('#co-tamanos .tam[data-tam="16"]').setAttribute('aria-pressed', 'true');
      $('#co-deshacer').addEventListener('click', deshacer);
      $('#co-zoom-mas').addEventListener('click', () => L.zoom(1.4));
      $('#co-zoom-menos').addEventListener('click', () => L.zoom(1 / 1.4));
      $('#co-zoom-ajustar').addEventListener('click', () => L.ajustar());
      elegirHerr('cubeta');
    },
    abrir(d, herr) {
      if (S.d !== d) { S.pila = []; S.corrido = { x: 0, y: 0 }; }
      if (herr) elegirHerr(herr);
      S.d = d;
      L.ajustado = false;
      L.redimensionar();
      L.pedir();
    },
    cerrar() {},
  };
})(window.GM);
