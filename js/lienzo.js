/* Lienzo con zoom: un dedo dibuja, dos dedos acercan y mueven (como en el iPad). */
(function (GM) {
  'use strict';

  class Lienzo {
    constructor(canvas, o) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.o = o;
      this.vista = { s: 1, x: 0, y: 0 };
      this.dpr = 1;
      this.punteros = new Map();
      this.gesto = null;
      this.trazando = false;
      this.pendiente = false;
      this.ajustado = false;
      new ResizeObserver(() => this.redimensionar()).observe(canvas.parentElement);
      canvas.addEventListener('pointerdown', (e) => this.abajo(e));
      canvas.addEventListener('pointermove', (e) => this.mover(e));
      canvas.addEventListener('pointerup', (e) => this.arriba(e));
      canvas.addEventListener('pointercancel', (e) => this.arriba(e, true));
      canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const r = this.cv.getBoundingClientRect();
        this.zoomEn(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
      }, { passive: false });
    }

    redimensionar() {
      const r = this.cv.parentElement.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      this.cv.width = Math.round(r.width * this.dpr);
      this.cv.height = Math.round(r.height * this.dpr);
      this.anchoCss = r.width; this.altoCss = r.height;
      if (!this.ajustado) this.ajustar(); else this.pedir();
    }

    ajustar() {
      const t = this.o.tamano();
      if (!t || !this.anchoCss) return;
      const pad = 24;
      const s = Math.min((this.anchoCss - pad * 2) / t.w, (this.altoCss - pad * 2) / t.h);
      this.vista.s = s;
      this.vista.x = (this.anchoCss - t.w * s) / 2;
      this.vista.y = (this.altoCss - t.h * s) / 2;
      this.ajustado = true;
      this.pedir();
    }

    zoomEn(f, cx, cy) {
      const v = this.vista, t = this.o.tamano();
      const base = Math.min(this.anchoCss / t.w, this.altoCss / t.h);
      const ns = Math.max(base * 0.5, Math.min(base * 8, v.s * f));
      f = ns / v.s;
      v.x = cx - (cx - v.x) * f;
      v.y = cy - (cy - v.y) * f;
      v.s = ns;
      this.pedir();
    }

    zoom(f) { this.zoomEn(f, this.anchoCss / 2, this.altoCss / 2); }

    /** Píxeles del dibujo que ocupa un píxel CSS. */
    pxPorCss() { return 1 / this.vista.s; }

    aDibujo(clientX, clientY) {
      const r = this.cv.getBoundingClientRect();
      return { x: (clientX - r.left - this.vista.x) / this.vista.s, y: (clientY - r.top - this.vista.y) / this.vista.s };
    }

    aPantalla(x, y) { return { x: x * this.vista.s + this.vista.x, y: y * this.vista.s + this.vista.y }; }

    pedir() {
      if (this.pendiente) return;
      this.pendiente = true;
      requestAnimationFrame(() => { this.pendiente = false; this.pintar(); });
    }

    pintar() {
      const c = this.ctx, v = this.vista, d = this.dpr;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, this.cv.width, this.cv.height);
      c.setTransform(d * v.s, 0, 0, d * v.s, d * v.x, d * v.y);
      this.o.dibujar(c, this);
      if (this.o.encima) { c.setTransform(d, 0, 0, d, 0, 0); this.o.encima(c, this); }
    }

    abajo(e) {
      e.preventDefault();
      try { this.cv.setPointerCapture(e.pointerId); } catch (_) { /* nada */ }
      this.punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.punteros.size === 2) {
        if (this.trazando) { this.trazando = false; this.o.alTocar && this.o.alTocar.cancelar && this.o.alTocar.cancelar(); }
        const [a, b] = Array.from(this.punteros.values());
        this.gesto = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
        return;
      }
      if (this.punteros.size > 2 || this.gesto) return;
      if (this.o.alTocar && this.o.alTocar.inicio) {
        this.trazando = this.o.alTocar.inicio(this.aDibujo(e.clientX, e.clientY), e) !== false;
      }
    }

    mover(e) {
      if (!this.punteros.has(e.pointerId)) return;
      this.punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.gesto && this.punteros.size >= 2) {
        const [a, b] = Array.from(this.punteros.values());
        const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const r = this.cv.getBoundingClientRect();
        this.vista.x += mx - this.gesto.mx; this.vista.y += my - this.gesto.my;
        if (this.gesto.d > 10) this.zoomEn(d / this.gesto.d, mx - r.left, my - r.top);
        this.gesto = { d, mx, my };
        this.pedir();
        return;
      }
      if (this.trazando && this.o.alTocar.mover) {
        const ev = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        for (const ce of (ev.length ? ev : [e])) this.o.alTocar.mover(this.aDibujo(ce.clientX, ce.clientY), ce);
      }
    }

    arriba(e, cancelado) {
      if (!this.punteros.has(e.pointerId)) return;
      this.punteros.delete(e.pointerId);
      if (this.gesto) { if (this.punteros.size === 0) this.gesto = null; return; }
      if (this.trazando) {
        this.trazando = false;
        if (cancelado && this.o.alTocar.cancelar) this.o.alTocar.cancelar();
        else if (this.o.alTocar.fin) this.o.alTocar.fin(this.aDibujo(e.clientX, e.clientY), e);
      }
    }
  }

  GM.Lienzo = Lienzo;
})(window.GM);
