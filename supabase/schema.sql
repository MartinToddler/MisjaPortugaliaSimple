-- ============================================================================
-- Misja Portugalia — schemat bazy danych (Supabase / Postgres)
--
-- Jak użyć:
--   1. W panelu Supabase włącz logowanie anonimowe:
--      Authentication -> Sign In / Providers -> Anonymous sign-ins -> ON
--   2. Otwórz SQL Editor -> New query, wklej CAŁY ten plik i kliknij Run.
--      Skrypt jest idempotentny — można go bezpiecznie uruchomić ponownie.
--
-- Model bezpieczeństwa:
--   * każda tabela ma RLS; dane widzą wyłącznie członkowie tej samej wyprawy,
--   * dołączanie/zakładanie wyprawy i recenzje zgłoszeń idą przez funkcje
--     SECURITY DEFINER (RPC), które same sprawdzają uprawnienia,
--   * reguła gry (zdjęcie zalicza od razu, bez zdjęcia czeka na potwierdzenie)
--     jest wymuszana triggerem po stronie bazy, nie w kliencie.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABELE
-- ----------------------------------------------------------------------------

create table if not exists public.families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 60),
  join_code   text not null unique,
  goal_points int check (goal_points is null or goal_points > 0),
  goal_reward text,
  created_at  timestamptz not null default now()
);

create table if not exists public.members (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families(id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 40),
  avatar       text not null default '🙂',
  role         text not null default 'member' check (role in ('admin', 'member')),
  auth_user_id uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (family_id, name)
);

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 120),
  description text,
  points      int not null check (points between 1 and 1000),
  type        text not null check (type in ('individual', 'family')),
  category    text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.completions (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families(id) on delete cascade,
  task_id     uuid not null references public.tasks(id) on delete cascade,
  member_id   uuid not null references public.members(id) on delete cascade,
  task_type   text not null check (task_type in ('individual', 'family')),
  photo_path  text,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_by uuid references public.members(id) on delete set null,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  -- nikt nie potwierdza sam sobie
  check (approved_by is null or approved_by <> member_id)
);

-- zadanie indywidualne: jedno aktywne (nieodrzucone) zgłoszenie na osobę
create unique index if not exists completions_one_per_member
  on public.completions (task_id, member_id) where status <> 'rejected';

-- zadanie rodzinne: jedno aktywne zgłoszenie na całą wyprawę
create unique index if not exists completions_one_per_family
  on public.completions (task_id) where status <> 'rejected' and task_type = 'family';

create index if not exists completions_family_created
  on public.completions (family_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 2. FUNKCJE POMOCNICZE (security definer — omijają rekurencję RLS)
-- ----------------------------------------------------------------------------

create or replace function public.my_member_ids()
returns setof uuid
language sql stable security definer set search_path = public as
$$ select id from members where auth_user_id = (select auth.uid()) $$;

create or replace function public.my_family_ids()
returns setof uuid
language sql stable security definer set search_path = public as
$$ select family_id from members where auth_user_id = (select auth.uid()) $$;

create or replace function public.is_family_admin(p_family_id uuid)
returns boolean
language sql stable security definer set search_path = public as
$$
  select exists (
    select 1 from members
    where family_id = p_family_id
      and auth_user_id = (select auth.uid())
      and role = 'admin'
  )
$$;

-- 6-znakowy kod dołączenia bez mylących znaków (bez 0/O, 1/I/L)
create or replace function public.gen_join_code()
returns text
language plpgsql volatile security definer set search_path = public as
$$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code  text;
  i     int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from families where join_code = code);
  end loop;
  return code;
end
$$;

-- ----------------------------------------------------------------------------
-- 3. TRIGGERY PILNUJĄCE REGUŁ GRY
-- ----------------------------------------------------------------------------

-- Zgłoszenie wykonania: uzupełnia pola pochodne i wymusza regułę weryfikacji
-- (ze zdjęciem = zaliczone od razu, bez zdjęcia = czeka na potwierdzenie).
create or replace function public.completions_before_insert()
returns trigger
language plpgsql security definer set search_path = public as
$$
declare
  v_task   tasks%rowtype;
  v_member members%rowtype;
begin
  select * into v_task from tasks where id = new.task_id;
  if not found then
    raise exception 'Nie ma takiego zadania';
  end if;
  if not v_task.is_active then
    raise exception 'To zadanie jest wyłączone przez admina';
  end if;

  select * into v_member from members where id = new.member_id;
  if not found or v_member.family_id <> v_task.family_id then
    raise exception 'Zadanie należy do innej wyprawy';
  end if;

  new.family_id   := v_task.family_id;
  new.task_type   := v_task.type;
  new.status      := case when new.photo_path is not null then 'approved' else 'pending' end;
  new.approved_by := null;
  new.resolved_at := case when new.photo_path is not null then now() else null end;
  return new;
