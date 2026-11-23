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

  const guardando = new Map();
  function guardarLuego(d) {
    clearTimeout(guardando.get(d.id));
    guardando.set(d.id, setTimeout(() => { GM.store.guardar(d); guardando.delete(d.id); }, 700));
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
    await GM.store.guardar(d);
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
    GM.$$('.paso').forEach((b) => {
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
    await GM.store.guardar(d);
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
    GM.$$('.paso').forEach((b) => b.addEventListener('click', () => ir(b.dataset.ir)));
    $('#foto-nueva').addEventListener('change', (e) => { A.nombrePedido = A.nombrePedido || null; alElegirFoto(e.target.files[0]); });
    GM.$('label.tarjeta.nueva').addEventListener('click', () => { A.nombrePedido = null; });
    const re = GM.debounce(reextraer, 120);
    ['#imp-umbral', '#imp-manchas'].forEach((s) => $(s).addEventListener('input', re));
    $('#imp-bordes').addEventListener('change', reextraer);
    $('#dibujar-aqui').addEventListener('click', () => pedirNombreDibujo(''));
    $('#mn-cancelar').addEventListener('click', () => { $('#modal-nombre').hidden = true; });
    $('#mn-empezar').addEventListener('click', dibujoEnBlanco);
    $('#mn-nombre').addEventListener('keydown', (e) => { if (e.key === 'Enter') dibujoEnBlanco(); });
    $('#imp-cancelar').addEventListener('click', () => { A.imp = null; ir('dibujos'); });
    $('#imp-guardar').addEventListener('click', guardarImportacion);
    new ResizeObserver(() => { if (A.pantalla === 'importar') pintarImportacion(); }).observe($('#cv-importar').parentElement);

    // Pedir al navegador que no borre los dibujos guardados cuando le falte espacio
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* nada */ }
    A.dibujos = await GM.store.listar();
    A.dibujos.forEach((d) => { d.version = 1; d.tintaVer = 1; });
    if (!A.dibujos.length && !(await GM.store.leerAjuste('muestraCreada'))) {
      try {
        const m = await crearMuestra();
        A.dibujos.push(m);
        await GM.store.guardar(m);
        await GM.store.guardarAjuste('muestraCreada', true);
      } catch (e) { console.warn('No se pudo cargar el ejemplo', e); }
    }
    A.actual = A.dibujos[0] || null;
    const h = (location.hash || '').slice(1);
    ir(['marcar', 'colorear', 'cuento'].includes(h) ? h : 'dibujos');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})(window.GM);
