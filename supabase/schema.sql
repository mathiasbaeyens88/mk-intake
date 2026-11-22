-- =====================================================================
--  MK Soundsystem · DJ-intake · databaseschema voor Supabase
--  Plak dit hele bestand in Supabase -> SQL Editor -> Run.
--  Je mag het veilig opnieuw uitvoeren.
--
--  Beveiligingsmodel (kort):
--   * Niemand kan de tabellen rechtstreeks lezen of schrijven (ook niet met de
--     publieke sleutel in de website). Alle toegang loopt via functies.
--   * De klant heeft geen account. Hij heeft een lange, geheime code in zijn link
--     (160 bit, niet te raden). Daarmee kan hij ENKEL zijn eigen dossier lezen en
--     ENKEL zijn eigen velden invullen, en alleen zolang het niet bevestigd is.
--   * Alles voor de beheerder (jij) vereist een login EN dat je e-mailadres in de
--     tabel "admins" staat.
-- =====================================================================

-- ---------- tabellen ----------------------------------------------------------

create table if not exists public.admins (
  email text primary key
);

create or replace function public.new_client_token() returns text
language sql volatile set search_path = public, pg_temp as $$
  select substr(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 1, 40);
$$;

create table if not exists public.dossiers (
  id           uuid primary key default gen_random_uuid(),
  client_token text not null unique default public.new_client_token(),
  client_name  text not null default 'Naamloze klant',
  status       text not null default 'draft' check (status in ('draft', 'submitted')),
  admin_seen   boolean not null default true,
  submitted_at timestamptz,
  version      bigint not null default 1,
  dj           jsonb not null default '{}'::jsonb,
  client       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.blocked_days (
  day        date primary key,
  reason     text not null default '',
  grp        text not null default '',
  created_at timestamptz not null default now()
);

-- Rijbeveiliging aan zonder enige regel = niemand komt er rechtstreeks aan.
alter table public.admins       enable row level security;
alter table public.dossiers     enable row level security;
alter table public.blocked_days enable row level security;
revoke all on public.admins, public.dossiers, public.blocked_days from public, anon, authenticated;

-- ---------- hulpfuncties (intern, door niemand rechtstreeks op te roepen) ------

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'authenticated'
     and exists (
       select 1 from public.admins a
       where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
     );
$$;

create or replace function public.dj_keys() returns text[]
language sql immutable set search_path = public, pg_temp as $$
  select array['clientEmail','clientPhone','eventType','eventDate','venue','priceExVat','advanceAmount',
               'overtimeRate','materials','setupDate','setupTime','djArrival','startTime','endTime','internalNotes'];
$$;

create or replace function public.client_keys() returns text[]
language sql immutable set search_path = public, pg_temp as $$
  select array['musicSuggestions','doNotPlay','firstDance','parentDance','specialMoments','genres','vibe',
               'announcements','onSiteContactAlt','extraNotes'];
$$;

-- Zuivert invoer: enkel toegelaten sleutels (rest wordt genegeerd), enkel tekst, max. lengte.
create or replace function public.clean_fields(p jsonb, p_allowed text[], p_maxlen int default 2000) returns jsonb
language plpgsql immutable set search_path = public, pg_temp as $$
declare k text; v jsonb; result jsonb := '{}'::jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' then raise exception 'invalid'; end if;
  for k, v in select * from jsonb_each(p) loop
    continue when not (k = any (p_allowed));
    if jsonb_typeof(v) = 'null' then v := '""'::jsonb; end if;
    if jsonb_typeof(v) <> 'string' then raise exception 'invalid'; end if;
    if length(v #>> '{}') > p_maxlen then raise exception 'invalid'; end if;
    result := result || jsonb_build_object(k, v);
  end loop;
  return result;
end $$;

create or replace function public.dossier_to_json(d public.dossiers) returns jsonb
language sql immutable set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', d.id, 'token', d.client_token, 'clientName', d.client_name, 'status', d.status,
    'adminSeen', d.admin_seen, 'submittedAt', d.submitted_at, 'version', d.version,
    'createdAt', d.created_at, 'updatedAt', d.updated_at, 'dj', d.dj, 'client', d.client);
$$;

-- Wat een klant te zien krijgt: geen id, geen code, geen interne notities.
create or replace function public.client_view_json(d public.dossiers) returns jsonb
language sql immutable set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'clientName', d.client_name, 'status', d.status, 'submittedAt', d.submitted_at,
    'dj', d.dj - 'internalNotes', 'client', d.client);
