/* Paso "Cuento": la niña escribe su historia. Cada oración es una escena.
   Palabras como salta, vuela, espada o duerme mueven al personaje; bosque, mar o noche cambian el fondo.
   Si nombra a alguien que todavía no tiene dibujo (mamá, perro, Lucía...), se le pide que lo dibuje. */
(function (GM) {
  'use strict';
  const $ = GM.$;
  const S = { escenas: [], i: 0, jugando: false, t0: 0, anim: 0, finEscena: 0, hablando: false, visible: false };
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
    ['feliz', /\b(feliz|felic|rie|rio|alegr|content|celebr|jueg|jug|ama |abraz)/],
  ];
  const LUGAR_RE = [
    ['noche', /\b(noche|luna|estrella|oscur)/],
    ['mar', /\b(mar|playa|agua|rio|lago|ola|olas|nada|nado)\b/],
    ['bosque', /\b(bosque|arbol|arboles|selva|jungla)/],
    ['cielo', /\b(cielo|nube|nubes)/],
    ['casa', /\b(casa|cuarto|cocina|escuela|cama)/],
    ['montana', /\b(montan|cueva|volcan)/],
  ];
  // Personajes y cosas que, si aparecen en el cuento, se le pide dibujar
  const LEXICO = ['mamá', 'papá', 'hermano', 'hermana', 'abuela', 'abuelo', 'amigo', 'amiga', 'perro', 'perrito', 'gato', 'gatito', 'dragón',
    'princesa', 'príncipe', 'rey', 'reina', 'bruja', 'mago', 'monstruo', 'pájaro', 'loro', 'pez', 'conejo', 'oso', 'león', 'tigre', 'mono',
    'caballo', 'unicornio', 'hada', 'robot', 'maestra', 'maestro', 'bebé', 'ratón', 'vaca', 'pollito', 'tortuga', 'mariposa', 'pato',
    'árbol', 'nido', 'castillo', 'barco', 'cohete', 'flor', 'pastel', 'tesoro'];
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
      for (const [l, re] of LUGAR_RE) if (re.test(norm)) { lugar = l; break; }
      const esc = { texto: f, accion, lugar: accion === 'volar' && lugar === 'campo' ? 'cielo' : lugar, ids: [] };
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
      casa: ['#f6e2c4', '#fbefdc'], montana: ['#9fd0f0', '#e6f4ff'], campo: ['#8fd0f7', '#e4f5ff'] };
    const [c1, c2] = cielos[lugar] || cielos.campo;
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
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
    const todos = GM.app.dibujos();
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
    ds.forEach((d, k) => {
      const rig = GM.rig(d);
      const bh = rig.caja.y1 - rig.caja.y0 || 1, bw = rig.caja.x1 - rig.caja.x0 || 1;
      const alto = H * (n > 2 ? 0.42 : 0.52);
      const s = Math.min(alto / bh, (W / Math.max(n, 1.6)) * 0.8 / bw);
      const cx = n === 1 ? W * 0.5 : W * (0.25 + (0.5 * k) / (n - 1));
      const acc = k === 0 ? esc.accion : (esc.accion === 'dormir' ? 'dormir' : esc.ids.includes(d.id) ? esc.accion : 'feliz');
      ctx.save();
      ctx.translate(cx - rig.pie.x * s, suelo + 10 - rig.pie.y * s);
      ctx.scale(s, s);
      // sombra
      ctx.fillStyle = 'rgba(0,0,0,.12)';
      ctx.beginPath(); ctx.ellipse(rig.pie.x, rig.pie.y, bw * 0.35, bh * 0.04, 0, 0, Math.PI * 2); ctx.fill();
      if (esc.lugar === 'noche') { ctx.shadowColor = 'rgba(255,255,240,.85)'; ctx.shadowBlur = 10; }
      GM.dibujarRig(ctx, rig, t + k * 0.7, acc, { raiz: GM.raiz(rig, t + k * 0.7, acc, W / s * 0.5) });
      ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
      if (acc === 'dormir') {
        ctx.fillStyle = '#ffffff'; ctx.font = '700 ' + Math.round(60 / s * 0.6) + 'px Fredoka, sans-serif';
        const z = (t % 2) / 2;
        ctx.globalAlpha = 1 - z;
        ctx.fillText('Z z z', rig.caja.x1, rig.caja.y0 - z * 80 / s);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    });
    texto(esc.texto);
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
    const dibujos = GM.app.dibujos();
    const r = analizar($('#cu-texto').value, dibujos);
    S.escenas = r.escenas;
    const ol = $('#cu-escenas');
    ol.textContent = '';
    r.escenas.forEach((e, k) => {
      const li = document.createElement('li');
      const div = document.createElement('div');
      div.textContent = e.texto;
      const chips = document.createElement('div');
      chips.className = 'chips';
      const a = GM.ACCIONES.find((x) => x.id === e.accion);
      [a ? a.emoji + ' ' + a.nombre : '', '📍 ' + e.lugar.replace('montana', 'montaña')].forEach((c) => {
        if (!c) return;
        const s = document.createElement('span'); s.className = 'chip'; s.textContent = c; chips.appendChild(s);
      });
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
      const b = document.createElement('button'); b.className = 'btn primario'; b.textContent = 'Dibujar y tomar foto';
      b.addEventListener('click', () => GM.app.nuevoDibujo(nombre, 'cuento'));
      row.append(t, b);
      box.appendChild(row);
    });
    $('#cu-faltan-sec').hidden = !r.faltan.length;
    if (S.i >= S.escenas.length) S.i = 0;
    irA(S.i);
    GM.store.guardarAjuste('cuento', { texto: $('#cu-texto').value, protagonista: S.protagonista });
  }

  function llenarProtagonistas() {
    const sel = $('#cu-protagonista');
    const dibujos = GM.app.dibujos();
    sel.textContent = '';
    dibujos.forEach((d) => {
      const o = document.createElement('option'); o.value = d.id; o.textContent = d.nombre; sel.appendChild(o);
    });
    if (!dibujos.some((d) => d.id === S.protagonista)) S.protagonista = GM.app.actual() ? GM.app.actual().id : (dibujos[0] || {}).id;
    sel.value = S.protagonista || '';
  }

  GM.cuento = {
    async init() {
      cv = $('#cv-cuento'); ctx = cv.getContext('2d');
      new ResizeObserver(redimensionar).observe(cv.parentElement);
      const guardado = await GM.store.leerAjuste('cuento');
      $('#cu-texto').value = guardado && guardado.texto ? guardado.texto : GM.MUESTRA.cuento;
      S.protagonista = guardado ? guardado.protagonista : null;
      $('#cu-texto').addEventListener('input', GM.debounce(actualizar, 400));
      $('#cu-protagonista').addEventListener('change', (e) => { S.protagonista = e.target.value; actualizar(); });
      $('#cu-play').addEventListener('click', () => (S.jugando ? parar() : jugar()));
      $('#cu-sig').addEventListener('click', () => siguiente(false));
      $('#cu-ant').addEventListener('click', () => irA(S.i - 1));
      try { speechSynthesis.getVoices(); } catch (e) { /* nada */ }
    },
    abrir() {
      S.visible = true;
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
