/* Guardado local en el iPad (IndexedDB). Si el navegador no lo permite, todo sigue funcionando en memoria.
   Hay dos espacios separados: el de la cuenta en la nube ('cuenta') y el de usar sin cuenta ('local').
   Así lo que se hace sin cuenta no se mezcla con ninguna cuenta. */
(function (GM) {
  'use strict';
  const BASES = { cuenta: 'garabato-magico', local: 'garabato-magico-sin-cuenta' };
  let DB = BASES.cuenta;
  const VER = 1;
  let dbPromesa = null;
  let memoria = { dibujos: new Map(), ajustes: new Map() };

  function abrir() {
    if (dbPromesa) return dbPromesa;
    const nombre = DB;
    dbPromesa = new Promise((res) => {
      try {
        const req = indexedDB.open(nombre, VER);
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
      id: d.id, nombre: d.nombre, w: d.w, h: d.h, creado: d.creado, modificado: d.modificado || Date.now(),
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
    /** Cambia de espacio: 'cuenta' o 'local'. */
    espacio(e) {
      const nombre = BASES[e] || BASES.cuenta;
      if (nombre === DB) return;
      DB = nombre; dbPromesa = null;
      memoria = { dibujos: new Map(), ajustes: new Map() };
    },
    /** ¿Hay algo guardado en este espacio? */
    async tieneAlgo() {
      const db = await abrir();
      const n = db ? await tx(db, 'dibujos', 'readonly', (s) => s.count()) : memoria.dibujos.size;
      const cs = await this.leerAjuste('cuentos');
      return !!n || (Array.isArray(cs) && cs.some((c) => !c.borrado));
    },
    /** Borra todo lo de este espacio. */
    async vaciar() {
      memoria = { dibujos: new Map(), ajustes: new Map() };
      const db = await abrir();
      if (db) { await tx(db, 'dibujos', 'readwrite', (s) => s.clear()); await tx(db, 'ajustes', 'readwrite', (s) => s.clear()); }
    },
    /** Copia todo lo de este espacio al otro (sin la cola de la nube) y lo borra de aquí. */
    async moverA(e) {
      const db = await abrir();
      if (!db) return;
      const regs = (await tx(db, 'dibujos', 'readonly', (s) => s.getAll())) || [];
      const claves = (await tx(db, 'ajustes', 'readonly', (s) => s.getAllKeys())) || [];
      const ajustes = [];
      for (const k of claves) if (k !== 'nube-pendientes' && k !== 'duenio') ajustes.push([k, await this.leerAjuste(k)]);
      const antes = DB;
      this.espacio(e);
      const otra = await abrir();
      if (otra) {
        for (const r of regs) await tx(otra, 'dibujos', 'readwrite', (s) => s.put(r));
        for (const [k, v] of ajustes) await tx(otra, 'ajustes', 'readwrite', (s) => s.put(v, k));
      }
      DB = null; this.espacio(Object.keys(BASES).find((x) => BASES[x] === antes));
      await this.vaciar();
    },
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
