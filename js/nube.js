/* Guardado en la nube (Supabase), opcional. Sin dependencias: usa la API REST de Supabase con fetch.
   - La copia en el iPad (IndexedDB) sigue siendo la principal: la app funciona sin internet.
   - Con sesión iniciada, cada cambio se sube y al abrir la app se baja lo que cambió en otro equipo.
   - Si el mismo dibujo cambió en dos equipos, gana el cambio más reciente.
   Configuración en js/config.js (URL del proyecto y clave pública "anon"). */
(function (GM) {
  'use strict';
  const CFG = (GM.CONFIG && GM.CONFIG.supabase) || {};
  const URL_BASE = (CFG.url || '').replace(/\/+$/, '');
  const ANON = CFG.anon || '';
  const BUCKET = 'dibujos';
  const CLAVE_SESION = 'gm-sesion';
  let sesion = null;
  let estado = 'apagado'; // apagado | sin-sesion | sincronizando | listo | error
  const oyentes = new Set();
  const cola = new Map();

  function avisarEstado(e, detalle) {
    estado = e;
    oyentes.forEach((f) => { try { f(e, detalle); } catch (_) { /* nada */ } });
  }

  function leerSesion() {
    try { return JSON.parse(localStorage.getItem(CLAVE_SESION) || 'null'); } catch (e) { return null; }
  }
  function guardarSesion(s) {
    sesion = s;
    try { if (s) localStorage.setItem(CLAVE_SESION, JSON.stringify(s)); else localStorage.removeItem(CLAVE_SESION); } catch (e) { /* nada */ }
  }

  function desdeRespuestaAuth(r) {
    return {
      access_token: r.access_token,
      refresh_token: r.refresh_token,
      expires_at: Date.now() + (r.expires_in || 3600) * 1000,
      user: { id: r.user && r.user.id, email: r.user && r.user.email },
    };
  }

  async function pedir(ruta, opts) {
    const o = opts || {};
    const h = Object.assign({ apikey: ANON }, o.headers || {});
    if (o.auth !== false && sesion) h.Authorization = 'Bearer ' + sesion.access_token;
    const res = await fetch(URL_BASE + ruta, { method: o.method || 'GET', headers: h, body: o.body });
    if (!res.ok) {
      let msg = res.status + '';
      try { const j = await res.json(); msg = j.msg || j.message || j.error_description || j.error || msg; } catch (e) { /* nada */ }
      const err = new Error(msg); err.status = res.status; throw err;
    }
    return res;
  }

  async function asegurarToken() {
    if (!sesion) throw new Error('sin sesión');
    if (sesion.expires_at - Date.now() > 60000) return;
    const r = await pedir('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', auth: false, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: sesion.refresh_token }),
    });
    guardarSesion(desdeRespuestaAuth(await r.json()));
  }

  async function api(ruta, opts) {
    await asegurarToken();
    try { return await pedir(ruta, opts); } catch (e) {
      if (e.status === 401) { sesion.expires_at = 0; await asegurarToken(); return pedir(ruta, opts); }
      throw e;
    }
  }

  /* ---------- archivos ---------- */
  function ruta(id, archivo) { return sesion.user.id + '/' + id + '/' + archivo; }

  async function subir(id, archivo, blob) {
    await api('/storage/v1/object/' + BUCKET + '/' + ruta(id, archivo), {
      method: 'POST', headers: { 'Content-Type': 'image/png', 'x-upsert': 'true', 'cache-control': 'no-cache' }, body: blob,
    });
  }

  async function bajar(id, archivo) {
    const r = await api('/storage/v1/object/authenticated/' + BUCKET + '/' + ruta(id, archivo) + '?t=' + Date.now());
    return r.blob();
  }

  /** Las etiquetas (un número por píxel) viajan como PNG en el canal rojo: comprime muy bien. */
  function etiquetasACanvas(e, w, h) {
    const c = GM.crearCanvas(w, h), x = c.getContext('2d');
    const img = x.createImageData(w, h);
    for (let p = 0; p < w * h; p++) { img.data[p * 4] = e[p]; img.data[p * 4 + 3] = 255; }
    x.putImageData(img, 0, 0);
    return c;
  }
  async function blobAEtiquetas(blob, w, h) {
    const c = await GM.blobACanvas(blob, w, h);
    const d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    const e = new Uint8Array(w * h);
    for (let p = 0; p < w * h; p++) e[p] = d[p * 4];
    return e;
  }

  /* ---------- subir y bajar dibujos ---------- */
  async function subirDibujo(d) {
    await subir(d.id, 'tinta.png', await GM.canvasABlob(d.tinta));
    if (d.colorUsado) await subir(d.id, 'color.png', await GM.canvasABlob(d.color));
    await subir(d.id, 'etiquetas.png', await GM.canvasABlob(etiquetasACanvas(d.etiquetas, d.w, d.h)));
    await api('/rest/v1/dibujos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{
        id: d.id, nombre: d.nombre, w: d.w, h: d.h, partes: d.partes, color_usado: !!d.colorUsado,
        muestra: !!d.muestra, creado: d.creado || Date.now(), modificado: d.modificado || Date.now(), borrado: false,
      }]),
    });
  }

  async function bajarDibujo(fila) {
    const w = fila.w, h = fila.h;
    const tinta = await GM.blobACanvas(await bajar(fila.id, 'tinta.png'), w, h);
    const color = fila.color_usado ? await GM.blobACanvas(await bajar(fila.id, 'color.png'), w, h) : GM.crearCanvas(w, h);
    const etiquetas = await blobAEtiquetas(await bajar(fila.id, 'etiquetas.png'), w, h);
    return {
      id: fila.id, nombre: fila.nombre, w, h, tinta, color, colorUsado: !!fila.color_usado, etiquetas,
      partes: fila.partes || [], muestra: !!fila.muestra, creado: fila.creado, modificado: fila.modificado,
      version: 1, tintaVer: 1,
    };
  }

  async function marcarBorrado(id) {
    await api('/rest/v1/dibujos?id=eq.' + encodeURIComponent(id), {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ borrado: true, modificado: Date.now() }),
    });
    try {
      await api('/storage/v1/object/' + BUCKET, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes: ['tinta.png', 'color.png', 'etiquetas.png'].map((a) => ruta(id, a)) }),
      });
    } catch (e) { /* si no se pudo borrar el archivo, igual queda marcado como borrado */ }
  }

  /** Ajustes de la cuenta: el perfil y cada cuento (clave "cuento:<id>"). */
  async function subirAjuste(clave) {
    const valor = GM.app.valorAjuste(clave);
    if (!valor) return;
    await api('/rest/v1/ajustes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ clave, valor, modificado: valor.modificado || Date.now() }]),
    });
  }

  /* ---------- cola de cambios pendientes (sobrevive sin internet) ---------- */
  async function pendientes() { return (await GM.store.leerAjuste('nube-pendientes')) || {}; }
  async function guardarPendientes(p) { await GM.store.guardarAjuste('nube-pendientes', p); }

  async function vaciarCola() {
    if (!sesion || !navigator.onLine) return;
    const p = await pendientes();
    const ids = Object.keys(p);
    if (!ids.length) { avisarEstado('listo'); return; }
    avisarEstado('sincronizando');
    for (const id of ids) {
      try {
        if (p[id] === 'borrar') await marcarBorrado(id);
        else if (p[id] === 'ajuste') await subirAjuste(id.slice(3));
        else {
          const d = GM.app.dibujos().find((x) => x.id === id);
          if (d) await subirDibujo(d);
        }
        delete p[id];
        await guardarPendientes(p);
      } catch (e) {
        console.warn('No se pudo subir', id, e);
        avisarEstado('error', e.message);
        return;
      }
    }
    avisarEstado('listo');
  }

  const vaciarLuego = GM.debounce(vaciarCola, 800);

  /* ---------- API pública ---------- */
  GM.nube = {
    disponible: () => !!(URL_BASE && ANON),
    estado: () => estado,
    correo: () => (sesion && sesion.user && sesion.user.email) || '',
    alCambiar(f) { oyentes.add(f); f(estado); },

    async iniciar() {
      if (!this.disponible()) { avisarEstado('apagado'); return; }
      sesion = leerSesion();
      // Vuelta desde el enlace del correo: #access_token=...&refresh_token=...
      const h = location.hash || '';
      if (h.includes('access_token=')) {
        const q = new URLSearchParams(h.slice(1));
        const s = { access_token: q.get('access_token'), refresh_token: q.get('refresh_token'), expires_in: +q.get('expires_in') || 3600 };
        try {
          const r = await pedir('/auth/v1/user', { auth: false, headers: { Authorization: 'Bearer ' + s.access_token } });
          s.user = await r.json();
          guardarSesion(desdeRespuestaAuth(s));
        } catch (e) { console.warn('Enlace de inicio no válido', e); }
        try { history.replaceState(null, '', location.pathname); } catch (e) { /* nada */ }
      }
      avisarEstado(sesion ? 'listo' : 'sin-sesion');
      window.addEventListener('online', () => { if (sesion) this.sincronizar(); });
    },

    /** Entrar con correo y contraseña. */
    async entrar(email, clave) {
      const r = await pedir('/auth/v1/token?grant_type=password', {
        method: 'POST', auth: false, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: clave }),
      });
      guardarSesion(desdeRespuestaAuth(await r.json()));
      avisarEstado('listo');
    },

    /** Crear cuenta. Devuelve true si ya quedó con sesión, false si falta confirmar el correo. */
    async crearCuenta(email, clave) {
      const destino = location.origin + location.pathname;
      const r = await pedir('/auth/v1/signup?redirect_to=' + encodeURIComponent(destino), {
        method: 'POST', auth: false, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: clave }),
      });
      const j = await r.json();
      if (j.access_token) { guardarSesion(desdeRespuestaAuth(j)); avisarEstado('listo'); return true; }
      // Supabase responde sin error aunque el correo ya exista (por seguridad): sin identidades = ya registrado
      if (j.identities && j.identities.length === 0) throw new Error('already registered');
      return false;
    },

    async cerrarSesion() {
      try { if (sesion) await pedir('/auth/v1/logout', { method: 'POST' }); } catch (e) { /* nada */ }
      guardarSesion(null);
      avisarEstado('sin-sesion');
    },

    /** Avisar que un dibujo cambió (se sube en un momento). */
    usuario: () => (sesion && sesion.user && sesion.user.id) || '',

    async cambio(d) {
      if (!this.disponible() || !sesion) return;
      const p = await pendientes();
      p[d.id] = 'subir';
      await guardarPendientes(p);
      if (sesion) vaciarLuego();
    },

    async borrado(id) {
      if (!this.disponible() || !sesion) return;
      const p = await pendientes();
      p[id] = 'borrar';
      await guardarPendientes(p);
      if (sesion) vaciarLuego();
    },

    /** Sube todo lo pendiente ahora. Devuelve true si no quedó nada sin subir. */
    async subirTodo() {
      if (!sesion) return false;
      if (!navigator.onLine) return false;
      await vaciarCola();
      return Object.keys(await pendientes()).length === 0;
    },

    /** Olvida la cola de cambios (al quitar la copia de este equipo). */
    async limpiarPendientes() { await guardarPendientes({}); },

    /** Avisar que cambió un ajuste (perfil o un cuento). */
    async ajusteCambio(clave) {
      if (!this.disponible() || !sesion) return;
      const p = await pendientes();
      p['aj:' + clave] = 'ajuste';
      await guardarPendientes(p);
      if (sesion) vaciarLuego();
    },

    /**
     * Compara la nube con este equipo. Devuelve { nuevos: [dibujos bajados], borrados: [ids], ajustes: [filas] }.
     * La app decide cómo mostrarlos.
     */
    async sincronizar() {
      if (!sesion || !navigator.onLine) return null;
      avisarEstado('sincronizando');
      try {
        const r = await api('/rest/v1/dibujos?select=id,nombre,w,h,partes,color_usado,muestra,creado,modificado,borrado');
        const filas = await r.json();
        const locales = new Map(GM.app.dibujos().map((d) => [d.id, d]));
        const out = { nuevos: [], borrados: [], ajustes: [] };
        const hayMuestraRemota = filas.some((f) => f.muestra && !f.borrado);
        // el ejemplo de este equipo sobra solo si nadie lo cambió (si lo pintó, se queda)
        const sinTocar = (d) => d.muestra && !d.colorUsado && (d.modificado || 0) - (d.creado || 0) < 60000;
        for (const f of filas) {
          const l = locales.get(f.id);
          if (f.borrado) { if (l) out.borrados.push(f.id); continue; }
          if (!l || (f.modificado || 0) > (l.modificado || 0)) {
            out.nuevos.push(await bajarDibujo(f));
            const p = await pendientes(); if (p[f.id] === 'subir') { delete p[f.id]; await guardarPendientes(p); }
          }
          else if ((l.modificado || 0) > (f.modificado || 0)) await GM.nube.cambio(l);
        }
        const remotos = new Set(filas.map((f) => f.id));
        // El Parrot Ninja de ejemplo de este equipo sobra si la cuenta ya tiene el suyo
        if (hayMuestraRemota) {
          const p = await pendientes();
          locales.forEach((d) => {
            if (sinTocar(d) && !remotos.has(d.id)) { out.borrados.push(d.id); if (p[d.id] === 'subir') delete p[d.id]; }
          });
          await guardarPendientes(p);
        }
        // Dibujos de este equipo que la nube no tiene: subirlos
        for (const d of locales.values()) if (!remotos.has(d.id) && !(hayMuestraRemota && sinTocar(d))) await GM.nube.cambio(d);
        const ra = await api('/rest/v1/ajustes?select=clave,valor,modificado');
        out.ajustes = await ra.json();
        await vaciarCola();
        avisarEstado('listo');
        return out;
      } catch (e) {
        console.warn('Sincronización fallida', e);
        avisarEstado('error', e.message);
        return null;
      }
    },
  };
})(window.GM);
