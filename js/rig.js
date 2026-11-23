/* Esqueleto 2D: convierte las partes marcadas en piezas que giran alrededor de un "clavito"
   y las anima según el movimiento de cada parte y la acción del cuento. */
(function (GM) {
  'use strict';

  GM.MOVS = {
    aletear: { emoji: '🪽', nombre: 'Aletear' },
    paso: { emoji: '🦵', nombre: 'Dar pasos' },
    menear: { emoji: '〰️', nombre: 'Menear' },
    parpadear: { emoji: '👁️', nombre: 'Parpadear' },
    hablar: { emoji: '💬', nombre: 'Hablar' },
    cabecear: { emoji: '🙂', nombre: 'Cabecear' },
    respirar: { emoji: '🫧', nombre: 'Respirar' },
    blandir: { emoji: '⚔️', nombre: 'Blandir' },
    temblar: { emoji: '〽️', nombre: 'Temblar' },
    girar: { emoji: '🌀', nombre: 'Girar' },
    quieto: { emoji: '🧊', nombre: 'Quieto' },
  };

  GM.TIPOS = [
    { tipo: 'cabeza', nombre: 'Cabeza', emoji: '🙂', mov: 'cabecear' },
    { tipo: 'ojo', nombre: 'Ojo', emoji: '👁️', mov: 'parpadear' },
    { tipo: 'boca', nombre: 'Boca', emoji: '👄', mov: 'hablar' },
    { tipo: 'pico', nombre: 'Pico', emoji: '🐤', mov: 'hablar' },
    { tipo: 'nariz', nombre: 'Nariz', emoji: '👃', mov: 'quieto' },
    { tipo: 'oreja', nombre: 'Oreja', emoji: '👂', mov: 'menear' },
    { tipo: 'pelo', nombre: 'Pelo', emoji: '💇', mov: 'menear' },
    { tipo: 'plumas', nombre: 'Plumas', emoji: '🪶', mov: 'menear' },
    { tipo: 'cuerpo', nombre: 'Cuerpo', emoji: '👕', mov: 'respirar' },
    { tipo: 'brazo', nombre: 'Brazo', emoji: '💪', mov: 'aletear' },
    { tipo: 'mano', nombre: 'Mano', emoji: '✋', mov: 'aletear' },
    { tipo: 'ala', nombre: 'Ala', emoji: '🪽', mov: 'aletear' },
    { tipo: 'pierna', nombre: 'Pierna', emoji: '🦵', mov: 'paso' },
    { tipo: 'pie', nombre: 'Pie', emoji: '🦶', mov: 'paso' },
    { tipo: 'cola', nombre: 'Cola', emoji: '🐾', mov: 'menear' },
    { tipo: 'cinta', nombre: 'Cinta', emoji: '🎀', mov: 'menear' },
    { tipo: 'espada', nombre: 'Espada', emoji: '⚔️', mov: 'blandir' },
    { tipo: 'sombrero', nombre: 'Sombrero', emoji: '🎩', mov: 'quieto' },
    { tipo: 'otra', nombre: 'Otra', emoji: '✨', mov: 'temblar' },
  ];

  GM.ACCIONES = [
    { id: 'quieto', nombre: 'Quieto', emoji: '🧍' },
    { id: 'saltar', nombre: 'Saltar', emoji: '🦘' },
    { id: 'volar', nombre: 'Volar', emoji: '🕊️' },
    { id: 'caminar', nombre: 'Caminar', emoji: '🚶' },
    { id: 'correr', nombre: 'Correr', emoji: '🏃' },
    { id: 'bailar', nombre: 'Bailar', emoji: '💃' },
    { id: 'espada', nombre: 'Espada', emoji: '⚔️' },
    { id: 'mirar', nombre: 'Mirar', emoji: '👀' },
    { id: 'hablar', nombre: 'Hablar', emoji: '💬' },
    { id: 'feliz', nombre: 'Feliz', emoji: '😄' },
    { id: 'triste', nombre: 'Triste', emoji: '😢' },
    { id: 'dormir', nombre: 'Dormir', emoji: '😴' },
  ];

  GM.COLORES_PARTE = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#0fb5ba', '#f032e6', '#9a6324', '#2f4858', '#bcbd22', '#ff7fa7', '#1a9e77', '#7a5af8', '#d4a017'];

  /** Rellena el interior de figuras cerradas con la etiqueta de su contorno (para que el color pintado se mueva con la parte). */
  function rellenarInteriores(eff, pared, w, h) {
    const visto = new Uint8Array(w * h);
    const pila = new Int32Array(w * h);
    const region = new Int32Array(w * h);
    const cuenta = new Int32Array(256);
    for (let i = 0; i < w * h; i++) {
      if (pared[i] || visto[i]) continue;
      let top = 0, n = 0, borde = false, total = 0;
      cuenta.fill(0);
      pila[top++] = i; visto[i] = 1;
      while (top) {
        const p = pila[--top];
        region[n++] = p;
        const x = p % w, y = (p - x) / w;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) borde = true;
        const vec = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
        for (let k = 0; k < 4; k++) {
          const q = vec[k];
          if (q < 0) continue;
          if (pared[q]) { total++; cuenta[eff[q]]++; continue; }
          if (!visto[q]) { visto[q] = 1; pila[top++] = q; }
        }
      }
      if (borde || total === 0) continue;
      let mejor = 0, mc = 0;
      for (let l = 1; l < 256; l++) if (cuenta[l] > mc) { mc = cuenta[l]; mejor = l; }
      if (mejor && mc >= total * 0.45) {
        for (let k = 0; k < n; k++) if (!eff[region[k]]) eff[region[k]] = mejor;
      }
    }
  }

  /** Construye (y guarda en caché) el esqueleto del dibujo. */
  GM.rig = function (d) {
    if (d._rig && d._rigVer === d.version) return d._rig;
    const w = d.w, h = d.h, N = w * h;
    const comp = GM.crearCanvas(w, h);
    const cctx = comp.getContext('2d', { willReadFrequently: true });
    if (d.colorUsado) cctx.drawImage(d.color, 0, 0);
    cctx.drawImage(d.tinta, 0, 0);
    const img = cctx.getImageData(0, 0, w, h);
    const px = img.data;
    const pared = GM.imagen.mascara(d.tinta, 60);
    const eff = d.etiquetas.slice();
    if (d.partes.length) rellenarInteriores(eff, pared, w, h);

    // Cajas y celdas por parte
    const ids = d.partes.map((p) => p.id);
    const info = new Map();
    const cs = Math.max(3, Math.round(Math.max(w, h) / 150));
    const gw = Math.ceil(w / cs), gh = Math.ceil(h / cs);
    const todo = { sx: 0, sy: 0, n: 0, x0: w, y0: h, x1: 0, y1: 0 };
    for (const id of [0].concat(ids)) info.set(id, { x0: w, y0: h, x1: -1, y1: -1, n: 0, sx: 0, sy: 0, celdas: new Uint8Array(gw * gh) });
    for (let p = 0; p < N; p++) {
      if (px[p * 4 + 3] < 20) continue;
      const lab = info.has(eff[p]) ? eff[p] : 0;
      const it = info.get(lab);
      const x = p % w, y = (p - x) / w;
      if (x < it.x0) it.x0 = x; if (x > it.x1) it.x1 = x; if (y < it.y0) it.y0 = y; if (y > it.y1) it.y1 = y;
      it.n++; it.sx += x; it.sy += y;
      it.celdas[((y / cs) | 0) * gw + ((x / cs) | 0)] = 1;
      todo.n++; todo.sx += x; todo.sy += y;
      if (x < todo.x0) todo.x0 = x; if (x > todo.x1) todo.x1 = x; if (y < todo.y0) todo.y0 = y; if (y > todo.y1) todo.y1 = y;
    }

    // Recortes de cada pieza
    function recorte(lab, it) {
      if (it.x1 < 0) return null;
      const cw = it.x1 - it.x0 + 1, ch = it.y1 - it.y0 + 1;
      const c = GM.crearCanvas(cw, ch);
      const cx = c.getContext('2d');
      const id = cx.createImageData(cw, ch);
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        const p = (y + it.y0) * w + (x + it.x0);
        const l = info.has(eff[p]) ? eff[p] : 0;
        if (l !== lab) continue;
        const o = (y * cw + x) * 4, s = p * 4;
        id.data[o] = px[s]; id.data[o + 1] = px[s + 1]; id.data[o + 2] = px[s + 2]; id.data[o + 3] = px[s + 3];
      }
      cx.putImageData(id, 0, 0);
      return c;
    }

    const dil = new Map();
    function dilatada(id) {
      if (dil.has(id)) return dil.get(id);
      const src = info.get(id).celdas, out = new Uint8Array(gw * gh);
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
        if (!src[y * gw + x]) continue;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < gw && yy < gh) out[yy * gw + xx] = 1;
        }
      }
      dil.set(id, out);
      return out;
    }

    const partes = [];
    d.partes.forEach((pd) => {
      const it = info.get(pd.id);
      if (!it || it.n === 0) return;
      partes.push({ id: pd.id, tipo: pd.tipo, mov: pd.mov, datos: pd, it, area: it.n,
        cx: it.sx / it.n, cy: it.sy / it.n, canvas: recorte(pd.id, it), x: it.x0, y: it.y0 });
    });

    // Padre: la parte más grande con la que se toca
    for (const p of partes) {
      p.padre = null;
      if (p.tipo === 'cuerpo') continue;
      let mejor = null, mejorPuntos = 0;
      for (const q of partes) {
        if (q === p || q.area <= p.area) continue;
        const dq = dilatada(q.id);
        let puntos = 0;
        const c = p.it.celdas;
        for (let k = 0; k < c.length; k++) if (c[k] && dq[k]) puntos++;
        if (p.cx >= q.it.x0 && p.cx <= q.it.x1 && p.cy >= q.it.y0 && p.cy <= q.it.y1) puntos += 3;
        if (puntos > mejorPuntos || (puntos === mejorPuntos && puntos > 0 && mejor && q.area < mejor.area)) { mejor = q; mejorPuntos = puntos; }
      }
      if (mejor && mejorPuntos > 0) p.padre = mejor.id;
    }
    // Evitar ciclos (por si acaso)
    const porId = new Map(partes.map((p) => [p.id, p]));
    for (const p of partes) {
      let q = p, pasos = 0;
      while (q && q.padre !== null && pasos < 50) { q = porId.get(q.padre); pasos++; }
      if (pasos >= 50) p.padre = null;
    }

    // Clavito (pivote): el punto de la parte más cercano al centro de su padre (o del dibujo)
    const centro = { x: todo.n ? todo.sx / todo.n : w / 2, y: todo.n ? todo.sy / todo.n : h / 2 };
    for (const p of partes) {
      if (p.datos.pivote) { p.pivote = { x: p.datos.pivote.x, y: p.datos.pivote.y }; p.pivoteAuto = false; continue; }
      const padre = p.padre !== null ? porId.get(p.padre) : null;
      const obj = padre ? { x: padre.cx, y: padre.cy } : centro;
      let best = null, bd = Infinity;
      const c = p.it.celdas;
      for (let k = 0; k < c.length; k++) {
        if (!c[k]) continue;
        const x = (k % gw + 0.5) * cs, y = (((k / gw) | 0) + 0.5) * cs;
        const dd = (x - obj.x) * (x - obj.x) + (y - obj.y) * (y - obj.y);
        if (dd < bd) { bd = dd; best = { x, y }; }
      }
      p.pivote = best || { x: p.cx, y: p.cy };
      p.pivoteAuto = true;
    }

    // Lados (para alternar piernas y alas)
    const grupos = {};
    for (const p of partes) (grupos[p.mov] = grupos[p.mov] || []).push(p);
    Object.values(grupos).forEach((g) => {
      g.sort((a, b) => a.pivote.x - b.pivote.x);
      g.forEach((p, i) => { p.lado = i % 2 === 0 ? 1 : -1; p.fase = i * 1.3; });
    });

    // Orden de dibujo: padres antes que hijos; cuerpo primero
    const orden = [];
    const puesto = new Set();
    function poner(p) {
      if (puesto.has(p.id)) return;
      if (p.padre !== null && porId.has(p.padre)) poner(porId.get(p.padre));
      puesto.add(p.id); orden.push(p);
    }
    partes.slice().sort((a, b) => (a.tipo === 'cuerpo' ? -1 : 0) - (b.tipo === 'cuerpo' ? -1 : 0) || b.area - a.area).forEach(poner);

    const base = info.get(0);
    const rig = {
      w, h, partes: orden, porId, centro,
      base: base.n ? { canvas: recorte(0, base), x: base.x0, y: base.y0 } : null,
      caja: { x0: todo.x0, y0: todo.y0, x1: todo.x1, y1: todo.y1 },
      pie: { x: (todo.x0 + todo.x1) / 2, y: todo.y1 },
    };
    d._rig = rig; d._rigVer = d.version;
    return rig;
  };

  function sierra(t) { const f = t - Math.floor(t); return f < 0.35 ? f / 0.35 : 1 - (f - 0.35) / 0.65; }

  /** Pose local de una parte: [giro, escalaX, escalaY, dx, dy]. */
  function pose(p, t, acc, rig) {
    let r = 0, sx = 1, sy = 1, dx = 0, dy = 0;
    const f = p.fase || 0, lado = p.lado || 1;
    const mueve = acc === 'caminar' || acc === 'correr' || acc === 'saltar' || acc === 'bailar';
    switch (p.mov) {
      case 'aletear': {
        const vel = acc === 'volar' ? 16 : mueve ? 9 : acc === 'feliz' ? 10 : 4;
        const amp = acc === 'volar' ? 0.6 : mueve || acc === 'feliz' ? 0.4 : acc === 'triste' || acc === 'dormir' ? 0.04 : 0.14;
        r = Math.sin(t * vel + f) * amp * lado;
        break;
      }
      case 'paso': {
        const vel = acc === 'correr' ? 13 : acc === 'caminar' ? 6.5 : acc === 'saltar' ? 7 : acc === 'bailar' ? 6 : 2;
        const amp = acc === 'correr' ? 0.5 : acc === 'caminar' ? 0.32 : acc === 'saltar' ? 0.35 : acc === 'bailar' ? 0.3 : acc === 'volar' ? 0.18 : 0.04;
        r = Math.sin(t * vel + (lado > 0 ? 0 : Math.PI)) * amp;
        break;
      }
      case 'menear': {
        const vel = mueve || acc === 'volar' ? 8 : 3;
        const amp = mueve || acc === 'volar' || acc === 'feliz' ? 0.28 : 0.1;
        r = Math.sin(t * vel + f) * amp;
        break;
      }
      case 'parpadear': {
        const cerrado = acc === 'dormir' || ((t + f) % 3.4) < 0.15;
        if (cerrado) { sy = 0.12; dy = 0; }
        break;
      }
      case 'hablar': {
        const habla = acc === 'hablar' || acc === 'feliz' || (acc === 'quieto' && ((t % 4) < 1.2));
        const dir = p.cx >= p.pivote.x ? 1 : -1;
        if (habla) r = (Math.sin(t * 15) > 0 ? 0.2 : 0.02) * dir;
        break;
      }
      case 'cabecear': {
        if (acc === 'mirar') r = Math.sin(t * 1.1) * 0.22;
        else if (acc === 'dormir') r = 0.22 + Math.sin(t * 1.2) * 0.03;
        else if (acc === 'triste') r = 0.14;
        else if (acc === 'bailar' || acc === 'feliz') r = Math.sin(t * 6) * 0.14;
        else r = Math.sin(t * 1.6 + f) * 0.06;
        break;
      }
      case 'respirar': {
        const s = acc === 'dormir' ? Math.sin(t * 1.4) * 0.04 : Math.sin(t * 2.4) * 0.025;
        sx = 1 - s * 0.5; sy = 1 + s;
        break;
      }
      case 'blandir': {
        if (acc === 'espada') r = -0.9 + 1.5 * sierra(t * 1.3);
        else r = Math.sin(t * 2 + f) * (mueve ? 0.25 : 0.08);
        break;
      }
      case 'temblar': r = Math.sin(t * 22 + f) * 0.07; break;
      case 'girar': r = t * 3; break;
      default: break;
    }
    return [r, sx, sy, dx, dy];
  }

  /** Movimiento del personaje completo según la acción. Devuelve matriz alrededor de los pies. */
  GM.raiz = function (rig, t, acc, ancho) {
    const H = rig.caja.y1 - rig.caja.y0 || rig.h;
    let dx = 0, dy = 0, r = 0, sx = 1, sy = 1;
    switch (acc) {
      case 'saltar': {
        const f = (t * 0.9) % 1;
        const alto = f < 0.8 ? Math.sin((f / 0.8) * Math.PI) : 0;
        dy = -alto * H * 0.35;
        if (f >= 0.8) { const q = Math.sin(((f - 0.8) / 0.2) * Math.PI); sy = 1 - q * 0.12; sx = 1 + q * 0.08; }
        break;
      }
      case 'volar': dy = -H * 0.28 + Math.sin(t * 2.2) * H * 0.06; r = Math.sin(t * 1.4) * 0.06; dx = Math.sin(t * 0.7) * (ancho || H) * 0.12; break;
      case 'caminar': dx = Math.sin(t * 0.55) * (ancho || H) * 0.16; dy = -Math.abs(Math.sin(t * 6.5)) * H * 0.02; r = Math.sin(t * 6.5) * 0.02; break;
      case 'correr': dx = Math.sin(t * 0.9) * (ancho || H) * 0.22; dy = -Math.abs(Math.sin(t * 13)) * H * 0.04; r = Math.cos(t * 0.9) * 0.1; break;
      case 'bailar': r = Math.sin(t * 3.2) * 0.16; dx = Math.sin(t * 3.2) * H * 0.06; dy = -Math.abs(Math.sin(t * 6.4)) * H * 0.04; break;
      case 'espada': dx = sierra(t * 1.3) * H * 0.08; r = sierra(t * 1.3) * 0.06; break;
      case 'feliz': dy = -Math.abs(Math.sin(t * 5)) * H * 0.07; break;
      case 'triste': r = 0.04; sy = 0.97; break;
      case 'dormir': r = -0.06; sy = 0.98 + Math.sin(t * 1.4) * 0.01; break;
      case 'mirar': r = Math.sin(t * 1.1) * 0.04; break;
      default: dy = -Math.abs(Math.sin(t * 1.8)) * H * 0.008;
    }
    return GM.mat.alrededor(rig.pie.x, rig.pie.y, r, sx, sy, dx, dy);
  };

  /** Dibuja el personaje animado con la transformación actual del contexto como base. */
  GM.dibujarRig = function (ctx, rig, t, acc, opciones) {
    const o = opciones || {};
    const T = ctx.getTransform();
    const B = GM.mat.mul([T.a, T.b, T.c, T.d, T.e, T.f], o.raiz || GM.mat.id());
    const mats = new Map();
    const set = (m) => ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
    if (rig.base) { set(B); ctx.drawImage(rig.base.canvas, rig.base.x, rig.base.y); }
    for (const p of rig.partes) {
      const pm = p.padre !== null && mats.has(p.padre) ? mats.get(p.padre) : B;
      const [r, sx, sy, dx, dy] = pose(p, t, acc, rig);
      let local;
      if (p.mov === 'parpadear' || p.mov === 'respirar') {
        const cx = p.mov === 'parpadear' ? p.x + p.canvas.width / 2 : p.pivote.x;
        const cy = p.mov === 'parpadear' ? p.y + p.canvas.height / 2 : p.pivote.y;
        local = GM.mat.alrededor(cx, cy, r, sx, sy, dx, dy);
      } else {
        local = GM.mat.alrededor(p.pivote.x, p.pivote.y, r, sx, sy, dx, dy);
      }
      const m = GM.mat.mul(pm, local);
      mats.set(p.id, m);
      set(m);
      ctx.drawImage(p.canvas, p.x, p.y);
    }
    ctx.setTransform(T);
  };
})(window.GM);
