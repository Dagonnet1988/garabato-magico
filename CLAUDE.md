# Garabato Mágico

App web para que una niña fotografíe sus dibujos en papel, marque sus partes con el dedo y los vea moverse dentro de un cuento que ella misma escribe. Se usa sobre todo en un **iPad** (Safari). La interfaz y el código están en **español**.

## Versión 1: sin IA

- Todo corre en el navegador del iPad, sin IA y sin costos. La única conexión opcional es la nube (Supabase, plan gratis) para usar los mismos dibujos en varios equipos.
- La niña **marca cada parte a mano** (cabeza, ojo, ala, pierna, espada...). Esto reemplaza la segmentación automática con IA del prototipo.
- El cuento lo escribe ella. Las escenas, acciones y fondos salen de reglas con palabras clave, no de un modelo.
- Si el cuento nombra a alguien sin dibujo (mamá, perro, un nombre propio), la app le pide que lo dibuje y le tome una foto. Esto es preferible a generar imágenes.

## Cómo está hecho

- HTML + CSS + JavaScript plano, **sin build ni dependencias**. Los scripts son clásicos (no módulos) y comparten el objeto global `GM`, así la app abre incluso desde `file://`.
- Para probar en local: `python3 -m http.server` en la raíz y abrir `http://localhost:8000`.
- Publicación pensada para **GitHub Pages** (rama `main`, carpeta raíz) para abrirla en el iPad y "Agregar a pantalla de inicio".
- Los dibujos se guardan en **IndexedDB** del propio iPad (`js/store.js`); es la copia principal y funciona sin internet.
- **Nube opcional (Supabase)**: `js/config.js` lleva la URL del proyecto y la clave pública `anon` (vacía = solo local). `js/nube.js` habla con la API REST de Supabase con `fetch` (sin librería): inicio de sesión con correo y contraseña (sirve dentro del ícono de pantalla de inicio; el plan gratis no deja editar el correo de código sin SMTP propio), subida de cambios con cola pendiente que sobrevive sin internet, y al abrir baja lo más nuevo (gana el `modificado` mayor). El esquema y los permisos (RLS por cuenta) están en `supabase/esquema.sql`. Nunca poner la clave `service_role` en el código.

| Archivo | Qué hace |
|---|---|
| `index.html` | Pantallas: Cuentos, Dibujos (del cuento), Importar, Marcar, Colorear, Historia, y los modales (partes, cuento nuevo, dibujo que ya tengo, perfil, cuenta) |
| `css/app.css` | Estilos (tokens de color en `:root`, modo oscuro, objetivos táctiles de 48px o más) |
| `js/util.js` | Ayudas: `GM.$`, matrices 2D, componentes conexas, avisos |
| `js/store.js` | Guardado en IndexedDB con respaldo en memoria |
| `js/imagen.js` | Foto → quita el papel (estima el color del papel por bloques), limpia manchas, recorta |
| `js/lienzo.js` | Lienzo táctil: un dedo dibuja, dos dedos hacen zoom y mueven; con `mantenerParaMover`, dedo quieto un momento y arrastrar mueve la hoja (mouse: botón derecho). Con Apple Pencil: presión, y los dedos/palma no dibujan (salvo rellenar) |
| `js/marcar.js` | Marcar partes: pintar, tocar línea (varita), encerrar (lazo), borrar marca, clavito (pivote) arrastrable, deshacer, modo prueba |
| `js/rig.js` | Catálogo de partes (`GM.TIPOS`), movimientos (`GM.MOVS`), acciones (`GM.ACCIONES`); arma el esqueleto 2D (padres, pivotes) y anima |
| `js/colorear.js` | Rellenar formas cerradas, crayón, lápiz (agrega líneas), borrador |
| `js/cuento.js` | Pantalla Historia del cuento actual: divide el texto en escenas, detecta acciones/lugares/personajes faltantes, dibuja la escena y lee en voz alta |
| `js/muestra.js` | Dibujo de ejemplo Parrot Ninja con sus partes ya marcadas |
| `js/app.js` | Arranque, cuentos (lista, migración del cuento único), galería del cuento, perfil, importar foto, cuenta en la nube, sincronización automática y navegación |
| `js/config.js` | URL y clave pública de Supabase (vacío = sin nube) |
| `js/nube.js` | Sincronización con Supabase: sesión con correo y contraseña, cola de cambios, subir/bajar dibujos y cuento |
| `supabase/esquema.sql` | Tablas `dibujos` y `ajustes`, bucket `dibujos` y reglas RLS |