end
$$;

drop trigger if exists completions_before_insert on public.completions;
create trigger completions_before_insert
  before insert on public.completions
  for each row execute function public.completions_before_insert();

-- Członek może edytować swój profil, ale nie może zmienić sobie roli ani wyprawy.
create or replace function public.members_guard_update()
returns trigger
language plpgsql as
$$
begin
  if new.role is distinct from old.role or new.family_id is distinct from old.family_id then
    raise exception 'Nie można zmienić roli ani wyprawy członka';
  end if;
  return new;
end
$$;

drop trigger if exists members_guard_update on public.members;
create trigger members_guard_update
  before update on public.members
  for each row execute function public.members_guard_update();

-- ----------------------------------------------------------------------------
-- 4. RPC (wywoływane z aplikacji przez supabase.rpc)
-- ----------------------------------------------------------------------------

-- Założenie nowej wyprawy; wołający zostaje adminem.
create or replace function public.create_family(
  p_family_name text,
  p_member_name text,
  p_avatar      text,
  p_goal_points int  default null,
  p_goal_reward text default null
)
returns json
language plpgsql volatile security definer set search_path = public as
$$
declare
  v_family families%rowtype;
  v_member members%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Wymagana sesja użytkownika';
  end if;

  insert into families (name, join_code, goal_points, goal_reward)
  values (
    trim(p_family_name),
    public.gen_join_code(),
    p_goal_points,
    nullif(trim(coalesce(p_goal_reward, '')), '')
  )
  returning * into v_family;

  insert into members (family_id, name, avatar, role, auth_user_id)
  values (v_family.id, trim(p_member_name), coalesce(nullif(p_avatar, ''), '🙂'), 'admin', (select auth.uid()))
  returning * into v_member;

  return json_build_object('family', row_to_json(v_family), 'member', row_to_json(v_member));
end
$$;

-- Podgląd wyprawy po kodzie (przed dołączeniem): nazwa + lista profili.
create or replace function public.family_preview(p_code text)
returns json
language plpgsql stable security definer set search_path = public as
$$
declare
  v_family families%rowtype;
begin
  select * into v_family from families where join_code = upper(trim(p_code));
  if not found then
    raise exception 'Nie znaleziono wyprawy o tym kodzie';
  end if;

  return json_build_object(
    'family', json_build_object('id', v_family.id, 'name', v_family.name),
    'members', (
      select coalesce(
        json_agg(
          json_build_object('id', m.id, 'name', m.name, 'avatar', m.avatar, 'claimed', m.auth_user_id is not null)
          order by m.created_at
        ),
        '[]'::json
      )
      from members m
      where m.family_id = v_family.id
    )
  );
end
$$;

-- Dołączenie do wyprawy jako nowy profil.
create or replace function public.join_family(p_code text, p_name text, p_avatar text)
returns json
language plpgsql volatile security definer set search_path = public as
$$
declare
  v_family families%rowtype;
  v_member members%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Wymagana sesja użytkownika';
  end if;

  select * into v_family from families where join_code = upper(trim(p_code));
  if not found then
    raise exception 'Nie znaleziono wyprawy o tym kodzie';
  end if;

  if exists (select 1 from members where family_id = v_family.id and lower(name) = lower(trim(p_name))) then
    raise exception 'W tej wyprawie jest już profil o imieniu %', trim(p_name);
  end if;

  insert into members (family_id, name, avatar, auth_user_id)
  values (v_family.id, trim(p_name), coalesce(nullif(p_avatar, ''), '🙂'), (select auth.uid()))
  returning * into v_member;

  return json_build_object('family', row_to_json(v_family), 'member', row_to_json(v_member));
end
$$;

-- Powrót do istniejącego profilu (np. nowe urządzenie albo wyczyszczona
-- przeglądarka). Profil zostaje przepięty na bieżącą sesję.
create or replace function public.claim_member(p_code text, p_member_id uuid)
returns json
language plpgsql volatile security definer set search_path = public as
$$
declare
  v_family families%rowtype;
  v_member members%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Wymagana sesja użytkownika';
  end if;

  select * into v_family from families where join_code = upper(trim(p_code));
  if not found then
    raise exception 'Nie znaleziono wyprawy o tym kodzie';
  end if;

  update members
  set auth_user_id = (select auth.uid())
  where id = p_member_id and family_id = v_family.id
  returning * into v_member;

  if not found then
    raise exception 'Ten profil nie należy do tej wyprawy';
  end if;

  return json_build_object('family', row_to_json(v_family), 'member', row_to_json(v_member));
end
$$;

-- Recenzja zgłoszenia:
--   * pending  -> approve/reject przez INNEGO członka wyprawy,
--   * approved -> reject (cofnięcie) wyłącznie przez admina.
create or replace function public.review_completion(p_completion_id uuid, p_approve boolean)
returns json
language plpgsql volatile security definer set search_path = public as
$$
declare
  v_completion completions%rowtype;
  v_reviewer   members%rowtype;
