/* Paso "Marcar": la niña elige una parte (cabeza, ala, pierna...) y la marca con el dedo.
   Herramientas: pintar encima, tocar una línea, encerrar con un círculo y borrar marca.
   Cada parte tiene un "clavito" que se puede mover: es el punto donde gira. */
(function (GM) {
  'use strict';
  const $ = GM.$;
  const S = {
    d: null, activa: null, herr: 'pincel', tam: 18, prueba: false, accion: 'bailar', acomodar: false, ac: 'girar', agarre: null, elegida: null,
    pila: [], trazo: null, lazo: null, clavo: false, overlay: null, overlaySucio: true,
    alfa: null, alfaVer: -1, comps: null, compsVer: -1, t0: 0, anim: 0,
  };
  let L = null;

  /* ---------- utilidades de etiquetas ---------- */

  function alfaTinta() {
    if (S.alfa && S.alfaVer === S.d.tintaVer) return S.alfa;
    const c = S.d.tinta, w = c.width, h = c.height;
    const data = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    S.alfa = new Uint8Array(w * h);
    for (let p = 0; p < w * h; p++) S.alfa[p] = data[p * 4 + 3];
    S.alfaVer = S.d.tintaVer;
    return S.alfa;
  }

  function componentes() {
    if (S.comps && S.compsVer === S.d.tintaVer) return S.comps;
    const a = alfaTinta(), m = new Uint8Array(a.length);
    for (let i = 0; i < a.length; i++) m[i] = a[i] > 60 ? 1 : 0;
    S.comps = GM.componentes(m, S.d.w, S.d.h);
    S.compsVer = S.d.tintaVer;
    return S.comps;
  }

  function sello(x, y, r, lab) {
    const d = S.d, w = d.w, h = d.h, e = d.etiquetas;
    const x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(w - 1, Math.ceil(x + r));
    const y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(h - 1, Math.ceil(y + r));
    const r2 = r * r;
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
      if ((xx - x) * (xx - x) + (yy - y) * (yy - y) <= r2) e[yy * w + xx] = lab;
    }
  }

  function linea(a, b, r, lab) {
    const dist = Math.hypot(b.x - a.x, b.y - a.y), paso = Math.max(1, r * 0.4);
    const n = Math.ceil(dist / paso);
    for (let i = 1; i <= n; i++) sello(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n, r, lab);
  }

  /** Marca con `lab` todo lo que quede dentro del polígono. */
  GM.rellenarPoligono = function (d, poli, lab) {
    if (poli.length < 3) return 0;
    const c = GM.crearCanvas(d.w, d.h), x = c.getContext('2d', { willReadFrequently: true });
    x.beginPath();
    poli.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])));
    x.closePath(); x.fillStyle = '#000'; x.fill();
    const data = x.getImageData(0, 0, d.w, d.h).data;
    let n = 0;
    for (let p = 0; p < d.w * d.h; p++) if (data[p * 4 + 3] > 127) { d.etiquetas[p] = lab; n++; }
    return n;
  };

  /** Crea una parte nueva en el dibujo y devuelve su id. */
  GM.nuevaParte = function (d, tipoId, nombre) {
    const tipo = GM.TIPOS.find((t) => t.tipo === tipoId) || GM.TIPOS[GM.TIPOS.length - 1];
    const id = d.partes.reduce((m, p) => Math.max(m, p.id), 0) + 1;
    if (id > 250) return null;
    let nom = (nombre || tipo.nombre).trim() || tipo.nombre;
    const mismos = d.partes.filter((p) => GM.normalizar(p.nombre).startsWith(GM.normalizar(nom))).length;
    if (mismos && !nombre) nom = nom + ' ' + (mismos + 1);
    const usados = new Set(d.partes.map((p) => p.color));
    const color = GM.COLORES_PARTE.find((c) => !usados.has(c)) || GM.COLORES_PARTE[id % GM.COLORES_PARTE.length];
    d.partes.push({ id, tipo: tipo.tipo, nombre: nom, emoji: tipo.emoji, mov: tipo.mov, color, pivote: null });
    return id;
  };

  function parte(id) { return S.d && S.d.partes.find((p) => p.id === id); }

  /* ---------- deshacer / guardar ---------- */

  function recordar() {
    S.pila.push({ e: S.d.etiquetas.slice(), p: JSON.stringify(S.d.partes), a: S.activa });
    if (S.pila.length > 25) S.pila.shift();
  }

  function cambiado() {
    S.d.version = (S.d.version || 0) + 1;
    S.overlaySucio = true;
    GM.app.guardarLuego(S.d);
    reconstruirLuego();
    L.pedir();
  }

  const reconstruirLuego = GM.debounce(() => { if (S.d && !S.prueba) { GM.rig(S.d); L.pedir(); } }, 280);

  /* ---------- dibujo ---------- */

  function actualizarOverlay() {
    const d = S.d, w = d.w, h = d.h;
    if (!S.overlay || S.overlay.width !== w || S.overlay.height !== h) S.overlay = GM.crearCanvas(w, h);
    const ctx = S.overlay.getContext('2d');
    const img = ctx.createImageData(w, h), o = img.data;
    const a = alfaTinta(), e = d.etiquetas;
    const col = new Map(d.partes.map((p) => [p.id, GM.hexARgb(p.color)]));
    for (let p = 0; p < w * h; p++) {
      const lab = e[p];
      if (!lab) continue;
      const c = col.get(lab);
      if (!c) continue;
      const i = p * 4;
      o[i] = c[0]; o[i + 1] = c[1]; o[i + 2] = c[2];
      o[i + 3] = a[p] > 50 ? Math.max(a[p], 200) : lab === S.activa ? 70 : 0;
    }
    ctx.putImageData(img, 0, 0);
    S.overlaySucio = false;
  }

  function dibujar(ctx) {
    const d = S.d;
    if (!d) return;
    if (S.acomodar) {
      GM.dibujarRig(ctx, GM.rig(d), 0, 'pose');
      return;
    }
    if (S.prueba) {
      const t = (performance.now() - S.t0) / 1000;
      const rig = GM.rig(d);
      // más pequeño en la prueba para que al saltar o volar no se salga de la hoja
      ctx.translate(d.w / 2, d.h * 0.62); ctx.scale(0.62, 0.62); ctx.translate(-d.w / 2, -d.h * 0.5);
      GM.dibujarRig(ctx, rig, t, S.accion, { raiz: GM.raiz(rig, t, S.accion, d.w * 0.5) });
      return;
    }
    if (d.colorUsado) ctx.drawImage(d.color, 0, 0);
    ctx.drawImage(d.tinta, 0, 0);
    if (S.overlaySucio) actualizarOverlay();
    ctx.drawImage(S.overlay, 0, 0);
  }

  function encima(ctx, lz) {
    if (!S.d || S.prueba) return;
    if (S.acomodar) {
      const rig = GM.rig(S.d), p = S.elegida && rig.porId.get(S.elegida);
      if (!p) return;
      const m = GM.matricesRig(rig, 0, 'pose', GM.mat.id()).get(p.id);
      const q = GM.mat.aplicar(m, p.pivote.x, p.pivote.y), sc = lz.aPantalla(q[0], q[1]);
      ctx.save();
      ctx.beginPath(); ctx.arc(sc.x, sc.y, 14, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = p.datos.color; ctx.stroke();
      ctx.beginPath(); ctx.arc(sc.x, sc.y, 5, 0, Math.PI * 2); ctx.fillStyle = p.datos.color; ctx.fill();
      ctx.restore();
      return;
    }
    if (S.lazo && S.lazo.length > 1) {
      ctx.save();
      ctx.lineWidth = 4; ctx.setLineDash([10, 8]); ctx.lineCap = 'round';
      ctx.strokeStyle = (parte(S.activa) || {}).color || '#333';
      ctx.beginPath();
      S.lazo.forEach((p, i) => { const s = lz.aPantalla(p.x, p.y); i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); });
      ctx.stroke(); ctx.restore();
    }
    const pv = clavoActivo();
    if (pv) {
      const s = lz.aPantalla(pv.x, pv.y), c = parte(S.activa).color;
      ctx.save();
      ctx.beginPath(); ctx.arc(s.x, s.y, 16, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = c; ctx.stroke();
      ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill();
      ctx.restore();
    }
  }

  function clavoActivo() {
    if (!S.activa || !S.d) return null;
    const p = parte(S.activa);
    if (p && p.pivote) return p.pivote;
    const rig = S.d._rig;
    if (!rig || S.d._rigVer !== S.d.version) return null;
    const rp = rig.porId.get(S.activa);
    return rp ? rp.pivote : null;
  }

  /* ---------- toques ---------- */

  function radio() { return (S.tam / 2) * L.pxPorCss() * 1.6; }

  const tocar = {
    inicio(pt) {
      if (!S.d || S.prueba) return false;
      if (S.acomodar) return agarrar(pt);
      const pv = clavoActivo();
      if (pv) {
        const s = L.aPantalla(pv.x, pv.y), r = L.cv.getBoundingClientRect();
        const q = L.aPantalla(pt.x, pt.y);
        if (Math.hypot(s.x - q.x, s.y - q.y) < 34 && r) { S.clavo = true; recordar(); return true; }
      }
      if (S.herr !== 'goma' && !S.activa) { pedirParte(); return false; }
      recordar();
      if (S.herr === 'varita') { varita(pt); return false; }
      if (S.herr === 'lazo') { S.lazo = [pt]; return true; }
      const lab = S.herr === 'goma' ? 0 : S.activa;
      S.trazo = { ult: pt, lab };
      sello(pt.x, pt.y, radio(), lab);
      S.overlaySucio = true; L.pedir();
      return true;
    },
    mover(pt) {
      if (S.agarre) { arrastrar(pt); return; }
      if (S.clavo) {
        const p = parte(S.activa);
        p.pivote = { x: Math.max(0, Math.min(S.d.w, pt.x)), y: Math.max(0, Math.min(S.d.h, pt.y)) };
        L.pedir();
        return;
      }
      if (S.lazo) { S.lazo.push(pt); L.pedir(); return; }
      if (!S.trazo) return;
      linea(S.trazo.ult, pt, radio(), S.trazo.lab);
      S.trazo.ult = pt;
      S.overlaySucio = true; L.pedir();
    },
    fin() {
      if (S.agarre) { S.agarre = null; GM.app.guardarLuego(S.d); return; }
      if (S.clavo) { S.clavo = false; S.d.version++; GM.app.guardarLuego(S.d); reconstruirLuego(); return; }
      if (S.lazo) {
        const n = GM.rellenarPoligono(S.d, S.lazo.map((p) => [p.x, p.y]), S.activa);
        S.lazo = null;
        if (n < 30) { S.pila.pop(); GM.aviso('Dibuja un círculo alrededor de la parte'); L.pedir(); return; }
        cambiado();
        return;
      }
      S.trazo = null;
      cambiado();
    },
    cancelar() {
      S.agarre = null;
      const u = S.pila.pop();
      if (u) restaurar(u);
      S.trazo = null; S.lazo = null; S.clavo = false;
    },
  };

  /* ---------- acomodar (postura inicial) ---------- */

  function agarrar(pt) {
    const rig = GM.rig(S.d);
    const mats = GM.matricesRig(rig, 0, 'pose', GM.mat.id());
    const p = GM.parteEn(rig, mats, pt.x, pt.y, Math.max(4, Math.round(14 * L.pxPorCss())));
    if (!p) { GM.aviso('Toca una parte marcada para moverla'); return false; }
    recordar();
    S.elegida = p.id;
    const pd = p.datos;
    pd.reposo = Object.assign({ r: 0, dx: 0, dy: 0 }, pd.reposo || {});
    const piv = GM.mat.aplicar(mats.get(p.id), p.pivote.x, p.pivote.y);
    const pm = p.padre !== null && mats.has(p.padre) ? mats.get(p.padre) : GM.mat.id();
    S.agarre = { p, pd, piv, pm, ini: pt, r0: pd.reposo.r, dx0: pd.reposo.dx, dy0: pd.reposo.dy,
      a0: Math.atan2(pt.y - piv[1], pt.x - piv[0]) };
    L.pedir();
    return true;
  }

  function arrastrar(pt) {
    const g = S.agarre;
    if (S.ac === 'girar') {
      const a = Math.atan2(pt.y - g.piv[1], pt.x - g.piv[0]);
      g.pd.reposo.r = g.r0 + (a - g.a0);
    } else {
      const inv = GM.mat.inversa(g.pm);
      const dx = pt.x - g.ini.x, dy = pt.y - g.ini.y;
      g.pd.reposo.dx = g.dx0 + inv[0] * dx + inv[2] * dy;
      g.pd.reposo.dy = g.dy0 + inv[1] * dx + inv[3] * dy;
    }
    L.pedir();
  }

  function elegirAc(a) {
    S.ac = a;
    GM.$$('#mk-acomodo .herr').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ac === a)));
    $('#mk-pista').textContent = a === 'girar' ? 'Arrastra una parte para girarla alrededor de su clavito' : 'Arrastra una parte para moverla';
  }

  function acomodar(on) {
    if (on && S.prueba) probar(false);
    S.acomodar = on;
    $('#mk-acomodo').hidden = !on;
    $('#mk-herramientas').hidden = on;
    $('#mk-nueva').hidden = on;
    $('#mk-arriba').hidden = on;
    $('#mk-partes').parentElement.hidden = on;
    if (on) { GM.rig(S.d); elegirAc(S.ac); } else actualizarPista();
    L.pedir();
  }

  function varita(pt) {
    const c = componentes(), w = S.d.w, h = S.d.h;
    const R = Math.max(4, Math.round(22 * L.pxPorCss()));
    let best = -1, bd = Infinity;
    const x0 = Math.max(0, Math.round(pt.x - R)), x1 = Math.min(w - 1, Math.round(pt.x + R));
    const y0 = Math.max(0, Math.round(pt.y - R)), y1 = Math.min(h - 1, Math.round(pt.y + R));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const id = c.ids[y * w + x];
      if (id < 0) continue;
      const dd = (x - pt.x) * (x - pt.x) + (y - pt.y) * (y - pt.y);
      if (dd < bd) { bd = dd; best = id; }
    }
    if (best < 0) { S.pila.pop(); GM.aviso('Toca justo encima de una línea'); return; }
    const e = S.d.etiquetas;
    for (let p = 0; p < w * h; p++) if (c.ids[p] === best) e[p] = S.activa;
    cambiado();
  }

  function restaurar(u) {
    S.d.etiquetas.set(u.e);
    S.d.partes = JSON.parse(u.p);
    S.activa = parte(u.a) ? u.a : (S.d.partes[0] || {}).id || null;
    S.d.version++;
    S.overlaySucio = true;
    pintarPartes();
    GM.app.guardarLuego(S.d);
    reconstruirLuego();
    L.pedir();
  }

  /* ---------- panel ---------- */

  function pintarPartes() {
    const box = $('#mk-partes');
    box.textContent = '';
    if (!S.d.partes.length) {
      const p = document.createElement('p');
      p.className = 'vacio';
      p.textContent = 'Aún no hay partes. Toca «Nueva parte» para empezar.';
      box.appendChild(p);
    }
    S.d.partes.forEach((pd) => {
      const b = document.createElement('div');
      b.className = 'parte';
      b.setAttribute('role', 'button');
      b.tabIndex = 0;
      b.style.setProperty('--c', pd.color);
      b.setAttribute('aria-pressed', String(pd.id === S.activa));
      b.innerHTML = '<span class="punto"></span><span class="n"></span><button class="editar" aria-label="Cambiar">✎</button>';
      b.querySelector('.punto').textContent = pd.emoji;
      b.querySelector('.n').textContent = pd.nombre;
      b.addEventListener('click', (ev) => {
        if (ev.target.closest('.editar')) { editarParte(pd.id); return; }
        activar(pd.id);
      });
      box.appendChild(b);
    });
    $('#mk-titulo').textContent = 'Partes de ' + S.d.nombre;
    actualizarPista();
  }

  function activar(id) {
    S.activa = id;
    if (S.herr === 'goma') elegirHerr('pincel');
    S.overlaySucio = true;
    pintarPartes();
    GM.rig(S.d);
    L.pedir();
  }

  function actualizarPista() {
    const p = parte(S.activa), pista = $('#mk-pista');
    if (S.prueba) { pista.textContent = '¡Mira cómo se mueve!'; return; }
    if (!p) { pista.textContent = 'Toca «Nueva parte» y elige qué vas a marcar'; return; }
    const txt = { pincel: 'Pinta encima de: ', varita: 'Toca una línea de: ', lazo: 'Dibuja un círculo alrededor de: ', goma: 'Pinta para borrar marcas' };
    pista.textContent = S.herr === 'goma' ? txt.goma : txt[S.herr] + p.nombre + '. El círculo es el clavito: muévelo a donde se une.';
  }

  function elegirHerr(h) {
    S.herr = h;
    GM.$$('#mk-herramientas .herr').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.herr === h)));
    $('#mk-tamanos').style.visibility = h === 'pincel' || h === 'goma' ? 'visible' : 'hidden';
    actualizarPista();
  }

  function elegirTam(t) {
    S.tam = t;
    GM.$$('#mk-tamanos .tam').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.tam === t)));
  }

  /* Selector de parte nueva */
  function pedirParte() {
    const box = $('#mp-tipos');
    if (!box.childElementCount) {
      GM.TIPOS.forEach((t) => {
        const b = document.createElement('button');
        b.className = 'tipo';
        b.innerHTML = '<span></span>';
        b.querySelector('span').textContent = t.emoji;
        b.appendChild(document.createTextNode(t.nombre));
        b.addEventListener('click', () => {
          if (t.tipo === 'otra') { $('#mp-otra').hidden = false; $('#mp-nombre').focus(); return; }
          crear(t.tipo);
        });
        box.appendChild(b);
      });
    }
    $('#mp-otra').hidden = true;
    $('#mp-nombre').value = '';
    $('#modal-parte').hidden = false;
  }

  function crear(tipo, nombre) {
    recordar();
    const id = GM.nuevaParte(S.d, tipo, nombre);
    $('#modal-parte').hidden = true;
    if (!id) { GM.aviso('¡Ya hay muchas partes!'); return; }
    S.d.version++;
    GM.app.guardarLuego(S.d);
    if (S.herr === 'goma') elegirHerr('pincel');
    activar(id);
  }

  /* Editar parte */
  let editando = null, borrarSeguro = false;
  function editarParte(id) {
    const p = parte(id);
    if (!p) return;
    editando = id; borrarSeguro = false;
    $('#me-titulo').textContent = p.emoji + ' ' + p.nombre;
    $('#me-nombre').value = p.nombre;
    $('#me-borrar').textContent = 'Borrar parte';
    const box = $('#me-movs');
    box.textContent = '';
    Object.entries(GM.MOVS).forEach(([k, m]) => {
      const b = document.createElement('button');
      b.className = 'mov';
      b.setAttribute('aria-pressed', String(p.mov === k));
      b.innerHTML = '<span></span>';
      b.querySelector('span').textContent = m.emoji;
      b.appendChild(document.createTextNode(m.nombre));
      b.addEventListener('click', () => {
        p.mov = k;
        GM.$$('.mov', box).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      });
      box.appendChild(b);
    });
    $('#modal-editar').hidden = false;
  }

  function cerrarEditar() {
    const p = parte(editando);
    if (p) {
      const n = $('#me-nombre').value.trim();
      if (n) p.nombre = n;
      S.d.version++;
      GM.app.guardarLuego(S.d);
    }
    $('#modal-editar').hidden = true;
    editando = null;
    pintarPartes();
  }

  function borrarParte() {
    if (!borrarSeguro) { borrarSeguro = true; $('#me-borrar').textContent = '¿Seguro? Toca otra vez'; return; }
    recordar();
    const id = editando, e = S.d.etiquetas;
    for (let i = 0; i < e.length; i++) if (e[i] === id) e[i] = 0;
    S.d.partes = S.d.partes.filter((p) => p.id !== id);
    if (S.activa === id) S.activa = (S.d.partes[0] || {}).id || null;
    $('#modal-editar').hidden = true;
    editando = null;
    pintarPartes();
    cambiado();
  }

  /* Modo prueba */
  function probar(on) {
    S.prueba = on;
    $('#mk-prueba').hidden = !on;
    $('#mk-herramientas').hidden = on;
    $('#mk-nueva').hidden = on;
    $('#mk-arriba').hidden = on;
    actualizarPista();
    cancelAnimationFrame(S.anim);
    if (on) {
      if (!S.d.partes.length) GM.aviso('Marca alguna parte para que se mueva');
      S.t0 = performance.now();
      const loop = () => { L.pintar(); S.anim = requestAnimationFrame(loop); };
      loop();
    } else {
      L.pedir();
    }
  }

  function pintarAcciones() {
    const box = $('#mk-acciones');
    box.textContent = '';
    GM.ACCIONES.forEach((a) => {
      const b = document.createElement('button');
      b.className = 'accion';
      b.setAttribute('aria-pressed', String(a.id === S.accion));
      b.innerHTML = '<span></span>';
      b.querySelector('span').textContent = a.emoji;
      b.appendChild(document.createTextNode(a.nombre));
      b.addEventListener('click', () => {
        S.accion = a.id; S.t0 = performance.now();
        GM.$$('.accion', box).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      });
      box.appendChild(b);
    });
  }

  /* ---------- API ---------- */

  GM.marcar = {
    init() {
      L = new GM.Lienzo($('#cv-marcar'), {
        tamano: () => (S.d ? { w: S.d.w, h: S.d.h } : { w: 100, h: 100 }),
        dibujar, encima, alTocar: tocar,
      });
      GM.$$('#mk-herramientas .herr').forEach((b) => b.addEventListener('click', () => elegirHerr(b.dataset.herr)));
      GM.$$('#mk-tamanos .tam').forEach((b) => b.addEventListener('click', () => elegirTam(+b.dataset.tam)));
      $('#mk-nueva').addEventListener('click', pedirParte);
      $('#mk-deshacer').addEventListener('click', () => { const u = S.pila.pop(); if (u) restaurar(u); else GM.aviso('No hay nada que deshacer'); });
      $('#mk-probar').addEventListener('click', () => probar(true));
      $('#mk-acomodar').addEventListener('click', () => acomodar(true));
      $('#mk-a-listo').addEventListener('click', () => acomodar(false));
      GM.$$('#mk-acomodo .herr').forEach((b) => b.addEventListener('click', () => elegirAc(b.dataset.ac)));
      $('#mk-a-deshacer').addEventListener('click', () => { const u = S.pila.pop(); if (u) restaurar(u); else GM.aviso('No hay nada que deshacer'); });
      $('#mk-a-reiniciar').addEventListener('click', () => {
        recordar();
        S.d.partes.forEach((p) => { p.reposo = null; });
        GM.app.guardarLuego(S.d); L.pedir();
      });
      $('#mk-volver').addEventListener('click', () => probar(false));
      $('#mk-zoom-mas').addEventListener('click', () => L.zoom(1.4));
      $('#mk-zoom-menos').addEventListener('click', () => L.zoom(1 / 1.4));
      $('#mk-zoom-ajustar').addEventListener('click', () => L.ajustar());
      $('#mp-cerrar').addEventListener('click', () => { $('#modal-parte').hidden = true; });
      $('#mp-nombre').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.value.trim()) crear('otra', e.target.value.trim()); });
      $('#me-listo').addEventListener('click', cerrarEditar);
      $('#me-borrar').addEventListener('click', borrarParte);
      elegirHerr('pincel');
      elegirTam(18);
      pintarAcciones();
    },
    abrir(d) {
      if (S.d !== d) { S.pila = []; S.activa = (d.partes[0] || {}).id || null; S.alfa = null; S.comps = null; }
      S.d = d;
      S.overlaySucio = true;
      probar(false);
      acomodar(false);
      pintarPartes();
      L.ajustado = false;
      L.redimensionar();
      GM.rig(d);
      L.pedir();
    },
    cerrar() { probar(false); acomodar(false); },
  };
})(window.GM);
