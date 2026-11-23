/* Procesa la foto de un dibujo en papel: estima el color del papel, quita el fondo,
   limpia manchas y recorta. Todo local, sin IA. */
(function (GM) {
  'use strict';
  const MAX_ENTRADA = 1400;   // lado máximo al analizar
  const MAX_SALIDA = 900;     // lado máximo del dibujo final

  /** Paso 1 (lento, una vez por foto): lee píxeles y estima el papel por bloques. */
  GM.imagen = {};
  GM.imagen.analizar = function (img) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const k = Math.min(1, MAX_ENTRADA / Math.max(iw, ih));
    const w = Math.round(iw * k), h = Math.round(ih * k);
    const c = GM.crearCanvas(w, h);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data;

    // Color de papel por bloque: promedio de los píxeles más claros (percentil 80).
    const B = Math.max(10, Math.round(Math.max(w, h) / 36));
    const gw = Math.ceil(w / B), gh = Math.ceil(h / B);
    const fr = new Float32Array(gw * gh), fg = new Float32Array(gw * gh), fb = new Float32Array(gw * gh);
    const hist = new Uint32Array(256);
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        hist.fill(0);
        const x0 = gx * B, y0 = gy * B, x1 = Math.min(w, x0 + B), y1 = Math.min(h, y0 + B);
        let total = 0;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
          const i = (y * w + x) * 4;
          hist[(px[i] * 77 + px[i + 1] * 150 + px[i + 2] * 29) >> 8]++; total++;
        }
        let acum = 0, corte = 255;
        for (let v = 255; v >= 0; v--) { acum += hist[v]; if (acum >= total * 0.2) { corte = v; break; } }
        let sr = 0, sg = 0, sb = 0, n = 0;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
          const i = (y * w + x) * 4;
          if (((px[i] * 77 + px[i + 1] * 150 + px[i + 2] * 29) >> 8) >= corte) { sr += px[i]; sg += px[i + 1]; sb += px[i + 2]; n++; }
        }
        const g = gy * gw + gx;
        fr[g] = sr / n; fg[g] = sg / n; fb[g] = sb / n;
      }
    }

    // "Fuerza de tinta" por píxel, comparando con el papel interpolado.
    const fuerza = new Float32Array(w * h);
    const norm = new Uint8ClampedArray(w * h * 3);
    for (let y = 0; y < h; y++) {
      let gyf = (y + 0.5) / B - 0.5; if (gyf < 0) gyf = 0; if (gyf > gh - 1) gyf = gh - 1;
      const gy0 = Math.floor(gyf), gy1 = Math.min(gh - 1, gy0 + 1), ty = gyf - gy0;
      for (let x = 0; x < w; x++) {
        let gxf = (x + 0.5) / B - 0.5; if (gxf < 0) gxf = 0; if (gxf > gw - 1) gxf = gw - 1;
        const gx0 = Math.floor(gxf), gx1 = Math.min(gw - 1, gx0 + 1), tx = gxf - gx0;
        const a = gy0 * gw + gx0, b = gy0 * gw + gx1, c2 = gy1 * gw + gx0, d = gy1 * gw + gx1;
        const w00 = (1 - tx) * (1 - ty), w01 = tx * (1 - ty), w10 = (1 - tx) * ty, w11 = tx * ty;
        const br = fr[a] * w00 + fr[b] * w01 + fr[c2] * w10 + fr[d] * w11;
        const bg = fg[a] * w00 + fg[b] * w01 + fg[c2] * w10 + fg[d] * w11;
        const bb = fb[a] * w00 + fb[b] * w01 + fb[c2] * w10 + fb[d] * w11;
        const p = y * w + x, i = p * 4;
        const nr = Math.min(1, px[i] / Math.max(1, br));
        const ng = Math.min(1, px[i + 1] / Math.max(1, bg));
        const nb = Math.min(1, px[i + 2] / Math.max(1, bb));
        const nl = 0.299 * nr + 0.587 * ng + 0.114 * nb;
        const sat = Math.max(nr, ng, nb) - Math.min(nr, ng, nb);
        fuerza[p] = Math.max(1 - nl, sat * 0.9);
        // color limpio: más oscuro y con más contraste
        norm[p * 3] = 255 * nr;
        norm[p * 3 + 1] = 255 * ng;
        norm[p * 3 + 2] = 255 * nb;
      }
    }
    return { w, h, fuerza, norm };
  };

  /**
   * Paso 2 (rápido, se repite al mover las barras).
   * opts: umbral (0..1), manchas (px mínimos), quitarBordes (bool)
   * Devuelve { w, h, tinta: canvas RGBA, transf: {ox, oy, k} } donde salida = (fuente - o) * k
   */
  GM.imagen.extraer = function (f, opts) {
    const { w, h, fuerza, norm } = f;
    const umbral = opts.umbral;
    const mask = new Uint8Array(w * h);
    for (let p = 0; p < w * h; p++) mask[p] = fuerza[p] > umbral ? 1 : 0;
    const comp = GM.componentes(mask, w, h);
    const escala = (w * h) / (1400 * 1050);
    const minArea = Math.max(3, Math.round(opts.manchas * escala));
    const guardar = new Uint8Array(comp.n);
    for (let i = 0; i < comp.n; i++) {
      guardar[i] = comp.areas[i] >= minArea && !(opts.quitarBordes && comp.tocaBorde[i]) ? 1 : 0;
    }
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let i = 0; i < comp.n; i++) {
      if (!guardar[i]) continue;
      const c = comp.cajas[i];
      if (c[0] < x0) x0 = c[0]; if (c[1] < y0) y0 = c[1]; if (c[2] > x1) x1 = c[2]; if (c[3] > y1) y1 = c[3];
    }
    if (x1 < 0) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }
    const margen = Math.round(Math.max(x1 - x0, y1 - y0) * 0.05) + 8;
    x0 = Math.max(0, x0 - margen); y0 = Math.max(0, y0 - margen);
    x1 = Math.min(w - 1, x1 + margen); y1 = Math.min(h - 1, y1 + margen);
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1;

    const full = GM.crearCanvas(cw, ch);
    const fctx = full.getContext('2d');
    const id = fctx.createImageData(cw, ch);
    const d = id.data;
    const suave = 0.16;
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const p = (y + y0) * w + (x + x0), o = (y * cw + x) * 4;
        const cid = comp.ids[p];
        // borde suave: píxeles algo por debajo del umbral junto a un trazo guardado
        let ok = cid >= 0 && guardar[cid];
        let s = fuerza[p];
        if (!ok && s > umbral * 0.6) {
          for (let k2 = 0; k2 < 4 && !ok; k2++) {
            const q = k2 === 0 ? p - 1 : k2 === 1 ? p + 1 : k2 === 2 ? p - w : p + w;
            if (q >= 0 && q < w * h && comp.ids[q] >= 0 && guardar[comp.ids[q]]) ok = true;
          }
        }
        if (!ok) continue;
        const a = Math.max(0.04, Math.min(1, (s - umbral * 0.6) / suave));
        const r0 = norm[p * 3], g0 = norm[p * 3 + 1], b0 = norm[p * 3 + 2];
        const sat = (Math.max(r0, g0, b0) - Math.min(r0, g0, b0)) / 255;
        if (sat < 0.16) {
          // lápiz o plumón oscuro: gris grafito parejo; la suavidad la da el alfa
          d[o] = 52; d[o + 1] = 52; d[o + 2] = 60;
        } else {
          // color (crayón, marcador): "des-mezclar" del papel para no dejar borde blanco
          for (let k3 = 0; k3 < 3; k3++) {
            const v = 255 - (255 - norm[p * 3 + k3]) / Math.max(a, 0.35);
            d[o + k3] = Math.max(0, Math.min(255, v));
          }
        }
        d[o + 3] = Math.round(255 * a);
      }
    }
    fctx.putImageData(id, 0, 0);

    const k = Math.min(1, MAX_SALIDA / Math.max(cw, ch));
    const ow = Math.max(1, Math.round(cw * k)), oh = Math.max(1, Math.round(ch * k));
    let tinta = full;
    if (k < 1) {
      tinta = GM.crearCanvas(ow, oh);
      const tctx = tinta.getContext('2d');
      tctx.imageSmoothingQuality = 'high';
      tctx.drawImage(full, 0, 0, ow, oh);
    }
    return { w: ow, h: oh, tinta, transf: { ox: x0, oy: y0, k } };
  };

  /** Máscara binaria de tinta (alfa > corte) de un canvas. */
  GM.imagen.mascara = function (canvas, corte) {
    const w = canvas.width, h = canvas.height;
    const d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    const m = new Uint8Array(w * h);
    const c = corte === undefined ? 70 : corte;
    for (let p = 0; p < w * h; p++) m[p] = d[p * 4 + 3] > c ? 1 : 0;
    return m;
  };
})(window.GM);
