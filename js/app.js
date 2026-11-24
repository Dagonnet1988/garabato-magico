/* Arranque y navegación: Cuentos → Dibujos del cuento → Marcar → Colorear → Historia.
   Cada cuento tiene su texto y su lista de dibujos (un dibujo puede estar en varios cuentos). */
(function (GM) {
  'use strict';
  const $ = GM.$;
  const A = {
    dibujos: [], actual: null, pantalla: 'cuentos', imp: null,
    cuentos: [], cuento: null, perfil: { nombre: '', modificado: 0 }, sincronizando: false, ultimaSync: 0, errorNube: '',
  };

  function nuevoDibujo(nombre, w, h, tinta) {
    return {
      id: GM.uid(), nombre: nombre || 'Mi dibujo', w, h, tinta,
      color: GM.crearCanvas(w, h), colorUsado: false,
      etiquetas: new Uint8Array(w * h), partes: [],
      creado: Date.now(), version: 1, tintaVer: 1,
    };
  }

  /** Guarda en el iPad y, si hay cuenta, lo sube a la nube. */
  async function persistir(d) {
    d.modificado = Date.now();
    await GM.store.guardar(d);
    GM.nube.cambio(d);
  }

  const guardando = new Map();
  function guardarLuego(d) {
    clearTimeout(guardando.get(d.id));
    guardando.set(d.id, setTimeout(() => { persistir(d); guardando.delete(d.id); }, 700));
  }

  /* ---------- cuentos ---------- */
  const vivos = () => A.cuentos.filter((c) => !c.borrado);
  const dibujosDe = (c) => (c ? c.dibujos.map((id) => A.dibujos.find((d) => d.id === id)).filter(Boolean) : []);

  /** Guarda la lista de cuentos en el iPad y sube a la nube los que cambiaron. */
  function guardarCuento(c, sinFecha) {
    if (c && !sinFecha) c.modificado = Date.now();
    GM.store.guardarAjuste('cuentos', A.cuentos);
    if (c) GM.nube.ajusteCambio('cuento:' + c.id);
  }

  function crearCuento(titulo) {
    const c = { id: GM.uid(), titulo: titulo || 'Mi cuento', texto: '', protagonista: null, dibujos: [], creado: Date.now(), modificado: Date.now() };
    A.cuentos.push(c);
    guardarCuento(c);
    return c;
  }

  function abrirCuento(c) {
    A.cuento = c;
    GM.store.guardarAjuste('cuentoActual', c ? c.id : null);
    const ds = dibujosDe(c);
    if (!ds.includes(A.actual)) A.actual = ds[0] || null;
  }

  function agregarAlCuento(d) {
    if (!A.cuento || A.cuento.dibujos.includes(d.id)) return;
    A.cuento.dibujos.push(d.id);
    guardarCuento(A.cuento);
  }

  /** El primer cuento sale del cuento que había antes (cuando la app tenía uno solo). */
  async function migrarCuentos() {
    const cs = await GM.store.leerAjuste('cuentos');
    if (Array.isArray(cs)) { A.cuentos = cs; return; }
    A.cuentos = [];
    const viejo = await GM.store.leerAjuste('cuento');
    if (!A.dibujos.length && !viejo) return;
    const conMuestra = A.dibujos.some((d) => d.muestra);
    const texto = (viejo && viejo.texto) || (conMuestra ? GM.MUESTRA.cuento : '');
    A.cuentos.push({
      id: 'primero', // el mismo en todos los equipos, para que la nube no lo duplique
      titulo: conMuestra && texto === GM.MUESTRA.cuento ? 'Parrot Ninja en el bosque' : 'Mi primer cuento',
      texto, protagonista: (viejo && viejo.protagonista) || null, dibujos: A.dibujos.map((d) => d.id),
      creado: 1, modificado: (viejo && viejo.modificado) || 1,
    });
    guardarCuento(null);
  }

  /* ---------- perfil ---------- */
  function pintarPerfil() {
    const n = (A.perfil.nombre || '').trim();
    $('#marca-de').textContent = n ? 'de ' + n : '';
    $('#marca-de').hidden = !n;
    document.title = 'Garabato Mágico' + (n ? ' de ' + n : '');
  }

  function abrirPerfil() {
    $('#pf-nombre').value = A.perfil.nombre || '';
    $('#modal-perfil').hidden = false;
    setTimeout(() => $('#pf-nombre').focus(), 50);
  }

  function guardarPerfil() {
    A.perfil = { nombre: $('#pf-nombre').value.trim().slice(0, 30), modificado: Date.now() };
    GM.store.guardarAjuste('perfil', A.perfil);
    GM.store.guardarAjuste('perfilPreguntado', true);
    GM.nube.ajusteCambio('perfil');
    $('#modal-perfil').hidden = true;
    pintarPerfil();
    if (A.pantalla === 'cuentos') pintarCuentos();
  }

  /* ---------- ejemplo ---------- */
  async function crearMuestra() {
    const M = GM.MUESTRA;
    const img = await GM.cargarImagen(M.foto);
    const f = GM.imagen.analizar(img);
    const r = GM.imagen.extraer(f, { umbral: 0.16, manchas: 60, quitarBordes: true });
    const d = nuevoDibujo(M.nombre, r.w, r.h, r.tinta);
    d.muestra = true;
    for (const p of M.partes) {
      const id = GM.nuevaParte(d, p.tipo, p.nombre);
      GM.rellenarPoligono(d, M.mapear(p.poli, f, r.transf), id);
    }
    return d;
  }

  /* ---------- tarjetas ---------- */
  function miniatura(d) {
    const k = Math.min(1, 260 / Math.max(d.w, d.h));
    const c = GM.crearCanvas(d.w * k, d.h * k), x = c.getContext('2d');
    if (d.colorUsado) x.drawImage(d.color, 0, 0, c.width, c.height);
    x.drawImage(d.tinta, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  }

  function tarjeta(titulo, info, img, alTocar, quitar) {
    const b = document.createElement('div');
    b.className = 'tarjeta';
    b.setAttribute('role', 'button');
    b.tabIndex = 0;
    b.innerHTML = '<div class="miniatura"></div><div class="pie"><span class="nombre"></span><span class="info"></span></div>';
    const mini = b.querySelector('.miniatura');
    if (img) { const i = document.createElement('img'); i.src = img; i.alt = titulo; mini.appendChild(i); } else { mini.textContent = '📖'; mini.classList.add('vacia'); }
    b.querySelector('.nombre').textContent = titulo;
    b.querySelector('.info').textContent = info;
    if (quitar) {
      const q = document.createElement('button');
      q.className = 'quitar'; q.setAttribute('aria-label', quitar.etiqueta); q.textContent = '✕';
      q.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!q.classList.contains('seguro')) {
          q.classList.add('seguro'); q.textContent = quitar.pregunta;
          setTimeout(() => { q.classList.remove('seguro'); q.textContent = '✕'; }, 3000);
          return;
        }
        quitar.hacer();
      });
      b.appendChild(q);
    }
    b.addEventListener('click', alTocar);
    b.addEventListener('keydown', (e) => { if (e.key === 'Enter') alTocar(); });
    return b;
  }

  function pintarCuentos() {
    const g = $('#cuentos');
    GM.$$('.tarjeta:not(.nueva)', g).forEach((x) => x.remove());
    const n = (A.perfil.nombre || '').trim();
    $('#cuentos-titulo').textContent = n ? 'Los cuentos de ' + n : 'Mis cuentos';
    vivos().forEach((c) => {
      const ds = dibujosDe(c);
      const prota = ds.find((d) => d.id === c.protagonista) || ds[0];
      const escenas = (c.texto || '').split(/[.!?\n]+/).filter((x) => x.trim().length > 1).length;
      const info = (ds.length === 1 ? '1 dibujo' : ds.length + ' dibujos') + (escenas ? ' · ' + escenas + (escenas === 1 ? ' escena' : ' escenas') : '');
      g.insertBefore(tarjeta(c.titulo, info, prota ? miniatura(prota) : null, () => { abrirCuento(c); ir('dibujos'); }, {
        etiqueta: 'Borrar cuento', pregunta: '¿Borrar cuento?',
        hacer: () => {
          c.borrado = true; c.dibujos = []; c.texto = '';
          guardarCuento(c);
          if (A.cuento === c) { A.cuento = null; A.actual = null; }
          pintarCuentos(); pintarPasos();
          GM.aviso('Cuento borrado. Sus dibujos siguen guardados en «Un dibujo que ya tengo».', 3600);
        },
      }), $('#cuento-nuevo'));
    });
  }

  function pintarGaleria() {
    const g = $('#galeria');
    GM.$$('.tarjeta:not(.nueva)', g).forEach((x) => x.remove());
    $('#dib-titulo').textContent = A.cuento ? 'Dibujos de «' + A.cuento.titulo + '»' : 'Dibujos';
    dibujosDe(A.cuento).forEach((d) => {
      const enOtros = vivos().some((c) => c !== A.cuento && c.dibujos.includes(d.id));
      const info = d.partes.length ? d.partes.length + ' partes marcadas' : 'Sin partes marcadas';
      g.insertBefore(tarjeta(d.nombre, info, miniatura(d), () => { A.actual = d; ir('marcar'); }, {
        etiqueta: enOtros ? 'Quitar del cuento' : 'Borrar dibujo', pregunta: enOtros ? '¿Quitar?' : '¿Borrar?',
        hacer: async () => {
          A.cuento.dibujos = A.cuento.dibujos.filter((id) => id !== d.id);
          guardarCuento(A.cuento);
          if (!enOtros) {
            A.dibujos = A.dibujos.filter((x) => x !== d);
            await GM.store.borrar(d.id);
            GM.nube.borrado(d.id);
          }
          if (A.actual === d) A.actual = dibujosDe(A.cuento)[0] || null;
          pintarGaleria(); pintarPasos();
        },
      }), g.querySelector('.tarjeta.nueva'));
    });
    $('#usar-tengo').hidden = !A.dibujos.some((d) => !A.cuento || !A.cuento.dibujos.includes(d.id));
  }

  /** Elegir un dibujo que ya existe (de otro cuento, o que quedó suelto) para este cuento. */
  function abrirTengo() {
    const box = $('#mt-lista');
    box.textContent = '';
    A.dibujos.filter((d) => !A.cuento.dibujos.includes(d.id)).forEach((d) => {
      const suelto = !vivos().some((c) => c.dibujos.includes(d.id));
      box.appendChild(tarjeta(d.nombre, suelto ? 'Sin cuento' : 'En otro cuento', miniatura(d), () => {
        agregarAlCuento(d);
        A.actual = d;
        $('#modal-tengo').hidden = true;
        pintarGaleria(); pintarPasos();
        GM.aviso(d.nombre + ' ya está en este cuento');
      }, suelto ? {
        etiqueta: 'Borrar dibujo', pregunta: '¿Borrar?',
        hacer: async () => {
          A.dibujos = A.dibujos.filter((x) => x !== d);
          await GM.store.borrar(d.id);
          GM.nube.borrado(d.id);
          abrirTengo(); pintarGaleria();
        },
      } : null));
    });
    $('#modal-tengo').hidden = false;
  }

  /* ---------- importar foto ---------- */
  function pintarImportacion() {
    const cv = $('#cv-importar'), r = cv.parentElement.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    const c = cv.getContext('2d');
    c.clearRect(0, 0, cv.width, cv.height);
    if (!A.imp || !A.imp.r) return;
    const t = A.imp.r.tinta, pad = 24 * dpr;
    const s = Math.min((cv.width - pad * 2) / t.width, (cv.height - pad * 2) / t.height);
    c.drawImage(t, (cv.width - t.width * s) / 2, (cv.height - t.height * s) / 2, t.width * s, t.height * s);
  }

  function reextraer() {
    if (!A.imp) return;
    A.imp.r = GM.imagen.extraer(A.imp.f, {
      umbral: +$('#imp-umbral').value / 100,
      manchas: +$('#imp-manchas').value,
      quitarBordes: $('#imp-bordes').checked,
    });
    pintarImportacion();
  }

  async function alElegirFoto(file) {
    if (!file) return;
    GM.aviso('Preparando tu dibujo…', 8000);
    const url = URL.createObjectURL(file);
    try {
      const img = await GM.cargarImagen(url);
      A.imp = { f: GM.imagen.analizar(img), r: null };
      $('#imp-nombre').value = A.nombrePedido || '';
      mostrar('importar');
      reextraer();
      GM.$('#aviso').hidden = true;
    } catch (e) {
      GM.aviso('No pude abrir esa foto. Prueba con otra.');
    } finally {
      URL.revokeObjectURL(url);
      $('#foto-nueva').value = '';
    }
  }

  async function guardarImportacion() {
    if (!A.imp || !A.imp.r) return;
    const r = A.imp.r;
    const nombre = $('#imp-nombre').value.trim() || 'Dibujo ' + (A.dibujos.length + 1);
    const d = nuevoDibujo(nombre, r.w, r.h, r.tinta);
    A.dibujos.push(d);
    agregarAlCuento(d);
    A.actual = d;
    A.imp = null; A.nombrePedido = null;
    await persistir(d);
    ir('marcar');
    GM.aviso('¡Listo! Ahora marca sus partes con el dedo', 3200);
  }

  /* ---------- navegación ---------- */
  const PANTALLAS = ['cuentos', 'dibujos', 'importar', 'marcar', 'colorear', 'cuento'];
  const MODULOS = { marcar: () => GM.marcar, colorear: () => GM.colorear, cuento: () => GM.cuento };

  function mostrar(p) {
    if (A.pantalla !== p && MODULOS[A.pantalla]) MODULOS[A.pantalla]().cerrar();
    A.pantalla = p;
    PANTALLAS.forEach((x) => { $('#pantalla-' + x).hidden = x !== p; });
    pintarPasos();
  }

  function ir(p) {
    if (p !== 'cuentos' && !A.cuento) { if (p !== 'dibujos') GM.aviso('Primero elige o crea un cuento'); p = 'cuentos'; }
    if ((p === 'marcar' || p === 'colorear') && !A.actual) { GM.aviso('Primero agrega un dibujo a este cuento'); p = 'dibujos'; }
    mostrar(p);
    if (p === 'cuentos') pintarCuentos();
    if (p === 'dibujos') pintarGaleria();
    if (p === 'marcar') GM.marcar.abrir(A.actual);
    if (p === 'colorear') GM.colorear.abrir(A.actual);
    if (p === 'cuento') GM.cuento.abrir();
    try { history.replaceState(null, '', '#' + p); } catch (e) { /* nada */ }
  }

  function pintarPasos() {
    GM.$$('.paso[data-ir]').forEach((b) => {
      const p = b.dataset.ir;
      if (p === A.pantalla || (A.pantalla === 'importar' && p === 'dibujos')) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
      b.disabled = p === 'cuentos' ? false : !A.cuento ? true : (p === 'marcar' || p === 'colorear') ? !A.actual : false;
    });
  }

  /** Dibujo en blanco para dibujar dentro de la app. */
  async function dibujoEnBlanco() {
    const nombre = $('#mn-nombre').value.trim() || 'Dibujo ' + (A.dibujos.length + 1);
    $('#modal-nombre').hidden = true;
    const w = 800, h = 900;
    const d = nuevoDibujo(nombre, w, h, GM.crearCanvas(w, h));
    A.dibujos.push(d);
    agregarAlCuento(d);
    A.actual = d;
    A.nombrePedido = null;
    await persistir(d);
    mostrar('colorear');
    GM.colorear.abrir(d, 'lapiz');
    try { history.replaceState(null, '', '#colorear'); } catch (e) { /* nada */ }
    GM.aviso('Dibuja con el lápiz. Luego marca sus partes en «Marcar»', 3600);
  }

  function pedirNombreDibujo(nombre) {
    $('#mn-nombre').value = nombre || '';
    $('#modal-nombre').hidden = false;
  }

  /* ---------- nube ---------- */
  const TEXTO_ESTADO = {
    'sin-sesion': ['☁️', 'Guardar en la nube'],
    sincronizando: ['🔄', 'Guardando…'],
    listo: ['✅', 'En la nube'],
    error: ['⚠️', 'Sin conexión'],
  };

  function pintarCuenta(e, detalle) {
    const b = $('#btn-cuenta');
    if (!GM.nube.disponible()) { b.hidden = true; return; }
    if (e === 'error') A.errorNube = detalle || 'No se pudo conectar';
    else if (e === 'listo') A.errorNube = '';
    const [ic, t] = TEXTO_ESTADO[e] || TEXTO_ESTADO['sin-sesion'];
    b.hidden = false;
    b.querySelector('.paso-ic').textContent = ic;
    b.querySelector('.t').textContent = t;
    if (!$('#modal-cuenta').hidden) pintarEstadoNube();
  }

  function pintarEstadoNube() {
    const t = $('#cn-estado');
    const hora = A.ultimaSync ? new Date(A.ultimaSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
    t.textContent = (hora ? 'Última vez que se revisó la nube: ' + hora + '.' : 'Todavía no se ha revisado la nube en este equipo.')
      + (A.errorNube ? ' Problema: ' + A.errorNube : '');
    t.classList.toggle('error', !!A.errorNube);
  }

  function abrirCuenta() {
    const con = !!GM.nube.correo();
    $('#cu-sin').hidden = con; $('#cu-con').hidden = !con;
    $('#cn-ok').hidden = true; $('#cn-error').hidden = true;
    $('#cn-correo-actual').textContent = GM.nube.correo();
    pintarEstadoNube();
    $('#modal-cuenta').hidden = false;
  }

  function errorCuenta(t) { const e = $('#cn-error'); e.textContent = t; e.hidden = false; }

  async function aplicarSincronizacion(r) {
    if (!r) return;
    let cambio = false;
    const muestrasQuitadas = [];
    for (const id of r.borrados) {
      const d = A.dibujos.find((x) => x.id === id);
      if (d && d.muestra) muestrasQuitadas.push(id);
      A.dibujos = A.dibujos.filter((x) => x.id !== id);
      await GM.store.borrar(id);
      cambio = true;
    }
    for (const n of r.nuevos) {
      GM.hornear(n);
      const i = A.dibujos.findIndex((d) => d.id === n.id);
      if (i >= 0) A.dibujos[i] = n; else A.dibujos.push(n);
      await GM.store.guardar(n);
      cambio = true;
    }
    // El ejemplo de este equipo se cambió por el de la cuenta: los cuentos apuntan al de la cuenta
    const muestraNube = A.dibujos.find((d) => d.muestra);
    if (muestrasQuitadas.length && muestraNube) {
      A.cuentos.forEach((c) => { c.dibujos = Array.from(new Set(c.dibujos.map((id) => (muestrasQuitadas.includes(id) ? muestraNube.id : id)))); });
      GM.store.guardarAjuste('cuentos', A.cuentos);
    }
    // Ajustes: perfil y cuentos (gana el cambio más reciente)
    const remotos = new Map();
    for (const f of r.ajustes || []) {
      if (!f.valor) continue;
      const v = Object.assign({}, f.valor, { modificado: f.modificado });
      if (f.clave === 'perfil') {
        if ((v.modificado || 0) > (A.perfil.modificado || 0)) { A.perfil = v; GM.store.guardarAjuste('perfil', v); pintarPerfil(); cambio = true; }
        else if ((A.perfil.modificado || 0) > (v.modificado || 0)) GM.nube.ajusteCambio('perfil');
      } else if (f.clave.startsWith('cuento:')) remotos.set(f.clave.slice(7), v);
      else if (f.clave === 'cuento' && !r.ajustes.some((x) => x.clave === 'cuento:primero')) {
        // cuento guardado por la versión anterior de la app
        remotos.set('primero', Object.assign({ id: 'primero', parcial: true }, v));
      }
    }
    if (!r.ajustes.some((f) => f.clave === 'perfil') && A.perfil.modificado) GM.nube.ajusteCambio('perfil');
    let cuentosCambiaron = false;
    remotos.forEach((v, id) => {
      const l = A.cuentos.find((c) => c.id === id);
      if (!l) { if (!v.parcial) { A.cuentos.push(Object.assign({ dibujos: [] }, v, { id })); cuentosCambiaron = true; } return; }
      if ((v.modificado || 0) >= (l.modificado || 0)) {
        if (v.parcial) { l.texto = v.texto || l.texto; l.protagonista = v.protagonista || l.protagonista; l.modificado = v.modificado; GM.nube.ajusteCambio('cuento:' + id); }
        else { Object.keys(l).forEach((k) => delete l[k]); Object.assign(l, { dibujos: [] }, v, { id }); }
        cuentosCambiaron = true;
      } else GM.nube.ajusteCambio('cuento:' + id);
    });
    A.cuentos.forEach((c) => { if (!remotos.has(c.id) || remotos.get(c.id).parcial) GM.nube.ajusteCambio('cuento:' + c.id); });
    if (cuentosCambiaron) { GM.store.guardarAjuste('cuentos', A.cuentos); cambio = true; }
    if (!cambio) return;
    A.dibujos.sort((a, b) => (a.creado || 0) - (b.creado || 0));
    if (A.cuento && (A.cuento.borrado || !A.cuentos.includes(A.cuento))) A.cuento = null;
    if (!A.cuento) A.cuento = vivos()[0] || null;
    if (A.actual) A.actual = A.dibujos.find((d) => d.id === A.actual.id) || null;
    if (!A.actual || !dibujosDe(A.cuento).includes(A.actual)) A.actual = dibujosDe(A.cuento)[0] || null;
    // no interrumpir si está dibujando o marcando: solo refrescar lo que se ve
    if (A.pantalla === 'cuentos' || A.pantalla === 'dibujos' || A.pantalla === 'cuento') ir(A.pantalla);
    else if (A.pantalla === 'marcar' || A.pantalla === 'colorear') ir(A.actual ? A.pantalla : 'dibujos');
    else pintarPasos();
    GM.aviso('Se trajeron los cambios de la nube ☁️');
  }

  async function sincronizar() {
    if (A.sincronizando || !GM.nube.correo()) return;
    A.sincronizando = true;
    try {
      const r = await GM.nube.sincronizar();
      if (r) A.ultimaSync = Date.now();
      await aplicarSincronizacion(r);
    } finally { A.sincronizando = false; }
  }

  GM.app = {
    guardarLuego,
    dibujos: () => A.dibujos,
    actual: () => A.actual,
    cuentoActual: () => A.cuento,
    dibujosCuento: () => dibujosDe(A.cuento),
    guardarCuento: (c) => guardarCuento(c || A.cuento),
    /** Un dibujo que ya existe (por nombre) se agrega al cuento actual. */
    agregarAlCuento(d) { agregarAlCuento(d); },
    /** Valor de un ajuste que se sube a la nube. */
    valorAjuste(clave) {
      if (clave === 'perfil') return A.perfil;
      if (clave.startsWith('cuento:')) return A.cuentos.find((c) => 'cuento:' + c.id === clave) || null;
      return null;
    },
    /** Pide a la niña una foto nueva; si viene del cuento, ya trae el nombre del personaje. */
    nuevoDibujo(nombre) {
      A.nombrePedido = nombre || null;
      $('#foto-nueva').click();
    },
  };

  async function iniciar() {
    GM.marcar.init();
    GM.colorear.init();
    GM.cuento.init();
    GM.$$('.paso[data-ir]').forEach((b) => b.addEventListener('click', () => ir(b.dataset.ir)));
    $('#foto-nueva').addEventListener('change', (e) => alElegirFoto(e.target.files[0]));
    GM.$('label.tarjeta.nueva').addEventListener('click', () => { A.nombrePedido = null; });
    const re = GM.debounce(reextraer, 120);
    ['#imp-umbral', '#imp-manchas'].forEach((s) => $(s).addEventListener('input', re));
    $('#imp-bordes').addEventListener('change', reextraer);

    // perfil
    $('#btn-perfil').addEventListener('click', abrirPerfil);
    $('#pf-guardar').addEventListener('click', guardarPerfil);
    $('#pf-nombre').addEventListener('keydown', (e) => { if (e.key === 'Enter') guardarPerfil(); });
    $('#pf-cerrar').addEventListener('click', () => { $('#modal-perfil').hidden = true; GM.store.guardarAjuste('perfilPreguntado', true); });

    // cuentos
    $('#cuento-nuevo').addEventListener('click', () => { $('#mc-titulo').value = ''; $('#modal-cuento').hidden = false; setTimeout(() => $('#mc-titulo').focus(), 50); });
    const crear = () => {
      const c = crearCuento($('#mc-titulo').value.trim() || 'Cuento ' + (vivos().length + 1));
      $('#modal-cuento').hidden = true;
      abrirCuento(c);
      ir('dibujos');
      GM.aviso('Ahora agrega los dibujos de tu cuento', 3000);
    };
    $('#mc-crear').addEventListener('click', crear);
    $('#mc-titulo').addEventListener('keydown', (e) => { if (e.key === 'Enter') crear(); });
    $('#mc-cancelar').addEventListener('click', () => { $('#modal-cuento').hidden = true; });
    $('#usar-tengo').addEventListener('click', abrirTengo);
    $('#mt-cerrar').addEventListener('click', () => { $('#modal-tengo').hidden = true; });

    // nube
    GM.nube.alCambiar(pintarCuenta);
    $('#btn-cuenta').addEventListener('click', abrirCuenta);
    $('#cn-cerrar').addEventListener('click', () => { $('#modal-cuenta').hidden = true; });
    $('#cn-cerrar2').addEventListener('click', () => { $('#modal-cuenta').hidden = true; });
    const datosCuenta = () => {
      const email = $('#cn-correo').value.trim(), clave = $('#cn-clave').value;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { errorCuenta('Escribe un correo válido.'); return null; }
      if (clave.length < 6) { errorCuenta('La contraseña necesita 6 letras o más.'); return null; }
      return { email, clave };
    };
    const traducir = (m) => /invalid login/i.test(m) ? 'Correo o contraseña equivocados.'
      : /not confirmed/i.test(m) ? 'Falta confirmar el correo: abre el mensaje de Supabase y toca el enlace. Luego toca «Entrar».'
      : /already registered|already exists/i.test(m) ? 'Ese correo ya tiene cuenta: toca «Entrar».'
      : /rate limit/i.test(m) ? 'Demasiados intentos. Espera un minuto y prueba otra vez.'
      : m;
    const entrar = async () => {
      const c = datosCuenta(); if (!c) return;
      $('#cn-entrar').disabled = true;
      try {
        await GM.nube.entrar(c.email, c.clave);
        $('#modal-cuenta').hidden = true; $('#cn-clave').value = '';
        GM.aviso('¡Listo! Tus dibujos se guardan en la nube');
        sincronizar();
      } catch (e) { errorCuenta(traducir(e.message)); }
      $('#cn-entrar').disabled = false;
    };
    $('#cn-entrar').addEventListener('click', entrar);
    $('#cn-clave').addEventListener('keydown', (e) => { if (e.key === 'Enter') entrar(); });
    $('#cn-crear').addEventListener('click', async () => {
      const c = datosCuenta(); if (!c) return;
      $('#cn-crear').disabled = true;
      try {
        const lista = await GM.nube.crearCuenta(c.email, c.clave);
        if (lista) {
          $('#modal-cuenta').hidden = true; $('#cn-clave').value = '';
          GM.aviso('¡Cuenta creada! Tus dibujos se guardan en la nube');
          sincronizar();
        } else {
          $('#cn-error').hidden = true;
          const ok = $('#cn-ok');
          ok.textContent = 'Te enviamos un correo. Toca el enlace para confirmar y luego vuelve aquí y toca «Entrar».';
          ok.hidden = false;
        }
      } catch (e) { errorCuenta(traducir(e.message)); }
      $('#cn-crear').disabled = false;
    });
    $('#cn-sincronizar').addEventListener('click', async () => { $('#cn-sincronizar').disabled = true; await sincronizar(); $('#cn-sincronizar').disabled = false; pintarEstadoNube(); if (!A.errorNube) GM.aviso('Todo al día con la nube ☁️'); });
    $('#cn-salir').addEventListener('click', async () => { await GM.nube.cerrarSesion(); $('#modal-cuenta').hidden = true; GM.aviso('Sesión cerrada. Los dibujos siguen en este equipo.'); });

    $('#dibujar-aqui').addEventListener('click', () => pedirNombreDibujo(''));
    $('#mn-cancelar').addEventListener('click', () => { $('#modal-nombre').hidden = true; });
    $('#mn-empezar').addEventListener('click', dibujoEnBlanco);
    $('#mn-nombre').addEventListener('keydown', (e) => { if (e.key === 'Enter') dibujoEnBlanco(); });
    $('#imp-cancelar').addEventListener('click', () => { A.imp = null; ir('dibujos'); });
    $('#imp-guardar').addEventListener('click', guardarImportacion);
    new ResizeObserver(() => { if (A.pantalla === 'importar') pintarImportacion(); }).observe($('#cv-importar').parentElement);

    await GM.nube.iniciar();
    // Pedir al navegador que no borre los dibujos guardados cuando le falte espacio
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* nada */ }
    A.dibujos = await GM.store.listar();
    A.dibujos.forEach((d) => { d.version = 1; d.tintaVer = 1; });
    // posturas acomodadas con la versión anterior: quedan fijas en el dibujo
    for (const d of A.dibujos) if (GM.hornear(d)) await persistir(d);
    if (!A.dibujos.length && !(await GM.store.leerAjuste('muestraCreada'))) {
      try {
        const m = await crearMuestra();
        A.dibujos.push(m);
        await persistir(m);
        await GM.store.guardarAjuste('muestraCreada', true);
      } catch (e) { console.warn('No se pudo cargar el ejemplo', e); }
    }
    await migrarCuentos();
    A.perfil = (await GM.store.leerAjuste('perfil')) || { nombre: '', modificado: 0 };
    pintarPerfil();
    const idActual = await GM.store.leerAjuste('cuentoActual');
    const c0 = vivos().find((c) => c.id === idActual);
    if (c0) abrirCuento(c0);
    const h = (location.hash || '').slice(1);
    ir(A.cuento && ['dibujos', 'marcar', 'colorear', 'cuento'].includes(h) ? h : 'cuentos');
    if (!A.perfil.nombre && !(await GM.store.leerAjuste('perfilPreguntado'))) abrirPerfil();

    // La nube se revisa al abrir, al volver a la app y cada minuto mientras está abierta
    if (GM.nube.correo()) sincronizar();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sincronizar(); });
    window.addEventListener('focus', () => { if (Date.now() - A.ultimaSync > 15000) sincronizar(); });
    setInterval(() => { if (document.visibilityState === 'visible') sincronizar(); }, 60000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})(window.GM);