$$;

-- ---------- functies voor de beheerder ------------------------------------------

create or replace function public.admin_ping() returns boolean
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'no_access'; end if;
  return true;
end $$;

create or replace function public.admin_list() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'no_access'; end if;
  return coalesce((select jsonb_agg(public.dossier_to_json(d) order by d.created_at) from public.dossiers d), '[]'::jsonb);
end $$;

create or replace function public.admin_get(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare d public.dossiers;
begin
  if not public.is_admin() then raise exception 'no_access'; end if;
  select * into d from public.dossiers where id = p_id;
  if not found then raise exception 'not_found'; end if;
  return public.dossier_to_json(d);
end $$;

create or replace function public.admin_create(p_name text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare d public.dossiers; v_name text := left(btrim(coalesce(p_name, '')), 120);
begin
  if not public.is_admin() then raise exception 'no_access'; end if;
  if v_name = '' then v_name := 'Naamloze klant'; end if;
  insert into public.dossiers (client_name) values (v_name) returning * into d;
  return public.dossier_to_json(d);
end $$;

-- Opslaan door de beheerder. p_expected_version beschermt tegen overschrijven van
-- wijzigingen die de klant ondertussen deed (NULL = toch overschrijven).
create or replace function public.admin_save(
  p_id uuid, p_name text, p_dj jsonb, p_client jsonb, p_status text, p_expected_version bigint default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare d public.dossiers; v_name text := left(btrim(coalesce(p_name, '')), 120);
begin
  if not public.is_admin() then raise exception 'no_access'; end if;
  if p_status not in ('draft', 'submitted') then raise exception 'invalid'; end if;
  if v_name = '' then v_name := 'Naamloze klant'; end if;
  select * into d from public.dossiers where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if p_expected_version is not null and d.version <> p_expected_version then raise exception 'conflict'; end if;
  update public.dossiers set
    client_name  = v_name,
    dj           = public.clean_fields(p_dj, public.dj_keys()),
    client       = public.clean_fields(p_client, public.client_keys(), 4000),
    status       = p_status,
    submitted_at = case when p_status = 'submitted' then coalesce(d.submitted_at, now()) else null end,
    admin_seen   = true,
    version      = d.version + 1,
    updated_at   = now()
  where id = p_id returning * into d;
  return public.dossier_to_json(d);
end $$;

create or replace function public.admin_mark_seen(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'no_access'; end if;
  update public.dossiers set admin_seen = true where id = p_id;
end $$;

create or replace function public.admin_delete(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'no_access'; end if;
  delete from public.dossiers where id = p_id;
end $$;

create or replace function public.admin_blocked_list() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'no_access'; end if;
  return coalesce((select jsonb_object_agg(to_char(day, 'YYYY-MM-DD'), jsonb_build_object('reason', reason, 'group', grp))
                   from public.blocked_days), '{}'::jsonb);
end $$;

-- p_days = { "2026-10-24": { "reason": "privé", "group": "g1" }, ... }
create or replace function public.admin_blocked_add(p_days jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare k text; v jsonb; n int := 0;
begin
  if not public.is_admin() then raise exception 'no_access'; end if;
  if p_days is null or jsonb_typeof(p_days) <> 'object' then raise exception 'invalid'; end if;
  for k, v in select * from jsonb_each(p_days) loop
    n := n + 1;
    if n > 400 or k !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'invalid'; end if;
    begin
      insert into public.blocked_days (day, reason, grp)
      values (k::date, left(coalesce(v ->> 'reason', ''), 60), left(coalesce(v ->> 'group', ''), 40))
      on conflict (day) do nothing;
    exception when datetime_field_overflow or invalid_datetime_format then
      raise exception 'invalid';
    end;
  end loop;
end $$;

-- p_days = ["2026-10-24", ...]
create or replace function public.admin_blocked_remove(p_days jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare k text;
begin
  if not public.is_admin() then raise exception 'no_access'; end if;
  if p_days is null or jsonb_typeof(p_days) <> 'array' or jsonb_array_length(p_days) > 400 then raise exception 'invalid'; end if;
  for k in select jsonb_array_elements_text(p_days) loop
    if k !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'invalid'; end if;
    begin
      delete from public.blocked_days where day = k::date;
    exception when datetime_field_overflow or invalid_datetime_format then
      raise exception 'invalid';
    end;
  end loop;
end $$;

-- ---------- functies voor de klant (geen account, enkel de geheime code) ---------

create or replace function public.client_get(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare d public.dossiers;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{40}$' then raise exception 'not_found'; end if;
  select * into d from public.dossiers where client_token = p_token;
  if not found then raise exception 'not_found'; end if;
  return public.client_view_json(d);
end $$;

create or replace function public.client_save(p_token text, p_client jsonb, p_confirm boolean default false) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare d public.dossiers;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{40}$' then raise exception 'not_found'; end if;
  select * into d from public.dossiers where client_token = p_token for update;
  if not found then raise exception 'not_found'; end if;
  if d.status = 'submitted' then raise exception 'locked'; end if;
  update public.dossiers set
    client       = d.client || public.clean_fields(p_client, public.client_keys(), 4000),
    status       = case when coalesce(p_confirm, false) then 'submitted' else d.status end,
    submitted_at = case when coalesce(p_confirm, false) then now() else d.submitted_at end,
    admin_seen   = case when coalesce(p_confirm, false) then false else d.admin_seen end,
    version      = d.version + 1,
    updated_at   = now()
  where id = d.id returning * into d;
  return public.client_view_json(d);
end $$;

-- ---------- rechten op de functies ----------------------------------------------
-- Eerst alles dichtzetten, dan enkel openen wat nodig is.

revoke all on function public.new_client_token()                                     from public, anon, authenticated;
revoke all on function public.is_admin()                                             from public, anon, authenticated;
revoke all on function public.dj_keys()                                              from public, anon, authenticated;
revoke all on function public.client_keys()                                          from public, anon, authenticated;
revoke all on function public.clean_fields(jsonb, text[], int)                       from public, anon, authenticated;
revoke all on function public.dossier_to_json(public.dossiers)                       from public, anon, authenticated;
revoke all on function public.client_view_json(public.dossiers)                      from public, anon, authenticated;
revoke all on function public.admin_ping()                                           from public, anon, authenticated;
revoke all on function public.admin_list()                                           from public, anon, authenticated;
revoke all on function public.admin_get(uuid)                                        from public, anon, authenticated;
revoke all on function public.admin_create(text)                                     from public, anon, authenticated;
revoke all on function public.admin_save(uuid, text, jsonb, jsonb, text, bigint)     from public, anon, authenticated;
revoke all on function public.admin_mark_seen(uuid)                                  from public, anon, authenticated;
revoke all on function public.admin_delete(uuid)                                     from public, anon, authenticated;
revoke all on function public.admin_blocked_list()                                   from public, anon, authenticated;
revoke all on function public.admin_blocked_add(jsonb)                               from public, anon, authenticated;
revoke all on function public.admin_blocked_remove(jsonb)                            from public, anon, authenticated;
revoke all on function public.client_get(text)                                       from public, anon, authenticated;
revoke all on function public.client_save(text, jsonb, boolean)                      from public, anon, authenticated;

-- Beheerder (ingelogd): de admin-functies. De functies controleren zelf nog eens of het e-mailadres in "admins" staat.
grant execute on function public.admin_ping()                                        to authenticated;
grant execute on function public.admin_list()                                        to authenticated;
grant execute on function public.admin_get(uuid)                                     to authenticated;
grant execute on function public.admin_create(text)                                  to authenticated;
grant execute on function public.admin_save(uuid, text, jsonb, jsonb, text, bigint)  to authenticated;
grant execute on function public.admin_mark_seen(uuid)                               to authenticated;
grant execute on function public.admin_delete(uuid)                                  to authenticated;
grant execute on function public.admin_blocked_list()                                to authenticated;
grant execute on function public.admin_blocked_add(jsonb)                            to authenticated;
grant execute on function public.admin_blocked_remove(jsonb)                         to authenticated;

-- Klant (zonder login, met geheime code): enkel deze twee.
grant execute on function public.client_get(text)                                    to anon, authenticated;
grant execute on function public.client_save(text, jsonb, boolean)                   to anon, authenticated;
