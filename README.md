# Garabato Mágico ✏️✨

Toma una foto de un dibujo en papel, marca sus partes con el dedo y míralo moverse en tu propio cuento.

Pensada para iPad. Funciona sin internet una vez cargada y sin IA: todo pasa en el navegador.

## Cómo se usa

1. **Dibujos**: toca «Dibujar aquí» para dibujar en la app (con el dedo o con Apple Pencil; si aprietas más, la línea sale más gruesa y la palma no raya), o «Nuevo dibujo» y toma una foto. La app quita el papel; con las barras ajustas si faltan líneas o sobran manchas. Ponle nombre.
2. **Marcar**: toca «Nueva parte», elige qué es (cabeza, ala, pierna, espada...) y márcala:
   - 🖌️ **Pintar** encima con el dedo
   - 🪄 **Tocar línea** para marcar un trazo completo
   - ⭕ **Encerrar** dibujando un círculo alrededor
   - 🧽 **Borrar marca** si te equivocas (o ↶ Deshacer)
   
   Con **🤸 Acomodar** puedes girar o mover cada parte con el dedo (por ejemplo, bajar las piernas al suelo). Esa postura es la que usa al empezar a moverse.

   El círculo blanco es el **clavito**: muévelo al lugar donde la parte se une al cuerpo (la cadera para una pierna, el hombro para un ala). Toca **▶ ¡Probar!** para verlo saltar, volar, bailar...
3. **Colorear**: rellena formas cerradas, usa el crayón, agrega líneas con el lápiz o borra. Lo que pintas se mueve con su parte.
4. **Cuento**: escribe tu historia. Cada oración es una escena. Palabras como *salta, vuela, corre, baila, espada, mira, duerme* mueven al personaje; *bosque, mar, noche, cielo, casa, montaña* cambian el fondo. Si nombras a alguien que todavía no dibujaste, la app te pide que lo dibujes.

## Abrirla en el iPad

Con GitHub Pages activado (Settings → Pages → rama `main`, carpeta `/ (root)`), la app queda en `https://dagonnet1988.github.io/garabato-magico/`. En Safari: Compartir → «Agregar a pantalla de inicio».

Los dibujos se guardan en el propio iPad. Ojo: Safari y el ícono de pantalla de inicio guardan por separado, así que conviene usar siempre el mismo.

## Guardar en la nube (para usar varios equipos)

La app ya está conectada a Supabase. En cada equipo:

1. Toca **☁️ Guardar en la nube** (arriba a la derecha).
2. La primera vez, escribe correo y contraseña y toca **Crear cuenta nueva**. Llega un correo de Supabase: toca el enlace para confirmar.
3. Vuelve a la app y toca **Entrar**. En los demás equipos, solo **Entrar** con el mismo correo y contraseña.

Para montar otro proyecto de Supabase: pega `supabase/esquema.sql` en el SQL Editor, pon la URL de la app como *Site URL* en Authentication → URL Configuration, y copia la Project URL y la clave publishable (o anon) en `js/config.js`.