begin
  select * into v_completion from completions where id = p_completion_id;
  if not found then
    raise exception 'Nie znaleziono zgłoszenia';
  end if;

  select * into v_reviewer
  from members
  where family_id = v_completion.family_id and auth_user_id = (select auth.uid())
  limit 1;
  if not found then
    raise exception 'Nie należysz do tej wyprawy';
  end if;

  if v_completion.status = 'pending' then
    if v_reviewer.id = v_completion.member_id then
      raise exception 'Nie możesz potwierdzić własnego zgłoszenia';
    end if;
    update completions
    set status      = case when p_approve then 'approved' else 'rejected' end,
        approved_by = case when p_approve then v_reviewer.id else null end,
        resolved_at = now()
    where id = p_completion_id
    returning * into v_completion;
  elsif v_completion.status = 'approved' and not p_approve then
    if v_reviewer.role <> 'admin' then
      raise exception 'Tylko admin może cofnąć zaliczone zadanie';
    end if;
    update completions
    set status = 'rejected', resolved_at = now()
    where id = p_completion_id
    returning * into v_completion;
  else
    raise exception 'Tego zgłoszenia nie można już zmienić';
  end if;

  return row_to_json(v_completion);
end
$$;

-- ----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------

alter table public.families    enable row level security;
alter table public.members     enable row level security;
alter table public.tasks       enable row level security;
alter table public.completions enable row level security;

drop policy if exists families_select on public.families;
create policy families_select on public.families
  for select to authenticated
  using (id in (select public.my_family_ids()));

drop policy if exists families_update_admin on public.families;
create policy families_update_admin on public.families
  for update to authenticated
  using (public.is_family_admin(id))
  with check (public.is_family_admin(id));

drop policy if exists families_delete_admin on public.families;
create policy families_delete_admin on public.families
  for delete to authenticated
  using (public.is_family_admin(id));

drop policy if exists members_select on public.members;
create policy members_select on public.members
  for select to authenticated
  using (family_id in (select public.my_family_ids()));

drop policy if exists members_update_self on public.members;
create policy members_update_self on public.members
  for update to authenticated
  using (id in (select public.my_member_ids()))
  with check (id in (select public.my_member_ids()));

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select to authenticated
  using (family_id in (select public.my_family_ids()));

drop policy if exists tasks_insert_admin on public.tasks;
create policy tasks_insert_admin on public.tasks
  for insert to authenticated
  with check (public.is_family_admin(family_id));

drop policy if exists tasks_update_admin on public.tasks;
create policy tasks_update_admin on public.tasks
  for update to authenticated
  using (public.is_family_admin(family_id))
  with check (public.is_family_admin(family_id));

drop policy if exists tasks_delete_admin on public.tasks;
create policy tasks_delete_admin on public.tasks
  for delete to authenticated
  using (public.is_family_admin(family_id));

drop policy if exists completions_select on public.completions;
create policy completions_select on public.completions
  for select to authenticated
  using (family_id in (select public.my_family_ids()));

drop policy if exists completions_insert_own on public.completions;
create policy completions_insert_own on public.completions
  for insert to authenticated
  with check (member_id in (select public.my_member_ids()));

-- wycofanie własnego zgłoszenia, dopóki czeka na potwierdzenie
drop policy if exists completions_delete_own_pending on public.completions;
create policy completions_delete_own_pending on public.completions
  for delete to authenticated
  using (member_id in (select public.my_member_ids()) and status = 'pending');

-- aktualizacje zgłoszeń wyłącznie przez RPC review_completion (brak polityki UPDATE)

-- ----------------------------------------------------------------------------
-- 6. STORAGE — prywatny bucket na zdjęcia
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- ścieżka pliku: {family_id}/{uuid}.jpg — pierwszy segment izoluje wyprawy
drop policy if exists photos_select_family on storage.objects;
create policy photos_select_family on storage.objects
  for select to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] in (select f::text from public.my_family_ids() f)
  );

drop policy if exists photos_insert_family on storage.objects;
create policy photos_insert_family on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] in (select f::text from public.my_family_ids() f)
  );

drop policy if exists photos_delete_admin on storage.objects;
create policy photos_delete_admin on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'photos'
    and public.is_family_admin(((storage.foldername(name))[1])::uuid)
  );

-- ----------------------------------------------------------------------------
-- 7. REALTIME — powiadomienia o zmianach dla żywego rankingu i feedu
-- ----------------------------------------------------------------------------

do $$ begin
  alter publication supabase_realtime add table public.completions;
exception when duplicate_object or undefined_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.tasks;
exception when duplicate_object or undefined_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.members;
exception when duplicate_object or undefined_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.families;
exception when duplicate_object or undefined_object then null; end $$;
