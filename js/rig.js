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

  // Cosas que se agarran con la mano, y las partes que pueden agarrarlas
  const SOSTENIDOS = new Set(['espada']);
  const MANOS = new Set(['mano', 'brazo', 'ala']);

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

  /**
   * Pedacitos de línea que quedaron sin marcar al borde de una parte (por pintar un poco corto)
   * se quedaban quietos y se veían como rayas negras al moverse. Si un pedazo sin marcar es pequeño
   * y toca una parte, pasa a ser de esa parte. Lo grande sin marcar sigue siendo el cuerpo base.
   */
  function absorberRestos(eff, px, w, h) {
    const N = w * h, m = new Uint8Array(N);
    let tinta = 0;
    for (let p = 0; p < N; p++) {
      if (px[p * 4 + 3] < 20) continue;
      tinta++;
      if (!eff[p]) m[p] = 1;
    }
    const c = GM.componentes(m, w, h);
    if (!c.n) return;
    const limite = Math.max(40, tinta * 0.04);
    const votos = new Array(c.n);
    for (let p = 0; p < N; p++) {
      const k = c.ids[p];
      if (k < 0 || c.areas[k] > limite) continue;
      const x = p % w;
      const vec = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w];
      for (const q of vec) {
        if (q < 0 || q >= N || !eff[q] || px[q * 4 + 3] < 20) continue;
        const v = votos[k] || (votos[k] = new Map());
        v.set(eff[q], (v.get(eff[q]) || 0) + 1);
      }
    }
    const destino = new Int16Array(c.n);
    votos.forEach((v, k) => {
      if (!v) return;
      let mejor = 0, mc = 0;
      v.forEach((n, lab) => { if (n > mc) { mc = n; mejor = lab; } });
      destino[k] = mejor;
    });
    for (let p = 0; p < N; p++) { const k = c.ids[p]; if (k >= 0 && destino[k]) eff[p] = destino[k]; }
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
    if (d.partes.length) { rellenarInteriores(eff, pared, w, h); absorberRestos(eff, px, w, h); }

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

    // Padre: la parte a la que la niña la unió; si no, la más grande con la que se toca.
    // Lo que se agarra con la mano (espada) prefiere un ala, brazo o mano aunque toque algo más grande.
    const porIdDatos = new Map(partes.map((p) => [p.id, p]));
    for (const p of partes) {
      p.padre = null;
      const u = p.datos.unida;
      if (u === 'nada') continue;
      if (u && u !== p.id && porIdDatos.has(u)) { p.padre = u; continue; }
      if (p.tipo === 'cuerpo') continue;
      const agarra = SOSTENIDOS.has(p.tipo);
      if (agarra) {
        // la espada va con el ala, brazo o mano más cercana (aunque no se toquen)
        const mano = masCercana(p, partes.filter((q) => q !== p && MANOS.has(q.tipo)));
        if (mano) { p.padre = mano.id; continue; }
      }
      let mejor = null, mejorPuntos = 0;
      for (const q of partes) {
        if (q === p || (q.area <= p.area && !(agarra && MANOS.has(q.tipo)))) continue;
        const dq = dilatada(q.id);
        let puntos = 0;
        const c = p.it.celdas;
        for (let k = 0; k < c.length; k++) if (c[k] && dq[k]) puntos++;
        if (p.cx >= q.it.x0 && p.cx <= q.it.x1 && p.cy >= q.it.y0 && p.cy <= q.it.y1) puntos += 3;
        if (agarra && puntos > 0 && MANOS.has(q.tipo)) puntos += 100000;
        if (puntos > mejorPuntos || (puntos === mejorPuntos && puntos > 0 && mejor && q.area < mejor.area)) { mejor = q; mejorPuntos = puntos; }
      }
      if (mejor && mejorPuntos > 0) p.padre = mejor.id;
    }
    function masCercana(p, candidatas) {
      const mias = [];
      p.it.celdas.forEach((v, k) => { if (v) mias.push(k); });
      let mejor = null, md = Infinity;
      for (const q of candidatas) {
        const c = q.it.celdas;
        for (let k = 0; k < c.length; k++) {
          if (!c[k]) continue;
          const qx = k % gw, qy = (k / gw) | 0;
          for (const m of mias) {
            const dx = (m % gw) - qx, dy = ((m / gw) | 0) - qy, dd = dx * dx + dy * dy;
            if (dd < md) { md = dd; mejor = q; }
          }
        }
      }
      const lim = Math.max(gw, gh) * 0.15;
      return md <= lim * lim ? mejor : null;
    }

    // Evitar ciclos (por si acaso)
    const porId = new Map(partes.map((p) => [p.id, p]));
    for (const p of partes) {
      let q = p, pasos = 0;
      while (q && q.padre !== null && pasos < 300) { q = porId.get(q.padre); pasos++; if (q === p) break; }
      if (q === p || pasos >= 300) p.padre = null;
    }
    // Quién sostiene la espada (para moverla con su ala o brazo)
    for (const p of partes) if (p.mov === 'blandir' && p.padre !== null && porId.get(p.padre).mov !== 'blandir') porId.get(p.padre).sostiene = true;

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

    // Relleno del hueco: lo que queda detrás de una parte cuando se mueve toma el color de alrededor
    if (d.colorUsado && partes.length) {
      const colorPx = d.color.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
      for (const p of partes) p.relleno = hueco(p.id, eff, colorPx, pared, w, h);
    }

    const base = info.get(0);
    const rig = {
      w, h, partes: orden, porId, centro, eff,
      base: base.n ? { canvas: recorte(0, base), x: base.x0, y: base.y0 } : null,
      caja: { x0: todo.x0, y0: todo.y0, x1: todo.x1, y1: todo.y1 },
      pie: { x: (todo.x0 + todo.x1) / 2, y: todo.y1 },
    };
    d._rig = rig; d._rigVer = d.version;
    return rig;
  };

  /** Llena la zona de una parte con el color que la rodea (sin contar las líneas), para tapar el hueco. */
  function hueco(id, eff, col, pared, w, h) {
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let p = 0; p < w * h; p++) {
      if (eff[p] !== id) continue;
      const x = p % w, y = (p - x) / w;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x1 < 0) return null;
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
    const lleno = new Uint8Array(cw * ch), cola = new Int32Array(cw * ch);
    const out = new Uint8ClampedArray(cw * ch * 4);
    let ini = 0, fin = 0, opacos = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const p = y * w + x;
      if (eff[p] !== id) continue;
      const vec = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of vec) {
        if (q < 0 || eff[q] === id) continue;
        const l = (y - y0) * cw + (x - x0), o = l * 4, s = q * 4;
        out[o] = col[s]; out[o + 1] = col[s + 1]; out[o + 2] = col[s + 2]; out[o + 3] = col[s + 3];
        if (col[s + 3] > 20) opacos++;
        lleno[l] = 1; cola[fin++] = l;
        break;
      }
    }
    if (!opacos) return null;
    // 1) el color avanza sin cruzar líneas (así el color del cuerpo no se sale de su borde)
    // 2) luego se completan las líneas y los huequitos encerrados
    for (let fase = 0; fase < 2; fase++) {
      if (fase === 1) { ini = 0; fin = 0; for (let l = 0; l < cw * ch; l++) if (lleno[l]) cola[fin++] = l; }
      while (ini < fin) {
        const l = cola[ini++], lx = l % cw, ly = (l - lx) / cw;
        const vec = [lx > 0 ? l - 1 : -1, lx < cw - 1 ? l + 1 : -1, ly > 0 ? l - cw : -1, ly < ch - 1 ? l + cw : -1];
        for (const m of vec) {
          if (m < 0 || lleno[m]) continue;
          const mx = m % cw, my = (m - mx) / cw, q = (my + y0) * w + (mx + x0);
          if (eff[q] !== id || (fase === 0 && pared[q])) continue;
          lleno[m] = 1; cola[fin++] = m;
          out[m * 4] = out[l * 4]; out[m * 4 + 1] = out[l * 4 + 1]; out[m * 4 + 2] = out[l * 4 + 2]; out[m * 4 + 3] = out[l * 4 + 3];
        }
      }
    }
    const c = GM.crearCanvas(cw, ch);
    c.getContext('2d').putImageData(new ImageData(out, cw, ch), 0, 0);
    return { canvas: c, x: x0, y: y0 };
  }

  function sierra(t) { const f = t - Math.floor(t); return f < 0.35 ? f / 0.35 : 1 - (f - 0.35) / 0.65; }

  /** Pose local de una parte: [giro, escalaX, escalaY, dx, dy]. */
  function pose(p, t, acc, rig) {
    let r = 0, sx = 1, sy = 1, dx = 0, dy = 0;
    if (acc === 'pose') return [r, sx, sy, dx, dy];
    const f = p.fase || 0, lado = p.lado || 1;
    const mueve = acc === 'caminar' || acc === 'correr' || acc === 'saltar' || acc === 'bailar';
    if (acc === 'espada' && p.sostiene) {
      // el ala o brazo que tiene la espada da el golpe; la espada va pegada
      const dir = p.cx >= p.pivote.x ? 1 : -1;
      return [(-0.55 + 1.0 * sierra(t * 1.3)) * dir, 1, 1, 0, 0];
    }
    // con la espada en la mano no aletea: solo se mece un poquito (al caminar, volar, etc.)
    if (p.sostiene) return [Math.sin(t * 2 + f) * (acc === 'quieto' || acc === 'dormir' ? 0.03 : 0.07), 1, 1, 0, 0];
    switch (p.mov) {
      case 'aletear': {
        const vel = acc === 'volar' ? 16 : mueve ? 9 : acc === 'feliz' ? 10 : 4;
        const amp = acc === 'volar' ? 0.6 : mueve || acc === 'feliz' ? 0.4 : acc === 'triste' || acc === 'dormir' ? 0.04 : 0.14;
        r = Math.sin(t * vel + f) * amp * lado;
        break;
      }
      case 'paso': {
        const vel = acc === 'correr' ? 13 : acc === 'caminar' ? 6.5 : acc === 'saltar' ? 7 : acc === 'bailar' ? 6 : 2;
        const amp = acc === 'correr' ? 0.5 : acc === 'caminar' ? 0.32 : acc === 'saltar' ? 0.35 : acc === 'bailar' ? 0.3 : acc === 'volar' ? 0.18 : acc === 'espada' ? 0 : 0.04;
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
        if (acc === 'espada') r = p.padre !== null && rig.porId.get(p.padre).sostiene ? -0.25 + 0.45 * sierra(t * 1.3) : -0.9 + 1.5 * sierra(t * 1.3);
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
    const cp = GM.cajaPose(rig);
    const pie = cp.pie;
    const H = cp.y1 - cp.y0 || rig.h;
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
      case 'pose': break;
      default: dy = -Math.abs(Math.sin(t * 1.8)) * H * 0.008;
    }
    return GM.mat.alrededor(pie.x, pie.y, r, sx, sy, dx, dy);
  };

  /** Postura de reposo que la niña acomodó con el dedo (giro y desplazamiento). */
  function reposo(p) {
    const r = p.datos.reposo;
    return r && (r.r || r.dx || r.dy) ? GM.mat.alrededor(p.pivote.x, p.pivote.y, r.r || 0, 1, 1, r.dx || 0, r.dy || 0) : null;
  }

  /** Matriz de cada parte (en coordenadas del dibujo, multiplicadas por B). */
  GM.matricesRig = function (rig, t, acc, B) {
    const mats = new Map();
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
      const rp = reposo(p);
      if (rp) local = GM.mat.mul(rp, local);
      mats.set(p.id, GM.mat.mul(pm, local));
    }
    return mats;
  };

  /** Caja del personaje en su postura de reposo (para apoyar los pies en el suelo). */
  GM.cajaPose = function (rig) {
    const firma = rig.partes.map((p) => JSON.stringify(p.datos.reposo || 0) + p.pivote.x + ',' + p.pivote.y).join('|');
    if (rig._cajaFirma === firma) return rig._caja;
    const mats = GM.matricesRig(rig, 0, 'pose', GM.mat.id());
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const meter = (m, bx, by, bw, bh) => {
      [[bx, by], [bx + bw, by], [bx, by + bh], [bx + bw, by + bh]].forEach(([x, y]) => {
        const q = GM.mat.aplicar(m, x, y);
        if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1];
      });
    };
    if (rig.base) meter(GM.mat.id(), rig.base.x, rig.base.y, rig.base.canvas.width, rig.base.canvas.height);
    for (const p of rig.partes) meter(mats.get(p.id), p.x, p.y, p.canvas.width, p.canvas.height);
    if (!isFinite(x0)) { x0 = rig.caja.x0; y0 = rig.caja.y0; x1 = rig.caja.x1; y1 = rig.caja.y1; }
    rig._caja = { x0, y0, x1, y1, pie: { x: (x0 + x1) / 2, y: y1 } };
    rig._cajaFirma = firma;
    return rig._caja;
  };

  /** Dibuja el personaje animado con la transformación actual del contexto como base. */
  GM.dibujarRig = function (ctx, rig, t, acc, opciones) {
    const o = opciones || {};
    const T = ctx.getTransform();
    const B = GM.mat.mul([T.a, T.b, T.c, T.d, T.e, T.f], o.raiz || GM.mat.id());
    const mats = GM.matricesRig(rig, t, acc, B);
    const set = (m) => ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
    if (rig.base) { set(B); ctx.drawImage(rig.base.canvas, rig.base.x, rig.base.y); }
    for (const p of rig.partes) {
      if (p.relleno) {
        set(p.padre !== null && mats.has(p.padre) ? mats.get(p.padre) : B);
        ctx.drawImage(p.relleno.canvas, p.relleno.x, p.relleno.y);
      }
      set(mats.get(p.id));
      ctx.drawImage(p.canvas, p.x, p.y);
    }
    ctx.setTransform(T);
  };

  /**
   * Deja fija la postura acomodada: mueve de verdad las líneas, el color y las marcas de cada parte
   * a donde la niña las dejó. Así el dibujo se ve acomodado en Marcar, Colorear y en la galería.
   * Devuelve true si cambió algo.
   */
  GM.hornear = function (d) {
    const hay = d.partes.some((p) => p.reposo && (p.reposo.r || p.reposo.dx || p.reposo.dy));
    if (!hay) { d.partes.forEach((p) => { if (p.reposo) p.reposo = null; }); return false; }
    const rig = GM.rig(d);
    const mats = GM.matricesRig(rig, 0, 'pose', GM.mat.id());
    const caja = GM.cajaPose(rig);
    const w = d.w, h = d.h, N = w * h, eff = rig.eff;
    const m = Math.round(Math.max(w, h) * 0.03);
    const X0 = Math.floor(caja.x0) - m, Y0 = Math.floor(caja.y0) - m;
    const W2 = Math.max(20, Math.ceil(caja.x1) + m - X0), H2 = Math.max(20, Math.ceil(caja.y1) + m - Y0);
    const tPx = d.tinta.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    const cPx = d.color.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;

    // Recortes de tinta, color y marca de cada etiqueta (0 = lo que no se mueve)
    const labs = [0].concat(rig.partes.map((p) => p.id));
    const cajas = new Map(labs.map((l) => [l, { x0: w, y0: h, x1: -1, y1: -1 }]));
    for (let p = 0; p < N; p++) {
      const l = cajas.has(eff[p]) ? eff[p] : 0;
      if (l === 0 && tPx[p * 4 + 3] === 0 && cPx[p * 4 + 3] === 0) continue;
      const c = cajas.get(l), x = p % w, y = (p - x) / w;
      if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
    }
    const capas = new Map();
    labs.forEach((l) => {
      const c = cajas.get(l);
      if (c.x1 < 0) return;
      const cw = c.x1 - c.x0 + 1, ch = c.y1 - c.y0 + 1;
      const t = new ImageData(cw, ch), co = new ImageData(cw, ch), mk = new ImageData(cw, ch);
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        const p = (y + c.y0) * w + (x + c.x0);
        if ((cajas.has(eff[p]) ? eff[p] : 0) !== l) continue;
        const o = (y * cw + x) * 4, s = p * 4;
        for (let k = 0; k < 4; k++) { t.data[o + k] = tPx[s + k]; co.data[o + k] = cPx[s + k]; }
        mk.data[o + 3] = 255;
      }
      const lienzo = (img) => { const k = GM.crearCanvas(cw, ch); k.getContext('2d').putImageData(img, 0, 0); return k; };
      capas.set(l, { x: c.x0, y: c.y0, t: lienzo(t), c: lienzo(co), m: lienzo(mk) });
    });

    const tinta = GM.crearCanvas(W2, H2), color = GM.crearCanvas(W2, H2);
    const tx = tinta.getContext('2d'), cx = color.getContext('2d');
    const marca = GM.crearCanvas(W2, H2), mx = marca.getContext('2d', { willReadFrequently: true });
    const etiquetas = new Uint8Array(W2 * H2);
    const fijar = (ctx, mm) => {
      let e = mm[4] - X0, f = mm[5] - Y0;
      if (Math.abs(mm[1]) < 1e-6 && Math.abs(mm[2]) < 1e-6 && Math.abs(mm[0] - 1) < 1e-6 && Math.abs(mm[3] - 1) < 1e-6) { e = Math.round(e); f = Math.round(f); }
      ctx.setTransform(mm[0], mm[1], mm[2], mm[3], e, f);
    };
    const base = capas.get(0);
    if (base) { cx.drawImage(base.c, base.x - X0, base.y - Y0); tx.drawImage(base.t, base.x - X0, base.y - Y0); }
    for (const p of rig.partes) {
      const k = capas.get(p.id), mm = mats.get(p.id);
      if (p.relleno) {
        const pm = p.padre !== null && mats.has(p.padre) ? mats.get(p.padre) : GM.mat.id();
        fijar(cx, pm); cx.drawImage(p.relleno.canvas, p.relleno.x, p.relleno.y);
        fijar(tx, pm); tx.globalCompositeOperation = 'destination-out'; tx.drawImage(p.relleno.canvas, p.relleno.x, p.relleno.y); tx.globalCompositeOperation = 'source-over';
      }
      if (!k) continue;
      fijar(cx, mm); cx.drawImage(k.c, k.x, k.y);
      fijar(tx, mm);
      tx.globalCompositeOperation = 'destination-out'; tx.drawImage(k.c, k.x, k.y);
      tx.globalCompositeOperation = 'source-over'; tx.drawImage(k.t, k.x, k.y);
      // marcas: la parte de más arriba se queda con el píxel
      mx.setTransform(1, 0, 0, 1, 0, 0); mx.clearRect(0, 0, W2, H2);
      mx.imageSmoothingEnabled = false;
      fijar(mx, mm); mx.drawImage(k.m, k.x, k.y);
      const md = mx.getImageData(0, 0, W2, H2).data;
      for (let q = 0; q < W2 * H2; q++) if (md[q * 4 + 3] > 127) etiquetas[q] = p.id;
    }
    // el clavito se va con su parte
    for (const p of rig.partes) {
      const q = GM.mat.aplicar(mats.get(p.id), p.pivote.x, p.pivote.y);
      p.datos.pivote = { x: q[0] - X0, y: q[1] - Y0 };
    }
    d.partes.forEach((p) => { p.reposo = null; });
    d.w = W2; d.h = H2; d.tinta = tinta; d.color = color; d.etiquetas = etiquetas;
    d.tintaVer = (d.tintaVer || 0) + 1; d.version = (d.version || 0) + 1;
    d._rig = null;
    return true;
  };

  /** Inversa de una matriz afín. */
  GM.mat.inversa = function (m) {
    const det = m[0] * m[3] - m[1] * m[2] || 1e-9;
    const a = m[3] / det, b = -m[1] / det, c = -m[2] / det, d = m[0] / det;
    return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
  };

  /** ¿Qué parte está bajo el dedo? Devuelve la de más arriba. */
  GM.parteEn = function (rig, mats, x, y, tol) {
    for (let k = rig.partes.length - 1; k >= 0; k--) {
      const p = rig.partes[k];
      const q = GM.mat.aplicar(GM.mat.inversa(mats.get(p.id)), x, y);
      const lx = Math.round(q[0] - p.x), ly = Math.round(q[1] - p.y);
      const cw = p.canvas.width, ch = p.canvas.height;
      if (lx < -tol || ly < -tol || lx >= cw + tol || ly >= ch + tol) continue;
      if (!p.alfa) {
        const dd = p.canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, cw, ch).data;
        p.alfa = new Uint8Array(cw * ch);
        for (let i = 0; i < cw * ch; i++) p.alfa[i] = dd[i * 4 + 3];
      }
      for (let dy = -tol; dy <= tol; dy += 2) for (let dx = -tol; dx <= tol; dx += 2) {
        const xx = lx + dx, yy = ly + dy;
        if (xx >= 0 && yy >= 0 && xx < cw && yy < ch && p.alfa[yy * cw + xx] > 40) return p;
      }
    }
    return null;
  };
})(window.GM);
