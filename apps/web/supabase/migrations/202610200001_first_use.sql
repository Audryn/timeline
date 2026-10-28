create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  hemisphere text not null check (hemisphere in ('northern', 'southern')),
  created_at timestamptz not null default now()
);
create index projects_owner on public.projects(owner_id, created_at);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 100),
  kind text not null check (kind in ('real', 'fictional')),
  unique (id, project_id)
);
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 100),
  color text not null default '#216353',
  position integer not null,
  unique (id, project_id)
);
create table public.event_records (
  id uuid primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  description text not null check (length(description) <= 20000),
  location text not null check (length(location) <= 300),
  date jsonb not null,
  start_date date,
  end_date date,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, project_id)
);
create index events_timeline on public.event_records(project_id, start_date, id);
create table public.event_people (
  event_id uuid not null,
  person_id uuid not null,
  project_id uuid not null,
  primary key(event_id, person_id),
  foreign key(event_id, project_id) references public.event_records(id, project_id) on delete cascade,
  foreign key(person_id, project_id) references public.people(id, project_id)
);
create table public.event_categories (
  event_id uuid not null,
  category_id uuid not null,
  project_id uuid not null,
  primary key(event_id, category_id),
  foreign key(event_id, project_id) references public.event_records(id, project_id) on delete cascade,
  foreign key(category_id, project_id) references public.categories(id, project_id)
);
create index event_people_person on public.event_people(person_id, event_id);
create index event_categories_category on public.event_categories(category_id, event_id);
create table public.mutation_receipts (
  owner_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  fingerprint text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(owner_id, request_id)
);

alter table public.projects enable row level security;
create policy owned_projects on public.projects for select to authenticated using (owner_id = (select auth.uid()));
alter table public.people enable row level security;
create policy owned_people on public.people for select to authenticated using (
  exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
);
alter table public.categories enable row level security;
create policy owned_categories on public.categories for select to authenticated using (
  exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
);
alter table public.event_records enable row level security;
create policy owned_events on public.event_records for select to authenticated using (
  exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
);
alter table public.event_people enable row level security;
create policy owned_participants on public.event_people for select to authenticated using (
  exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
);
alter table public.event_categories enable row level security;
create policy owned_event_categories on public.event_categories for select to authenticated using (
  exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
);
alter table public.mutation_receipts enable row level security;

create view public.events with (security_invoker = true) as
select e.*,
  array(select ep.person_id from public.event_people ep where ep.event_id = e.id order by ep.person_id) as person_ids,
  array(select ec.category_id from public.event_categories ec where ec.event_id = e.id order by ec.category_id) as category_ids
from public.event_records e;

revoke all on public.projects, public.people, public.categories, public.event_records,
  public.event_people, public.event_categories, public.mutation_receipts, public.events from anon, authenticated;
grant select on public.projects, public.people, public.categories, public.event_records,
  public.event_people, public.event_categories, public.events to authenticated;

create function public.civil_bounds(p_date jsonb) returns date[]
language plpgsql immutable set search_path = '' as $$
declare
  y integer;
  m integer;
  d integer;
  first_day date;
  last_day date;
begin
  if jsonb_typeof(p_date) is distinct from 'object'
    or jsonb_typeof(p_date->'year') is distinct from 'number'
    or (p_date ? 'month' and jsonb_typeof(p_date->'month') is distinct from 'number')
    or (p_date ? 'day' and jsonb_typeof(p_date->'day') is distinct from 'number')
    or p_date - array['year', 'month', 'day'] <> '{}'::jsonb then
    raise exception using errcode = '22023', message = 'Choose numeric Gregorian date components.';
  end if;
  y := (p_date->>'year')::integer;
  m := (p_date->>'month')::integer;
  d := (p_date->>'day')::integer;
  if y is null or y not between 1 and 9999
    or (d is not null and m is null) then
    raise exception using errcode = '22023', message = 'Choose a valid Gregorian date.';
  end if;
  first_day := make_date(y, coalesce(m, 1), coalesce(d, 1));
  if d is not null then last_day := first_day;
  elsif m is not null then last_day := (first_day + interval '1 month' - interval '1 day')::date;
  else last_day := make_date(y, 12, 31);
  end if;
  return array[first_day, last_day];
end $$;

create function public.event_date_bounds(p_date jsonb, p_hemisphere text) returns date[]
language plpgsql immutable set search_path = '' as $$
declare
  kind text := p_date->>'kind';
  starts date[];
  ends date[];
  y integer;
  m integer;