### Cuentos y perfil

- Ajuste local `cuentos`: lista de `{ id, titulo, texto, protagonista, dibujos: [ids], creado, modificado, borrado? }`. Un dibujo puede estar en varios cuentos; borrar un cuento deja sus dibujos (se recuperan con «Un dibujo que ya tengo»).
- El primer cuento migrado del cuento único anterior usa el id fijo `primero`, para que dos equipos no lo dupliquen.
- Ajuste `perfil`: `{ nombre, modificado }` → título «Garabato Mágico de …».
- En la nube, cada cuento es una fila de `ajustes` con clave `cuento:<id>`, y el perfil la clave `perfil`. Gana el `modificado` mayor. La cola de pendientes usa `aj:<clave>`.
- La app revisa la nube al abrir, al volver a la pestaña o ícono (`visibilitychange`) y cada minuto.

### Modelo de datos de un dibujo

`{ id, nombre, w, h, tinta: canvas, color: canvas, colorUsado, etiquetas: Uint8Array(w*h), partes: [{ id, tipo, nombre, emoji, color, mov, pivote|null }] }`

- `etiquetas[p]` = id de la parte dueña del píxel (0 = sin marcar, se mueve con todo el cuerpo).
- Al armar el esqueleto, el interior de una figura cerrada hereda la etiqueta de su contorno, para que el color pintado se mueva con la parte.
- `reposo: {r, dx, dy}` en una parte es la postura que la niña acomoda con el dedo (modo «Acomodar»). Al tocar «Listo», `GM.hornear(d)` la deja fija: mueve tinta, color y marcas, recoloca los clavitos y borra `reposo`, así se ve igual en Marcar, Colorear y la galería (se puede deshacer en Marcar).
- `unida` en una parte: id de la parte a la que está pegada, `'nada'`, o vacío = automático. Lo que se agarra (espada) busca el ala, brazo o mano más cercana; en la acción «espada» esa ala o brazo da el golpe.
- Cada parte con color lleva un `relleno` (color de alrededor, sin cruzar líneas) que se dibuja con su padre para tapar el hueco cuando la parte se mueve.
- Pedacitos de línea sin marcar que tocan una parte y son pequeños (menos del 4% de la tinta) pasan a esa parte al armar el esqueleto (`absorberRestos`), para que no queden rayas quietas al moverse.
- El padre de una parte es la parte más grande con la que se toca; el pivote automático es el punto de la parte más cercano al centro de su padre. La niña puede mover el clavito.

## Reglas para trabajar aquí

- Escribir la interfaz, los comentarios y los nombres en español, con palabras que entienda una niña.
- Todo debe funcionar con el dedo en iPad: botones grandes, `touch-action: none` en los lienzos, nada que dependa de pasar el mouse.
- Mantener la app sin build y sin dependencias externas salvo Google Fonts.
- Probar en tamaño iPad horizontal (1180x820) y vertical (820x1180).

## Ideas para después (no v1)

- **IA opcional**: el dueño ya tiene una clave de la API de Claude de otra app que se puede reutilizar. La clave **nunca** va en el código web: debe vivir en un servidor pequeño (por ejemplo una función serverless) con límite de gasto diario. Usos previstos: sugerir las partes de un dibujo nuevo, ayudar con el cuento, generar personajes al estilo de la niña. El costo importa porque las sesiones de una niña pueden ser largas.
- Varios cuentos guardados, grabar la voz de la niña, exportar el cuento como video.
