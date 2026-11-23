/* Guardado local en el iPad (IndexedDB). Si el navegador no lo permite, todo sigue funcionando en memoria. */
(function (GM) {
  'use strict';
  const DB = 'garabato-magico', VER = 1;
  let dbPromesa = null;
  const memoria = { dibujos: new Map(), ajustes: new Map() };

  function abrir() {
    if (dbPromesa) return dbPromesa;
    dbPromesa = new Promise((res) => {
      try {
        const req = indexedDB.open(DB, VER);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('dibujos')) db.createObjectStore('dibujos', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('ajustes')) db.createObjectStore('ajustes');
        };
        req.onsuccess = () => res(req.result);
        req.onerror = () => res(null);
        req.onblocked = () => res(null);
      } catch (e) { res(null); }
    });
    return dbPromesa;
  }

  function tx(db, store, modo, fn) {
    return new Promise((res) => {
      try {
        const t = db.transaction(store, modo);
        const r = fn(t.objectStore(store));
        t.oncomplete = () => res(r && 'result' in r ? r.result : true);
        t.onerror = () => res(null);
        t.onabort = () => res(null);
      } catch (e) { res(null); }
    });
  }

  /** Convierte un dibujo en memoria (con canvases) a un registro guardable. */
  async function aRegistro(d) {
    return {
      id: d.id, nombre: d.nombre, w: d.w, h: d.h, creado: d.creado, modificado: Date.now(),
      tinta: await GM.canvasABlob(d.tinta),
      color: d.colorUsado ? await GM.canvasABlob(d.color) : null,
      etiquetas: d.etiquetas,
      partes: d.partes,
      muestra: !!d.muestra,
    };
  }

  async function deRegistro(r) {
    return {
      id: r.id, nombre: r.nombre, w: r.w, h: r.h, creado: r.creado, modificado: r.modificado,
      tinta: await GM.blobACanvas(r.tinta, r.w, r.h),
      color: await GM.blobACanvas(r.color, r.w, r.h),
      colorUsado: !!r.color,
      etiquetas: r.etiquetas instanceof Uint8Array ? r.etiquetas : new Uint8Array(r.etiquetas),
      partes: r.partes || [],
      muestra: !!r.muestra,
    };
  }

  GM.store = {
    async listar() {
      const db = await abrir();
      let regs;
      if (db) regs = await tx(db, 'dibujos', 'readonly', (s) => s.getAll());
      if (!regs) regs = Array.from(memoria.dibujos.values());
      const out = [];
      for (const r of regs) {
        try { out.push(await deRegistro(r)); } catch (e) { console.warn('Dibujo dañado', e); }
      }
      return out.sort((a, b) => a.creado - b.creado);
    },
    async guardar(d) {
      const r = await aRegistro(d);
      memoria.dibujos.set(r.id, r);
      const db = await abrir();
      if (db) await tx(db, 'dibujos', 'readwrite', (s) => s.put(r));
    },
    async borrar(id) {
      memoria.dibujos.delete(id);
      const db = await abrir();
      if (db) await tx(db, 'dibujos', 'readwrite', (s) => s.delete(id));
    },
    async leerAjuste(clave) {
      const db = await abrir();
      if (db) {
        const v = await tx(db, 'ajustes', 'readonly', (s) => s.get(clave));
        if (v !== null && v !== undefined) return v;
      }
      return memoria.ajustes.get(clave);
    },
    async guardarAjuste(clave, valor) {
      memoria.ajustes.set(clave, valor);
      const db = await abrir();
      if (db) await tx(db, 'ajustes', 'readwrite', (s) => s.put(valor, clave));
    },
  };
})(window.GM);