begin
  if jsonb_typeof(p_date) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'Choose a date type.';
  end if;
  if p_date ? 'approximate' and jsonb_typeof(p_date->'approximate') is distinct from 'boolean' then
    raise exception using errcode = '22023', message = 'Choose a valid approximation flag.';
  end if;
  if kind = 'unknown' then
    if p_date - 'kind' <> '{}'::jsonb then raise exception using errcode = '22023', message = 'Unknown dates cannot contain date components.'; end if;
    return array[null::date, null::date];
  elsif kind = 'point' then
    if p_date - array['kind', 'value', 'approximate'] <> '{}'::jsonb then raise exception using errcode = '22023', message = 'Invalid single date.'; end if;
    return public.civil_bounds(p_date->'value');
  elsif kind = 'season' then
    if jsonb_typeof(p_date->'year') is distinct from 'number' or p_date - array['kind', 'year', 'season', 'approximate'] <> '{}'::jsonb then
      raise exception using errcode = '22023', message = 'Choose a numeric season year.';
    end if;
    y := (p_date->>'year')::integer;
    m := case p_date->>'season' when 'spring' then 3 when 'summer' then 6 when 'autumn' then 9 when 'winter' then 12 end;
    if y is null or y not between 1 and 9998 or m is null then
      raise exception using errcode = '22023', message = 'Choose a valid season and year.';
    end if;
    if p_hemisphere = 'southern' then m := ((m + 5) % 12) + 1; end if;
    starts := public.civil_bounds(jsonb_build_object('year', y, 'month', m));
    return array[starts[1], (starts[1] + interval '3 months' - interval '1 day')::date];
  elsif kind in ('range', 'custom') then
    if not (p_date ? 'start' and p_date ? 'end')
      or (kind = 'range' and p_date - array['kind', 'start', 'end', 'approximate'] <> '{}'::jsonb)
      or (kind = 'custom' and p_date - array['kind', 'start', 'end', 'text'] <> '{}'::jsonb) then
      raise exception using errcode = '22023', message = 'Provide valid start and end date fields.';
    end if;
    if kind = 'custom' and (jsonb_typeof(p_date->'text') is distinct from 'string' or length(btrim(coalesce(p_date->>'text', ''))) not between 1 and 200) then
      raise exception using errcode = '22023', message = 'Describe the custom date.';
    end if;
    if p_date->'start' is null or p_date->'start' = 'null'::jsonb then
      if kind = 'range' or (p_date->'end' is not null and p_date->'end' <> 'null'::jsonb) then
        raise exception using errcode = '22023', message = 'Choose a start date.';
      end if;
      return array[null::date, null::date];
    end if;
    starts := public.civil_bounds(p_date->'start');
    if p_date->'end' is null or p_date->'end' = 'null'::jsonb then
      return array[starts[1], case when kind = 'custom' then starts[2] else null::date end];
    end if;
    ends := public.civil_bounds(p_date->'end');
    if starts[1] > ends[2] then
      raise exception using errcode = '22023', message = 'The end must not precede the start.';
    end if;
    return array[starts[1], ends[2]];
  end if;
  raise exception using errcode = '22023', message = 'Choose a valid date type.';
end $$;

