-- Base de conocimiento del chatbot del Encuentro Mundial de Valores.
-- Pega este archivo completo en Supabase → SQL Editor → Run.

create table if not exists conocimiento (
  id             bigint generated always as identity primary key,
  categoria      text        not null default 'general',
  pregunta       text        not null,
  respuesta      text        not null,
  activo         boolean     not null default true,
  orden          integer     not null default 0,
  actualizado_en timestamptz not null default now()
);

comment on table conocimiento is
  'Lo único que el chatbot puede afirmar. Si no está aquí, responde que no sabe.';
comment on column conocimiento.activo is
  'Desactiva una respuesta sin borrarla. Útil para datos que aún no son públicos.';
comment on column conocimiento.orden is
  'Las de menor número se envían primero al modelo.';

create index if not exists conocimiento_activo_orden_idx
  on conocimiento (activo, orden);

-- Mantiene actualizado_en al día sin que nadie tenga que acordarse
create or replace function tocar_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

drop trigger if exists conocimiento_actualizado_en on conocimiento;
create trigger conocimiento_actualizado_en
  before update on conocimiento
  for each row execute function tocar_actualizado_en();

-- Seguridad: el backend entra con la llave anónima, no con la de servicio.
-- Así, si esa llave se filtra, lo peor que puede pasar es que alguien lea
-- información que de todos modos el bot publica. No puede escribir ni borrar.
alter table conocimiento enable row level security;

drop policy if exists "lectura publica de lo activo" on conocimiento;
create policy "lectura publica de lo activo"
  on conocimiento
  for select
  using (activo = true);
