/* Arranque y navegación entre pasos: Dibujos → Marcar → Colorear → Cuento. */
(function (GM) {
  'use strict';
  const $ = GM.$;
  const A = { dibujos: [], actual: null, pantalla: 'dibujos', imp: null, volverA: null };

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

  /* ---------- galería ---------- */
  function miniatura(d) {
    const k = Math.min(1, 260 / Math.max(d.w, d.h));
    const c = GM.crearCanvas(d.w * k, d.h * k), x = c.getContext('2d');
    if (d.colorUsado) x.drawImage(d.color, 0, 0, c.width, c.height);
    x.drawImage(d.tinta, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  }

  function pintarGaleria() {
    const g = $('#galeria');
    GM.$$('.tarjeta:not(.nueva)', g).forEach((x) => x.remove());
    A.dibujos.forEach((d) => {
      const b = document.createElement('div');
      b.className = 'tarjeta';
      b.setAttribute('role', 'button');
      b.tabIndex = 0;
      b.innerHTML = '<div class="miniatura"><img alt=""></div><div class="pie"><span class="nombre"></span><span class="info"></span></div><button class="quitar" aria-label="Borrar dibujo">✕</button>';
      b.querySelector('img').src = miniatura(d);
      b.querySelector('img').alt = d.nombre;
      b.querySelector('.nombre').textContent = d.nombre;
      b.querySelector('.info').textContent = d.partes.length ? d.partes.length + ' partes marcadas' : 'Sin partes marcadas';
      const quitar = b.querySelector('.quitar');
      quitar.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!quitar.classList.contains('seguro')) {
          quitar.classList.add('seguro'); quitar.textContent = '¿Borrar?';
          setTimeout(() => { quitar.classList.remove('seguro'); quitar.textContent = '✕'; }, 3000);
          return;
        }
        A.dibujos = A.dibujos.filter((x) => x !== d);
        if (A.actual === d) A.actual = A.dibujos[0] || null;
        await GM.store.borrar(d.id);
        GM.nube.borrado(d.id);
        pintarGaleria(); pintarPasos();
      });
      b.addEventListener('click', () => { A.actual = d; ir('marcar'); });
      g.insertBefore(b, g.querySelector('.tarjeta.nueva'));
    });
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
      $('#imp-nombre').value = A.imp.nombre || A.nombrePedido || '';
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
    A.actual = d;
    A.imp = null; A.nombrePedido = null;
    await persistir(d);
    pintarGaleria();
    ir('marcar');
    GM.aviso('¡Listo! Ahora marca sus partes con el dedo', 3200);
  }

  /* ---------- navegación ---------- */
  const PANTALLAS = ['dibujos', 'importar', 'marcar', 'colorear', 'cuento'];
  const MODULOS = { marcar: () => GM.marcar, colorear: () => GM.colorear, cuento: () => GM.cuento };

  function mostrar(p) {
    if (A.pantalla !== p && MODULOS[A.pantalla]) MODULOS[A.pantalla]().cerrar();
    A.pantalla = p;
    PANTALLAS.forEach((x) => { $('#pantalla-' + x).hidden = x !== p; });
    pintarPasos();
  }

  function ir(p) {
    if ((p === 'marcar' || p === 'colorear') && !A.actual) { GM.aviso('Primero elige o agrega un dibujo'); p = 'dibujos'; }
    if (p === 'cuento' && !A.dibujos.length) { GM.aviso('Primero agrega un dibujo'); p = 'dibujos'; }
    mostrar(p);
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
      b.disabled = (p === 'marcar' || p === 'colorear') ? !A.actual : p === 'cuento' ? !A.dibujos.length : false;
    });
  }

  /** Dibujo en blanco para dibujar dentro de la app. */
  async function dibujoEnBlanco() {
    const nombre = $('#mn-nombre').value.trim() || 'Dibujo ' + (A.dibujos.length + 1);
    $('#modal-nombre').hidden = true;
    const w = 800, h = 900;
    const d = nuevoDibujo(nombre, w, h, GM.crearCanvas(w, h));
    A.dibujos.push(d);
    A.actual = d;
    A.nombrePedido = null;
    await persistir(d);
    pintarGaleria();
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

  function pintarCuenta(e) {
    const b = $('#btn-cuenta');
    if (!GM.nube.disponible()) { b.hidden = true; return; }
    const [ic, t] = TEXTO_ESTADO[e] || TEXTO_ESTADO['sin-sesion'];
    b.hidden = false;
    b.querySelector('.paso-ic').textContent = ic;
    b.querySelector('.t').textContent = t;
  }

  function abrirCuenta() {
    const con = !!GM.nube.correo();
    $('#cu-sin').hidden = con; $('#cu-con').hidden = !con;
    $('#cn-paso2').hidden = true; $('#cn-error').hidden = true;
    $('#cn-correo-actual').textContent = GM.nube.correo();
    $('#modal-cuenta').hidden = false;
  }

  function errorCuenta(t) { const e = $('#cn-error'); e.textContent = t; e.hidden = false; }

  async function aplicarSincronizacion(r) {
    if (!r) return;
    let cambio = false;
    for (const id of r.borrados) {
      A.dibujos = A.dibujos.filter((d) => d.id !== id);
      await GM.store.borrar(id);
      cambio = true;
    }
    for (const n of r.nuevos) {
      const i = A.dibujos.findIndex((d) => d.id === n.id);
      if (i >= 0) A.dibujos[i] = n; else A.dibujos.push(n);
      await GM.store.guardar(n);
      cambio = true;
    }
    if (r.cuento) GM.cuento.desdeNube(r.cuento);
    if (!cambio) return;
    A.dibujos.sort((a, b) => (a.creado || 0) - (b.creado || 0));
    if (A.actual) A.actual = A.dibujos.find((d) => d.id === A.actual.id) || A.dibujos[0] || null;
    else A.actual = A.dibujos[0] || null;
    ir(['marcar', 'colorear'].includes(A.pantalla) && !A.actual ? 'dibujos' : A.pantalla === 'importar' ? 'importar' : A.pantalla);
    GM.aviso('Tus dibujos de la nube ya están aquí ☁️');
  }

  async function sincronizar() { aplicarSincronizacion(await GM.nube.sincronizar()); }

  GM.app = {
    guardarLuego,
    dibujos: () => A.dibujos,
    actual: () => A.actual,
    /** Pide a la niña una foto nueva; si viene del cuento, ya trae el nombre del personaje. */
    nuevoDibujo(nombre) {
      A.nombrePedido = nombre || null;
      $('#foto-nueva').click();
    },
  };

  async function iniciar() {
    GM.marcar.init();
    GM.colorear.init();
    await GM.cuento.init();
    GM.$$('.paso[data-ir]').forEach((b) => b.addEventListener('click', () => ir(b.dataset.ir)));
    $('#foto-nueva').addEventListener('change', (e) => { A.nombrePedido = A.nombrePedido || null; alElegirFoto(e.target.files[0]); });
    GM.$('label.tarjeta.nueva').addEventListener('click', () => { A.nombrePedido = null; });
    const re = GM.debounce(reextraer, 120);
    ['#imp-umbral', '#imp-manchas'].forEach((s) => $(s).addEventListener('input', re));
    $('#imp-bordes').addEventListener('change', reextraer);
    GM.nube.alCambiar(pintarCuenta);
    $('#btn-cuenta').addEventListener('click', abrirCuenta);
    $('#cn-cerrar').addEventListener('click', () => { $('#modal-cuenta').hidden = true; });
    $('#cn-cerrar2').addEventListener('click', () => { $('#modal-cuenta').hidden = true; });
    $('#cn-enviar').addEventListener('click', async () => {
      const email = $('#cn-correo').value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { errorCuenta('Escribe un correo válido.'); return; }
      $('#cn-enviar').disabled = true;
      try {
        await GM.nube.enviarCodigo(email);
        $('#cn-error').hidden = true;
        $('#cn-paso2').hidden = false;
        $('#cn-codigo').focus();
      } catch (e) { errorCuenta('No se pudo enviar el correo: ' + e.message); }
      $('#cn-enviar').disabled = false;
    });
    $('#cn-entrar').addEventListener('click', async () => {
      const email = $('#cn-correo').value.trim(), codigo = $('#cn-codigo').value.replace(/\D/g, '');
      if (codigo.length < 6) { errorCuenta('El código tiene 6 números o más.'); return; }
      $('#cn-entrar').disabled = true;
      try {
        await GM.nube.verificarCodigo(email, codigo);
        $('#modal-cuenta').hidden = true;
        GM.aviso('¡Listo! Tus dibujos se guardan en la nube');
        sincronizar();
      } catch (e) { errorCuenta('Ese código no sirvió. Revisa el correo o pide otro. (' + e.message + ')'); }
      $('#cn-entrar').disabled = false;
    });
    $('#cn-sincronizar').addEventListener('click', () => { $('#modal-cuenta').hidden = true; sincronizar(); });
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
    if (!A.dibujos.length && !(await GM.store.leerAjuste('muestraCreada'))) {
      try {
        const m = await crearMuestra();
        A.dibujos.push(m);
        await persistir(m);
        await GM.store.guardarAjuste('muestraCreada', true);
      } catch (e) { console.warn('No se pudo cargar el ejemplo', e); }
    }
    A.actual = A.dibujos[0] || null;
    const h = (location.hash || '').slice(1);
    ir(['marcar', 'colorear', 'cuento'].includes(h) ? h : 'dibujos');
    if (GM.nube.correo()) sincronizar();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})(window.GM);