create function public.create_project(p_input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  rid uuid := (p_input->>'requestId')::uuid;
  fingerprint text := encode(sha256(convert_to('project:' || p_input::text, 'UTF8')), 'hex');
  prior public.mutation_receipts;
  pid uuid;
  result jsonb;
begin
  if uid is null or rid is null then raise exception using errcode = '42501', message = 'Sign in to continue.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  select * into prior from public.mutation_receipts where owner_id = uid and request_id = rid;
  if found then
    if prior.fingerprint <> fingerprint then raise exception using errcode = '22023', message = 'Use a new request for changed content.'; end if;
    return prior.result;
  end if;
  insert into public.projects(owner_id, name, hemisphere)
    values(uid, btrim(p_input->>'name'), p_input->>'hemisphere') returning id into pid;
  insert into public.people(project_id, name, kind)
    values(pid, btrim(p_input->>'personName'), p_input->>'personKind');
  insert into public.categories(project_id, name, position)
    select pid, name, ordinal::integer from unnest(array[
      'Where I lived', 'Education', 'Work', 'Friendships', 'Romantic relationships',
      'Travel', 'Health', 'Children & family', 'Events attended', 'Athletics',
      'Spiritual life', 'Name changes', 'Personal growth'
    ]) with ordinality as c(name, ordinal);
  result := jsonb_build_object('id', pid);
  insert into public.mutation_receipts values(uid, rid, fingerprint, result, now());
  return result;
end $$;

create function public.add_person(p_project uuid, p_input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  rid uuid := (p_input->>'requestId')::uuid;
  fingerprint text := encode(sha256(convert_to('person:' || p_project::text || p_input::text, 'UTF8')), 'hex');
  prior public.mutation_receipts;
  result jsonb;
  person public.people;
begin
  if uid is null or rid is null then raise exception using errcode = '42501', message = 'Sign in to continue.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  perform 1 from public.projects where id = p_project and owner_id = uid for update;
  if not found then raise exception using errcode = '42501', message = 'Project is unavailable.'; end if;
  select * into prior from public.mutation_receipts where owner_id = uid and request_id = rid;
  if found then
    if prior.fingerprint <> fingerprint then raise exception using errcode = '22023', message = 'Use a new request for changed content.'; end if;
    return prior.result;
  end if;
  insert into public.people(project_id, name, kind)
    values(p_project, btrim(p_input->>'name'), p_input->>'kind') returning * into person;
  result := to_jsonb(person);
  insert into public.mutation_receipts values(uid, rid, fingerprint, result, now());
  return result;
end $$;

create function public.save_event(p_project uuid, p_input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  rid uuid := (p_input->>'requestId')::uuid;
  eid uuid := (p_input->>'id')::uuid;
  expected integer := (p_input->>'version')::integer;
  fingerprint text := encode(sha256(convert_to('event:' || p_project::text || p_input::text, 'UTF8')), 'hex');
  prior public.mutation_receipts;
  project public.projects;
  current_event public.event_records;
  participants uuid[];
  category_ids uuid[];
  bounds date[];
  result jsonb;
begin
  if uid is null or rid is null then raise exception using errcode = '42501', message = 'Sign in to continue.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  select * into project from public.projects where id = p_project and owner_id = uid for update;
  if not found then raise exception using errcode = '42501', message = 'Project is unavailable.'; end if;
  select * into prior from public.mutation_receipts where owner_id = uid and request_id = rid;
  if found then
    if prior.fingerprint <> fingerprint then raise exception using errcode = '22023', message = 'Use a new request for changed content.'; end if;
    return prior.result;
  end if;
  if eid is null or expected is null or expected < 0
    or jsonb_typeof(p_input->'personIds') is distinct from 'array'
    or jsonb_typeof(p_input->'categoryIds') is distinct from 'array'
    or jsonb_typeof(p_input->'title') is distinct from 'string'
    or jsonb_typeof(p_input->'description') is distinct from 'string'
    or jsonb_typeof(p_input->'location') is distinct from 'string' then
    raise exception using errcode = '22023', message = 'Complete the required event fields.';
  end if;
  participants := array(select jsonb_array_elements_text(p_input->'personIds')::uuid);
  category_ids := array(select jsonb_array_elements_text(p_input->'categoryIds')::uuid);
  if cardinality(participants) not between 1 and 100 or cardinality(category_ids) > 50
    or (select count(distinct x) from unnest(participants) x) <> cardinality(participants)
    or (select count(distinct x) from unnest(category_ids) x) <> cardinality(category_ids)
    or (select count(*) from public.people where project_id = p_project and id = any(participants)) <> cardinality(participants)
    or (select count(*) from public.categories where project_id = p_project and id = any(category_ids)) <> cardinality(category_ids) then
    raise exception using errcode = '22023', message = 'Choose people and categories from this project.';
  end if;
  bounds := public.event_date_bounds(p_input->'date', project.hemisphere);
  select * into current_event from public.event_records where id = eid for update;
  if found then
    if current_event.project_id <> p_project then raise exception using errcode = '42501', message = 'Event is unavailable.'; end if;
    if current_event.version <> expected then
      raise exception using errcode = 'P0001', message = 'This event changed elsewhere. Your draft has been kept.';
    end if;
    update public.event_records set title = btrim(p_input->>'title'),
      description = p_input->>'description', location = p_input->>'location', date = p_input->'date',
      start_date = bounds[1], end_date = bounds[2], version = version + 1, updated_at = now()
      where id = eid;
  else
    if expected <> 0 then raise exception using errcode = 'P0001', message = 'This event is unavailable. Your draft has been kept.'; end if;
    insert into public.event_records(id, project_id, title, description, location, date, start_date, end_date)
      values(eid, p_project, btrim(p_input->>'title'), p_input->>'description', p_input->>'location', p_input->'date', bounds[1], bounds[2]);
  end if;
  delete from public.event_people where event_id = eid;
  insert into public.event_people select eid, person_id, p_project from unnest(participants) person_id;
  delete from public.event_categories where event_id = eid;
  insert into public.event_categories select eid, category_id, p_project from unnest(category_ids) category_id;
  select jsonb_build_object('id', id, 'version', version) into result from public.event_records where id = eid;
  insert into public.mutation_receipts values(uid, rid, fingerprint, result, now());
  return result;
end $$;

revoke all on function public.civil_bounds(jsonb), public.event_date_bounds(jsonb, text),
  public.create_project(jsonb), public.add_person(uuid, jsonb), public.save_event(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_project(jsonb), public.add_person(uuid, jsonb),
  public.save_event(uuid, jsonb) to authenticated;
