/* Configuración de la nube (Supabase). Si está vacía, la app guarda solo en este equipo.
   La clave "anon" es pública: puede ir aquí porque las reglas de la base (supabase/esquema.sql)
   solo dejan ver los dibujos de cada cuenta. Nunca poner aquí la clave "service_role" ni la de Claude. */
window.GM = window.GM || {};
GM.CONFIG = {
  supabase: {
    url: 'https://evkivmndzjwdiojmuqvh.supabase.co',
    anon: 'sb_publishable_ly1gD1cmvqv-LHSzCQgdTA_nxTrWmQ7', // clave pública (publishable / anon)
  },
};
