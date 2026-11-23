-- Garabato Mágico: base de datos en Supabase.
-- Pegar completo en Supabase → SQL Editor → New query → Run. Se puede correr más de una vez.
-- Cada cuenta solo puede ver y cambiar sus propios dibujos (Row Level Security).

-- Dibujos: nombre, partes marcadas y posturas. Las imágenes van en Storage.
create table if not exists public.dibujos (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre      text not null,
  w           integer not null,
  h           integer not null,
  partes      jsonb not null default '[]'::jsonb,
  color_usado boolean not null default false,
  muestra     boolean not null default false,
  creado      bigint not null,
  modificado  bigint not null,
  borrado     boolean not null default false
);
create index if not exists dibujos_user_idx on public.dibujos (user_id);

-- Ajustes de la cuenta (por ahora: el cuento).
create table if not exists public.ajustes (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  clave      text not null,
  valor      jsonb,
  modificado bigint not null,
  primary key (user_id, clave)
);

alter table public.dibujos enable row level security;
alter table public.ajustes enable row level security;

drop policy if exists "dibujos propios" on public.dibujos;
create policy "dibujos propios" on public.dibujos
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "ajustes propios" on public.ajustes;
create policy "ajustes propios" on public.ajustes
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Storage: carpeta privada por cuenta → <user_id>/<dibujo_id>/tinta.png, color.png, etiquetas.png
insert into storage.buckets (id, name, public)
values ('dibujos', 'dibujos', false)
on conflict (id) do nothing;

drop policy if exists "archivos propios" on storage.objects;
create policy "archivos propios" on storage.objects
  for all to authenticated
  using (bucket_id = 'dibujos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'dibujos' and (storage.foldername(name))[1] = auth.uid()::text);
