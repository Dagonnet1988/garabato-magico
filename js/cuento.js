/* Paso "Cuento": la niña escribe su historia. Cada oración es una escena.
   Palabras como salta, vuela, espada o duerme mueven al personaje; bosque, mar o noche cambian el fondo.
   Si nombra a alguien que todavía no tiene dibujo (mamá, perro, Lucía...), se le pide que lo dibuje. */
(function (GM) {
  'use strict';
  const $ = GM.$;
  const S = { escenas: [], i: 0, jugando: false, t0: 0, anim: 0, finEscena: 0, hablando: false, visible: false, cajas: [], arr: null, sel: null };

  /* ---------- lo que la niña eligió a mano en cada escena (movimiento y lugar de cada dibujo) ---------- */
  const claveEscena = (esc) => GM.normalizar(esc.texto).replace(/\s+/g, ' ').trim();
  function infoEscena(esc, crear) {
    const c = GM.app.cuentoActual();
    if (!c || !esc) return null;
    if (!c.escenaInfo) { if (!crear) return null; c.escenaInfo = {}; }
    const k = claveEscena(esc);
    if (!c.escenaInfo[k] && crear) c.escenaInfo[k] = {};
    return c.escenaInfo[k] || null;
  }
  /** Lugar de un dibujo en la escena i: el que se le puso aquí o en una escena anterior. */
  function posDe(i, id) {
    for (let j = i; j >= 0; j--) {
      const inf = infoEscena(S.escenas[j]);
      if (inf && inf.pos && inf.pos[id]) return inf.pos[id];
    }
    return null;
  }
  const guardarLuego = GM.debounce(() => GM.app.guardarCuento(), 500);
  let cv, ctx, W = 1200, H = 800, dpr = 1;

  const ACCION_RE = [
    ['dormir', /\b(duerm|dorm|descans|sueno|sonand|ronc)/],
    ['espada', /\b(espada|ataca|atac|pelea|pele|lucha|luch|golpe|corta|katana|entrena|practica)/],
    ['volar', /\b(vuel|vola|volo|volar|planea|despega)/],
    ['saltar', /\b(salt|brinc)/],
    ['correr', /\b(corr|huy|escap|persig)/],
    ['bailar', /\b(bail|danz)/],
    ['caminar', /\b(camin|anda|pase|viaj|llega|lleg|va |fue |iba )/],
    ['mirar', /\b(mir|observ|busc|vio |ve )/],
    ['hablar', /\b(dic|dij|habl|grit|cant|pregunt|respond|llam)/],
    ['triste', /\b(trist|llor|mied|asust)/],
    ['feliz', /\b(feliz|felic|rie|alegr|content|celebr|jueg|jug|ama |abraz)/],
  ];
  const LUGAR_RE = [
    ['espacio', /\b(espacio|planeta|astronaut|marte|galaxia)/],
    ['noche', /\b(noche|luna|estrella|oscur)/],
    ['nieve', /\b(nieve|nevad|hielo|helad|invierno|pinguino|iglu)/],
    ['desierto', /\b(desierto|arena|cactus|camello|duna)/],
    ['rio', /\b(rio|rios|lago|arroyo|cascada|charco)\b/],
    ['mar', /\b(mar|playa|ola|olas|oceano|nada|nado|barco)\b/],
    ['bosque', /\b(bosque|arbol|arboles|selva|jungla)/],
    ['cielo', /\b(cielo|nube|nubes)/],
    ['casa', /\b(casa|cuarto|cocina|escuela|cama)/],
    ['ciudad', /\b(ciudad|calle|edificio|parque|tienda|pueblo)/],
    ['montana', /\b(montan|cueva|volcan|cerro)/],
  ];
  GM.LUGARES = [
    { id: 'campo', nombre: 'Campo', emoji: '🌼' }, { id: 'bosque', nombre: 'Bosque', emoji: '🌳' },
    { id: 'rio', nombre: 'Río', emoji: '🏞️' }, { id: 'mar', nombre: 'Mar', emoji: '🌊' },
    { id: 'montana', nombre: 'Montañas', emoji: '⛰️' }, { id: 'cielo', nombre: 'Cielo', emoji: '☁️' },
    { id: 'noche', nombre: 'Noche', emoji: '🌙' }, { id: 'casa', nombre: 'Casa', emoji: '🏠' },
    { id: 'ciudad', nombre: 'Ciudad', emoji: '🏙️' }, { id: 'desierto', nombre: 'Desierto', emoji: '🏜️' },
    { id: 'nieve', nombre: 'Nieve', emoji: '❄️' }, { id: 'espacio', nombre: 'Espacio', emoji: '🪐' },
  ];
  // Personajes y cosas que, si aparecen en el cuento, se le pide dibujar
  const LEXICO = ['mamá', 'papá', 'hermano', 'hermana', 'abuela', 'abuelo', 'amigo', 'amiga', 'perro', 'perrito', 'gato', 'gatito', 'dragón',
    'princesa', 'príncipe', 'rey', 'reina', 'bruja', 'mago', 'monstruo', 'pájaro', 'loro', 'pez', 'conejo', 'oso', 'león', 'tigre', 'mono',
    'caballo', 'unicornio', 'hada', 'robot', 'maestra', 'maestro', 'bebé', 'ratón', 'vaca', 'pollito', 'tortuga', 'mariposa', 'pato',
    'árbol', 'nido', 'castillo', 'barco', 'cohete', 'flor', 'pastel', 'tesoro', 'jaula', 'carro', 'avión', 'tren', 'bicicleta',
    'pelota', 'globo', 'cometa', 'muñeca', 'juguete', 'nave', 'puente', 'casita', 'corona', 'varita', 'escoba', 'sombrilla', 'llave',
    'caja', 'cofre', 'regalo', 'serpiente', 'araña', 'abeja', 'rana', 'búho', 'águila', 'gallina', 'cerdo', 'oveja', 'jirafa',
    'elefante', 'cocodrilo', 'tiburón', 'ballena', 'delfín', 'pulpo', 'pingüino', 'dinosaurio', 'zorro', 'lobo', 'ardilla', 'fantasma',
    'pirata', 'ninja', 'superhéroe', 'sirena', 'duende', 'gigante', 'tía', 'tío', 'prima', 'primo'];
  const NO_NOMBRES = new Set(['un', 'una', 'el', 'la', 'los', 'las', 'despues', 'luego', 'entonces', 'cuando', 'y', 'pero', 'fin', 'en', 'de', 'con', 'por', 'al', 'del', 'su', 'sus', 'mi', 'tu', 'yo', 'el', 'ella', 'ellos', 'hola', 'adios', 'si', 'no']);

  function tokensNombre(n) { return GM.normalizar(n).split(/[^a-z0-9]+/).filter((t) => t.length >= 3); }

  function dibujoMencionado(d, norm) {
    const n = GM.normalizar(d.nombre).trim();
    if (n && norm.includes(n)) return true;
    return tokensNombre(d.nombre).some((t) => t.length >= 4 && new RegExp('\\b' + t + 's?\\b').test(norm));
  }

  function analizar(texto, dibujos) {
    const frases = (texto || '').match(/[^.!?\n]+[.!?]*/g) || [];
    let lugar = 'campo';
    const out = [];
    const faltan = new Map();
    for (const f0 of frases) {
      const f = f0.trim();
      if (f.replace(/[^\p{L}]/gu, '').length < 2) continue;
      const norm = ' ' + GM.normalizar(f) + ' ';
      let accion = 'quieto';
      for (const [a, re] of ACCION_RE) if (re.test(norm)) { accion = a; break; }
      let propio = false;
      for (const [l, re] of LUGAR_RE) if (re.test(norm)) { lugar = l; propio = true; break; }
      const esc = { texto: f, accion, lugar: accion === 'volar' && lugar === 'campo' ? 'cielo' : lugar, lugarBase: lugar, propio, ids: [] };
      dibujos.forEach((d) => { if (dibujoMencionado(d, norm)) esc.ids.push(d.id); });
      // ¿Falta dibujar a alguien?
      for (const palabra of LEXICO) {
        const p = GM.normalizar(palabra);
        if (!new RegExp('\\b' + p + '(s|es)?\\b').test(norm)) continue;
        const tiene = dibujos.some((d) => GM.normalizar(d.nombre).includes(p));
        if (!tiene) faltan.set(p, palabra.charAt(0).toUpperCase() + palabra.slice(1));
      }
      const palabras = f.split(/\s+/);
      palabras.forEach((w, idx) => {
        const limpio = w.replace(/[^\p{L}]/gu, '');
        if (idx === 0 || limpio.length < 3 || limpio[0] !== limpio[0].toUpperCase() || limpio[0] === limpio[0].toLowerCase()) return;
        const n = GM.normalizar(limpio);
        if (NO_NOMBRES.has(n)) return;
        if (dibujos.some((d) => tokensNombre(d.nombre).includes(n))) return;
        faltan.set(n, limpio);
      });
      out.push(esc);
    }
    return { escenas: out, faltan: Array.from(faltan.values()) };
  }

  /* ---------- fondos ---------- */
  function nubes(t, color) {
    ctx.fillStyle = color;
    for (let i = 0; i < 3; i++) {
      const x = ((t * 18 + i * 430) % (W + 300)) - 150, y = 90 + i * 55;
      [[0, 0, 70, 26], [45, -16, 46, 26], [-40, -8, 40, 20]].forEach(([ox, oy, rx, ry]) => {
        ctx.beginPath(); ctx.ellipse(x + ox, y + oy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      });
    }
  }
  function arbol(x, y, s, c) {
    ctx.fillStyle = '#7a5434'; ctx.fillRect(x - 10 * s, y - 90 * s, 20 * s, 90 * s);
    ctx.fillStyle = c;
    [[0, -120, 55], [-40, -95, 40], [40, -95, 40]].forEach(([ox, oy, r]) => {
      ctx.beginPath(); ctx.arc(x + ox * s, y + oy * s, r * s, 0, Math.PI * 2); ctx.fill();
    });
  }
  function fondo(lugar, t) {
    const suelo = H * 0.8;
    const g = ctx.createLinearGradient(0, 0, 0, suelo);
    const cielos = { noche: ['#0d1b3d', '#2a3f7a'], mar: ['#7cc6f2', '#cdeefe'], bosque: ['#a8dcf5', '#e2f5ff'], cielo: ['#5fb0ef', '#cfe9ff'],
      casa: ['#f6e2c4', '#fbefdc'], montana: ['#9fd0f0', '#e6f4ff'], campo: ['#8fd0f7', '#e4f5ff'], rio: ['#8fd0f7', '#e4f5ff'],
      desierto: ['#f7b267', '#fde4b8'], nieve: ['#b9d7ee', '#eef6fc'], ciudad: ['#9cc9ee', '#e8f3ff'], espacio: ['#05060f', '#1b1f45'] };
    const [c1, c2] = cielos[lugar] || cielos.campo;
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const circulo = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
    if (lugar === 'espacio') {
      for (let i = 0; i < 70; i++) {
        const x = (i * 613) % W, y = (i * 271) % (H * 0.85), a = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + i));
        ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(2) + ')'; ctx.fillRect(x, y, 3, 3);
      }
      circulo(W * 0.8, H * 0.22, 70, '#e07a5f');
      ctx.strokeStyle = '#f2cc8f'; ctx.lineWidth = 8; ctx.beginPath(); ctx.ellipse(W * 0.8, H * 0.22, 120, 26, -0.3, 0, Math.PI * 2); ctx.stroke();
      circulo(W * 0.15, H * 0.15, 26, '#81b29a');
      ctx.fillStyle = '#8d8fa3'; ctx.fillRect(0, suelo, W, H - suelo);
      [[0.2, 0.86, 40], [0.55, 0.92, 26], [0.85, 0.88, 34]].forEach(([x, y, r]) => { ctx.fillStyle = '#6f7186'; ctx.beginPath(); ctx.ellipse(W * x, H * y, r, r * 0.35, 0, 0, Math.PI * 2); ctx.fill(); });
      return suelo;
    }
    if (lugar === 'nieve') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(0, suelo); ctx.lineTo(W * 0.3, suelo * 0.45); ctx.lineTo(W * 0.62, suelo); ctx.fill();
      ctx.beginPath(); ctx.moveTo(W * 0.4, suelo); ctx.lineTo(W * 0.78, suelo * 0.35); ctx.lineTo(W * 1.1, suelo); ctx.fill();
      [[0.1, 1], [0.9, 1.2]].forEach(([x, s]) => {
        const px = W * x;
        ctx.fillStyle = '#2f6b4f';
        for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(px, suelo - (150 - k * 40) * s); ctx.lineTo(px - (50 + k * 12) * s, suelo - (70 - k * 30) * s); ctx.lineTo(px + (50 + k * 12) * s, suelo - (70 - k * 30) * s); ctx.fill(); }
      });
      ctx.fillStyle = '#f4f8fc'; ctx.fillRect(0, suelo, W, H - suelo);
      for (let i = 0; i < 60; i++) {
        const x = ((i * 131 + t * 25 * (1 + (i % 3))) % W), y = ((i * 197 + t * 60 * (1 + (i % 2))) % H);
        circulo(x, y, 2 + (i % 3), 'rgba(255,255,255,.9)');
      }
      return suelo;
    }
    if (lugar === 'desierto') {
      circulo(W - 150, 110, 60, '#fff3b0');
      ctx.fillStyle = '#e9c46a';
      ctx.beginPath(); ctx.moveTo(0, suelo); ctx.quadraticCurveTo(W * 0.25, suelo * 0.7, W * 0.55, suelo); ctx.fill();
      ctx.beginPath(); ctx.moveTo(W * 0.4, suelo); ctx.quadraticCurveTo(W * 0.75, suelo * 0.75, W * 1.05, suelo); ctx.fill();
      ctx.fillStyle = '#f2d08b'; ctx.fillRect(0, suelo, W, H - suelo);
      [[0.12, 1], [0.86, 1.3]].forEach(([x, s]) => {
        const px = W * x;
        ctx.fillStyle = '#3a8a4f';
        ctx.fillRect(px - 14 * s, suelo - 130 * s, 28 * s, 130 * s);
        ctx.fillRect(px - 48 * s, suelo - 95 * s, 16 * s, 45 * s); ctx.fillRect(px - 48 * s, suelo - 60 * s, 40 * s, 14 * s);
        ctx.fillRect(px + 32 * s, suelo - 110 * s, 16 * s, 45 * s); ctx.fillRect(px + 10 * s, suelo - 75 * s, 38 * s, 14 * s);
      });
      return suelo;
    }
    if (lugar === 'ciudad') {
      nubes(t, 'rgba(255,255,255,.85)');
      const edificios = [[0, 0.32, '#8e9aaf'], [0.13, 0.5, '#6c7a96'], [0.27, 0.38, '#a3b1c6'], [0.42, 0.58, '#5d6b87'], [0.58, 0.42, '#8e9aaf'], [0.72, 0.52, '#6c7a96'], [0.86, 0.36, '#a3b1c6']];
      edificios.forEach(([x, alto, c]) => {
        const bx = W * x, bw = W * 0.13, top = suelo - suelo * alto;
        ctx.fillStyle = c; ctx.fillRect(bx, top, bw, suelo - top);
        ctx.fillStyle = '#ffe08a';
        for (let yy = top + 18; yy < suelo - 30; yy += 38) for (let xx = bx + 14; xx < bx + bw - 20; xx += 34) ctx.fillRect(xx, yy, 16, 20);
      });
      ctx.fillStyle = '#5a5f6b'; ctx.fillRect(0, suelo, W, H - suelo);
      ctx.fillStyle = '#f5f5f5'; for (let x = 20; x < W; x += 120) ctx.fillRect(x, suelo + (H - suelo) / 2 - 5, 60, 10);
      return suelo;
    }
    if (lugar === 'rio') {
      circulo(130, 110, 50, '#ffd54a');
      nubes(t, 'rgba(255,255,255,.9)');
      ctx.fillStyle = '#7f8fa8';
      ctx.beginPath(); ctx.moveTo(W * 0.3, suelo * 0.75); ctx.lineTo(W * 0.5, suelo * 0.45); ctx.lineTo(W * 0.72, suelo * 0.75); ctx.fill();
      ctx.fillStyle = '#6cbf5a'; ctx.fillRect(0, suelo * 0.75, W, H - suelo * 0.75);
      // el río baja serpenteando desde la montaña
      ctx.fillStyle = '#3d9be0';
      ctx.beginPath();
      ctx.moveTo(W * 0.47, suelo * 0.75); ctx.lineTo(W * 0.53, suelo * 0.75);
      ctx.bezierCurveTo(W * 0.62, suelo * 0.88, W * 0.3, H * 0.9, W * 0.42, H);
      ctx.lineTo(W * 0.68, H);
      ctx.bezierCurveTo(W * 0.5, H * 0.9, W * 0.75, suelo * 0.88, W * 0.53, suelo * 0.75);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 4;
      for (let i = 0; i < 4; i++) { const yy = suelo * 0.85 + i * 40, xx = W * 0.5 + Math.sin(t * 2 + i) * 20; ctx.beginPath(); ctx.moveTo(xx - 20, yy); ctx.lineTo(xx + 20, yy); ctx.stroke(); }
      return suelo;
    }
    if (lugar === 'noche') {
      ctx.fillStyle = '#fff8d0';
      ctx.beginPath(); ctx.arc(W - 160, 120, 46, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0d1b3d'; ctx.beginPath(); ctx.arc(W - 140, 108, 42, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 40; i++) {
        const x = (i * 977) % W, y = (i * 331) % (suelo * 0.7), a = 0.5 + 0.5 * Math.sin(t * 2 + i);
        ctx.fillStyle = 'rgba(255,255,230,' + a.toFixed(2) + ')'; ctx.fillRect(x, y, 3, 3);
      }
      ctx.fillStyle = '#1f3a2c'; ctx.fillRect(0, suelo, W, H - suelo);
      return suelo;
    }
    if (lugar === 'casa') {
      ctx.fillStyle = '#e9cfa6'; for (let x = 0; x < W; x += 60) ctx.fillRect(x, 0, 4, suelo);
      ctx.fillStyle = '#9fd3f5'; ctx.fillRect(W * 0.66, 90, 220, 170);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 10; ctx.strokeRect(W * 0.66, 90, 220, 170);
      ctx.beginPath(); ctx.moveTo(W * 0.66 + 110, 90); ctx.lineTo(W * 0.66 + 110, 260); ctx.stroke();
      ctx.fillStyle = '#b07a4a'; ctx.fillRect(0, suelo, W, H - suelo);
      return suelo;
    }
    ctx.fillStyle = '#ffd54a';
    ctx.beginPath(); ctx.arc(130, 110, 50, 0, Math.PI * 2); ctx.fill();
    nubes(t, 'rgba(255,255,255,.9)');
    if (lugar === 'montana') {
      ctx.fillStyle = '#7f8fa8';
      ctx.beginPath(); ctx.moveTo(0, suelo); ctx.lineTo(W * 0.25, suelo * 0.35); ctx.lineTo(W * 0.5, suelo); ctx.fill();
      ctx.beginPath(); ctx.moveTo(W * 0.35, suelo); ctx.lineTo(W * 0.7, suelo * 0.25); ctx.lineTo(W * 1.05, suelo); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(W * 0.7, suelo * 0.25); ctx.lineTo(W * 0.64, suelo * 0.38); ctx.lineTo(W * 0.76, suelo * 0.38); ctx.fill();
    }
    if (lugar === 'mar') {
      ctx.fillStyle = '#f2d9a0'; ctx.fillRect(0, suelo, W, H - suelo);
      ctx.fillStyle = '#2b8bd6'; ctx.fillRect(0, suelo - 70, W, 70);
      ctx.strokeStyle = '#d8f1ff'; ctx.lineWidth = 5;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 10) ctx.lineTo(x, suelo - 70 + Math.sin(x / 40 + t * 2) * 6);
      ctx.stroke();
      return suelo;
    }
    if (lugar === 'cielo') {
      nubes(t * 2 + 200, 'rgba(255,255,255,.75)');
      ctx.fillStyle = '#7cc56b'; ctx.fillRect(0, H * 0.92, W, H * 0.08);
      return suelo;
    }
    if (lugar === 'bosque') {
      [[0.08, 1.1, '#2f8f46'], [0.9, 1.25, '#3b9c52'], [0.75, 0.8, '#4daa5e'], [0.22, 0.75, '#4daa5e']].forEach(([x, s, c]) => arbol(W * x, suelo, s, c));
    }
    ctx.fillStyle = lugar === 'bosque' ? '#4c9a3f' : '#6cbf5a';
    ctx.fillRect(0, suelo, W, H - suelo);
    return suelo;
  }

  /* ---------- escena ---------- */
  function texto(t) {
    const pad = 22, maxW = W - 120;
    ctx.font = '600 34px Fredoka, "Trebuchet MS", sans-serif';
    const palabras = t.split(/\s+/), lineas = [];
    let l = '';
    for (const p of palabras) {
      const prueba = l ? l + ' ' + p : p;
      if (ctx.measureText(prueba).width > maxW && l) { lineas.push(l); l = p; } else l = prueba;
    }
    if (l) lineas.push(l);
    const alto = lineas.length * 44 + pad * 2;
    let ancho = 0; lineas.forEach((x) => { ancho = Math.max(ancho, ctx.measureText(x).width); });
    const x0 = (W - ancho) / 2 - pad;
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x0, 20, ancho + pad * 2, alto, 22); else ctx.rect(x0, 20, ancho + pad * 2, alto);
    ctx.fill();
    ctx.fillStyle = '#1d2340'; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
    lineas.forEach((x, i) => ctx.fillText(x, W / 2, 20 + pad + i * 44));
    ctx.textAlign = 'start';
  }

  function personajesDe(esc) {
    const todos = GM.app.dibujosCuento();
    const prota = todos.find((d) => d.id === S.protagonista) || todos[0];
    const ids = [];
    if (prota) ids.push(prota.id);
    esc.ids.forEach((id) => { if (!ids.includes(id)) ids.push(id); });
    return ids.map((id) => todos.find((d) => d.id === id)).filter(Boolean).slice(0, 4);
  }

  function pintar() {
    const esc = S.escenas[S.i] || { texto: 'Escribe tu cuento a la derecha.', accion: 'quieto', lugar: 'campo', ids: [] };
    const t = (performance.now() - S.t0) / 1000;
    ctx.setTransform(dpr * cv.width / (W * dpr), 0, 0, dpr * cv.height / (H * dpr), 0, 0);
    const suelo = fondo(esc.lugar, t);
    const ds = personajesDe(esc);
    const n = ds.length;
    S.cajas = [];
    ds.forEach((d, k) => {
      const rig = GM.rig(d);
      const caja = GM.cajaPose(rig);
      const bh = caja.y1 - caja.y0 || 1, bw = caja.x1 - caja.x0 || 1;
      const alto = H * (n > 2 ? 0.42 : 0.52);
      let s = Math.min(alto / bh, (W / Math.max(n, 1.6)) * 0.8 / bw);
      let cx = n === 1 ? W * 0.5 : W * (0.25 + (0.5 * k) / (n - 1));
      let pie = suelo + 10;
      const pos = posDe(S.i, d.id);
      if (pos) { cx = pos.x * W; pie = pos.y * H; s *= pos.e || 1; }
      S.cajas.push({ id: d.id, nombre: d.nombre, x0: cx - bw * s / 2, x1: cx + bw * s / 2, y0: pie - bh * s, y1: pie, cx, pie });
      const acc = k === 0 ? esc.accion : (esc.accion === 'dormir' ? 'dormir' : esc.ids.includes(d.id) ? esc.accion : 'feliz');
      ctx.save();
      ctx.translate(cx - caja.pie.x * s, pie - caja.pie.y * s);
      ctx.scale(s, s);
      // sombra
      ctx.fillStyle = 'rgba(0,0,0,.12)';
      ctx.beginPath(); ctx.ellipse(caja.pie.x, caja.pie.y, bw * 0.35, bh * 0.04, 0, 0, Math.PI * 2); ctx.fill();
      if (esc.lugar === 'noche' || esc.lugar === 'espacio') { ctx.shadowColor = 'rgba(255,255,240,.85)'; ctx.shadowBlur = 10; }
      GM.dibujarRig(ctx, rig, t + k * 0.7, acc, { raiz: GM.raiz(rig, t + k * 0.7, acc, W / s * 0.5) });
      ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
      if (acc === 'dormir') {
        ctx.fillStyle = esc.lugar === 'noche' || esc.lugar === 'espacio' ? '#ffffff' : '#3b4a8a'; ctx.font = '700 ' + Math.round(60 / s * 0.6) + 'px Fredoka, sans-serif';
        const z = (t % 2) / 2;
        ctx.globalAlpha = 1 - z;
        ctx.fillText('Z z z', caja.x1, caja.y0 - z * 80 / s);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      if (S.sel === d.id) {
        ctx.save();
        ctx.setLineDash([12, 10]); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,.95)';
        ctx.strokeRect(cx - bw * s / 2 - 8, pie - bh * s - 8, bw * s + 16, bh * s + 16);
        ctx.restore();
      }
    });
    texto(esc.texto);
    pintarTamano();
  }

  function bucle() {
    if (!S.visible) return;
    pintar();
    if (S.jugando && !S.hablando && performance.now() > S.finEscena) siguiente(true);
    S.anim = requestAnimationFrame(bucle);
  }

  function redimensionar() {
    const r = cv.parentElement.getBoundingClientRect();
    if (r.width < 2) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    H = 800; W = Math.round(H * (r.width / r.height));
  }

  /* ---------- reproducción ---------- */
  function vozEs() {
    try {
      const vs = speechSynthesis.getVoices();
      return vs.find((v) => /^es[-_](MX|US|419|CO)/i.test(v.lang)) || vs.find((v) => /^es/i.test(v.lang)) || null;
    } catch (e) { return null; }
  }

  function leer(t) {
    S.hablando = false;
    if (!$('#cu-voz').checked || !('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(t);
      const v = vozEs();
      if (v) u.voice = v;
      u.lang = v ? v.lang : 'es-ES';
      u.rate = 0.92;
      u.onend = () => { S.hablando = false; S.finEscena = performance.now() + 900; };
      u.onerror = () => { S.hablando = false; };
      S.hablando = true;
      speechSynthesis.speak(u);
    } catch (e) { S.hablando = false; }
  }

  function irA(i, auto) {
    S.i = Math.max(0, Math.min(S.escenas.length - 1, i));
    S.t0 = performance.now();
    const esc = S.escenas[S.i];
    S.finEscena = performance.now() + Math.max(3500, (esc ? esc.texto.split(/\s+/).length : 4) * 520);
    if (S.jugando && esc) leer(esc.texto);
    GM.$$('#cu-escenas li').forEach((li, k) => li.classList.toggle('activa', k === S.i));
    $('#cu-contador').textContent = 'Escena ' + (S.escenas.length ? S.i + 1 : 0) + ' de ' + S.escenas.length;
    if (!auto) { /* nada más */ }
  }

  function siguiente(auto) {
    if (S.i >= S.escenas.length - 1) { if (auto) parar(); return; }
    irA(S.i + 1, auto);
  }

  function jugar() {
    if (!S.escenas.length) { GM.aviso('Primero escribe tu cuento'); return; }
    S.jugando = true;
    $('#cu-play').textContent = '❚❚';
    $('#cu-play').setAttribute('aria-label', 'Pausar');
    irA(S.i >= S.escenas.length - 1 ? 0 : S.i);
  }

  function parar() {
    S.jugando = false; S.hablando = false;
    try { speechSynthesis.cancel(); } catch (e) { /* nada */ }
    $('#cu-play').textContent = '▶';
    $('#cu-play').setAttribute('aria-label', 'Reproducir');
  }

  /* ---------- panel ---------- */
  function actualizar() {
    const dibujos = GM.app.dibujosCuento();
    const r = analizar($('#cu-texto').value, dibujos);
    S.escenas = r.escenas;
    let lugarActual = null;
    S.escenas.forEach((e) => {
      e.auto = e.accion;
      const inf = infoEscena(e);
      if (inf && inf.accion) { e.accion = inf.accion; e.manual = true; }
      // el lugar elegido a mano sigue en las escenas siguientes, hasta que el cuento nombre otro
      e.lugarAuto = e.lugar;
      if (inf && inf.lugar) { e.lugar = inf.lugar; e.lugarManual = true; lugarActual = inf.lugar; }
      else if (e.propio) lugarActual = null;
      else if (lugarActual) e.lugar = lugarActual;
    });
    const ol = $('#cu-escenas');
    ol.textContent = '';
    r.escenas.forEach((e, k) => {
      const li = document.createElement('li');
      const div = document.createElement('div');
      div.textContent = e.texto;
      const chips = document.createElement('div');
      chips.className = 'chips';
      const a = GM.ACCIONES.find((x) => x.id === e.accion);
      const mov = document.createElement('button');
      mov.className = 'chip cambiar' + (e.manual ? ' manual' : '');
      mov.textContent = (a ? a.emoji + ' ' + a.nombre : '🧍 Quieto') + ' ▾';
      mov.setAttribute('aria-label', 'Cambiar el movimiento de esta escena');
      mov.addEventListener('click', (ev) => { ev.stopPropagation(); irA(k); elegirMovimiento(k); });
      chips.appendChild(mov);
      const lg = GM.LUGARES.find((x) => x.id === e.lugar) || GM.LUGARES[0];
      const lu = document.createElement('button');
      lu.className = 'chip cambiar' + (e.lugarManual ? ' manual' : '');
      lu.textContent = lg.emoji + ' ' + lg.nombre + ' ▾';
      lu.setAttribute('aria-label', 'Cambiar el lugar de esta escena');
      lu.addEventListener('click', (ev) => { ev.stopPropagation(); irA(k); elegirLugar(k); });
      chips.appendChild(lu);
      div.appendChild(chips);
      li.appendChild(div);
      li.addEventListener('click', () => irA(k));
      ol.appendChild(li);
    });
    const box = $('#cu-faltan');
    box.textContent = '';
    r.faltan.forEach((nombre) => {
      const row = document.createElement('div');
      row.className = 'falta';
      const t = document.createElement('span'); t.className = 't'; t.textContent = '✏️ ' + nombre;
      row.appendChild(t);
      // ¿ya lo dibujó para otro cuento?
      const n = GM.normalizar(nombre);
      const ya = GM.app.dibujos().find((d) => GM.normalizar(d.nombre).includes(n) || tokensNombre(d.nombre).includes(n));
      if (ya) {
        const u = document.createElement('button'); u.className = 'btn primario'; u.textContent = 'Usar mi dibujo de ' + ya.nombre;
        u.addEventListener('click', () => { GM.app.agregarAlCuento(ya); llenarProtagonistas(); actualizar(); });
        row.appendChild(u);
      }
      const b = document.createElement('button'); b.className = 'btn' + (ya ? '' : ' primario'); b.textContent = 'Dibujar y tomar foto';
      b.addEventListener('click', () => GM.app.nuevoDibujo(nombre, 'cuento'));
      row.appendChild(b);
      box.appendChild(row);
    });
    $('#cu-faltan-sec').hidden = !r.faltan.length;
    if (S.i >= S.escenas.length) S.i = 0;
    irA(S.i);
    const c = GM.app.cuentoActual();
    const texto = $('#cu-texto').value, titulo = $('#cu-titulo').value.trim();
    if (c && (texto !== (c.texto || '') || S.protagonista !== c.protagonista || (titulo && titulo !== c.titulo))) {
      c.texto = texto; c.protagonista = S.protagonista;
      if (titulo) c.titulo = titulo;
      GM.app.guardarCuento(c);
    }
  }

  /** Muestra el texto del cuento elegido. */
  function cargar() {
    const c = GM.app.cuentoActual();
    S.de = c;
    $('#cu-titulo').value = c ? c.titulo : '';
    $('#cu-texto').value = c ? c.texto || '' : '';
    S.protagonista = c ? c.protagonista : null;
    S.i = 0;
  }

  /** Elegir a mano el lugar (fondo) de una escena. */
  function elegirLugar(k) {
    const esc = S.escenas[k];
    if (!esc) return;
    const box = $('#ml-lista');
    box.textContent = '';
    const auto = GM.LUGARES.find((x) => x.id === esc.lugarAuto);
    [{ id: null, emoji: '✨', nombre: 'Lo que dice el cuento' + (auto ? ' (' + auto.nombre + ')' : '') }].concat(GM.LUGARES).forEach((o) => {
      const b = document.createElement('button');
      b.className = 'accion';
      b.setAttribute('aria-pressed', String(o.id === null ? !esc.lugarManual : esc.lugarManual && esc.lugar === o.id));
      b.innerHTML = '<span></span>';
      b.querySelector('span').textContent = o.emoji;
      b.appendChild(document.createTextNode(o.nombre));
      b.addEventListener('click', () => {
        const inf = infoEscena(esc, true);
        if (o.id) inf.lugar = o.id; else delete inf.lugar;
        $('#modal-lugar').hidden = true;
        GM.app.guardarCuento();
        actualizar();
      });
      box.appendChild(b);
    });
    $('#ml-escena').textContent = '«' + esc.texto + '»';
    $('#modal-lugar').hidden = false;
  }

  /** Elegir a mano el movimiento de una escena. */
  function elegirMovimiento(k) {
    const esc = S.escenas[k];
    if (!esc) return;
    const box = $('#ma-lista');
    box.textContent = '';
    const auto = GM.ACCIONES.find((x) => x.id === esc.auto);
    const ops = [{ id: null, emoji: '✨', nombre: 'Lo que dice el cuento' + (auto ? ' (' + auto.nombre + ')' : '') }].concat(GM.ACCIONES);
    ops.forEach((o) => {
      const b = document.createElement('button');
      b.className = 'accion';
      b.setAttribute('aria-pressed', String(o.id === null ? !esc.manual : esc.manual && esc.accion === o.id));
      b.innerHTML = '<span></span>';
      b.querySelector('span').textContent = o.emoji;
      b.appendChild(document.createTextNode(o.nombre));
      b.addEventListener('click', () => {
        const inf = infoEscena(esc, true);
        if (o.id) inf.accion = o.id; else delete inf.accion;
        $('#modal-accion').hidden = true;
        GM.app.guardarCuento();
        actualizar();
      });
      box.appendChild(b);
    });
    $('#ma-escena').textContent = '«' + esc.texto + '»';
    $('#modal-accion').hidden = false;
  }

  /* ---------- mover los dibujos en la escena con el dedo ---------- */
  function aEscena(ev) {
    const r = cv.getBoundingClientRect();
    return { x: (ev.clientX - r.left) * (W / r.width), y: (ev.clientY - r.top) * (H / r.height) };
  }
  /** El dibujo al que se le cambia el tamaño: el que se tocó, o el protagonista. */
  const elegido = () => (S.cajas.find((x) => x.id === S.sel) || S.cajas[0] || null);
  function pintarTamano() {
    const c = elegido();
    const firma = c ? c.id + c.nombre : '';
    if (firma === S.firmaTam) return;
    S.firmaTam = firma;
    $('#cu-tam').hidden = !c;
    if (c) $('#cu-tam-n').textContent = c.nombre;
  }
  function ponerPos(id, cambio) {
    const esc = S.escenas[S.i];
    const c = S.cajas.find((x) => x.id === id);
    if (!esc || !c) return;
    const inf = infoEscena(esc, true);
    inf.pos = inf.pos || {};
    const antes = posDe(S.i, id) || { x: c.cx / W, y: c.pie / H, e: 1 };
    inf.pos[id] = Object.assign({ x: antes.x, y: antes.y, e: antes.e || 1 }, cambio);
    guardarLuego();
  }
  function tocarEscena(ev) {
    const pt = aEscena(ev);
    let hit = null;
    for (let k = S.cajas.length - 1; k >= 0; k--) {
      const c = S.cajas[k], m = 20;
      if (pt.x >= c.x0 - m && pt.x <= c.x1 + m && pt.y >= c.y0 - m && pt.y <= c.y1 + m) { hit = c; break; }
    }
    S.sel = hit ? hit.id : null;
    pintarTamano();
    if (!hit) return;
    ev.preventDefault();
    try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* nada */ }
    S.arr = { id: hit.id, pid: ev.pointerId, dx: pt.x - hit.cx, dy: pt.y - hit.pie };
  }
  function arrastrarEscena(ev) {
    if (!S.arr || ev.pointerId !== S.arr.pid) return;
    const pt = aEscena(ev);
    const x = Math.max(0.02, Math.min(0.98, (pt.x - S.arr.dx) / W));
    const y = Math.max(0.12, Math.min(1.1, (pt.y - S.arr.dy) / H));
    ponerPos(S.arr.id, { x, y });
  }
  function soltarEscena(ev) { if (S.arr && ev.pointerId === S.arr.pid) S.arr = null; }

  function llenarProtagonistas() {
    const sel = $('#cu-protagonista');
    const dibujos = GM.app.dibujosCuento();
    sel.textContent = '';
    dibujos.forEach((d) => {
      const o = document.createElement('option'); o.value = d.id; o.textContent = d.nombre; sel.appendChild(o);
    });
    if (!dibujos.some((d) => d.id === S.protagonista)) S.protagonista = GM.app.actual() ? GM.app.actual().id : (dibujos[0] || {}).id;
    sel.value = S.protagonista || '';
  }

  GM.cuento = {
    init() {
      cv = $('#cv-cuento'); ctx = cv.getContext('2d');
      new ResizeObserver(redimensionar).observe(cv.parentElement);
      $('#cu-texto').addEventListener('input', GM.debounce(actualizar, 400));
      cv.addEventListener('pointerdown', tocarEscena);
      cv.addEventListener('pointermove', arrastrarEscena);
      cv.addEventListener('pointerup', soltarEscena);
      cv.addEventListener('pointercancel', soltarEscena);
      const tam = (f) => { const c = elegido(); if (!c) return; const p = posDe(S.i, c.id); ponerPos(c.id, { e: Math.max(0.25, Math.min(3, ((p && p.e) || 1) * f)) }); };
      $('#cu-tam-mas').addEventListener('click', () => tam(1.2));
      $('#cu-tam-menos').addEventListener('click', () => tam(1 / 1.2));
      // con el mouse, la rueda encima de la escena también cambia el tamaño
      cv.addEventListener('wheel', (e) => { e.preventDefault(); tam(e.deltaY < 0 ? 1.08 : 1 / 1.08); }, { passive: false });
      $('#cu-tam-volver').addEventListener('click', () => {
        const el = elegido(), c = GM.app.cuentoActual();
        if (el && c && c.escenaInfo) Object.values(c.escenaInfo).forEach((inf) => { if (inf.pos) delete inf.pos[el.id]; });
        guardarLuego();
      });
      $('#ml-cerrar').addEventListener('click', () => { $('#modal-lugar').hidden = true; });
      $('#ma-cerrar').addEventListener('click', () => { $('#modal-accion').hidden = true; });
      $('#cu-titulo').addEventListener('input', GM.debounce(actualizar, 400));
      $('#cu-protagonista').addEventListener('change', (e) => { S.protagonista = e.target.value; actualizar(); });
      $('#cu-play').addEventListener('click', () => (S.jugando ? parar() : jugar()));
      $('#cu-sig').addEventListener('click', () => siguiente(false));
      $('#cu-ant').addEventListener('click', () => irA(S.i - 1));
      try { speechSynthesis.getVoices(); } catch (e) { /* nada */ }
    },
    abrir() {
      S.visible = true;
      // si vuelve al mismo cuento y no cambió en otro equipo, se queda donde estaba
      const c = GM.app.cuentoActual();
      if (S.de !== c || (c && $('#cu-texto').value !== (c.texto || ''))) cargar();
      llenarProtagonistas();
      redimensionar();
      actualizar();
      cancelAnimationFrame(S.anim);
      bucle();
    },
    cerrar() { S.visible = false; parar(); cancelAnimationFrame(S.anim); },
    analizar,
  };
})(window.GM);
