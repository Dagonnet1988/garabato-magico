# Garabato Mágico ✏️✨

Toma una foto de un dibujo en papel, marca sus partes con el dedo y míralo moverse en tu propio cuento.

Pensada para iPad. Funciona sin internet una vez cargada y sin IA: todo pasa en el navegador.

## Cómo se usa

1. **Dibujos**: toca «Nuevo dibujo» y toma una foto. La app quita el papel; con las barras ajustas si faltan líneas o sobran manchas. Ponle nombre.
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

Los dibujos se guardan en el propio iPad (no hace falta base de datos). Ojo: Safari y el ícono de pantalla de inicio guardan por separado, así que conviene usar siempre el mismo.

## Probar en el computador

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

No hay que instalar nada: es HTML, CSS y JavaScript sin build.
