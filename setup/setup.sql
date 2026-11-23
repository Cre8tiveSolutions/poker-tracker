-- =====================================================================
--  POKER TRACKER — database setup
--  Paste this whole file into Supabase → SQL Editor → New query → Run.
--  Safe to run once on a fresh, empty project.
--
--  What it creates:
--    groups, members (owner + bankers), players, sessions (game nights),
--    session_players (who played + cash-out), buy_ins, settle_payments
--  Protection rules:
--    • Anyone with the app link can VIEW (read-only).
--    • Only signed-in bankers/owner of the group can ADD / CHANGE / DELETE.
--    • Only the owner can add or remove bankers.
-- =====================================================================

-- ---------- Tables ----------------------------------------------------

create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  currency    text not null default 'SGD',
  created_at  timestamptz not null default now()
);

create table public.members (
  group_id      uuid not null references public.groups(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null check (role in ('owner', 'banker')),
  display_name  text not null check (char_length(display_name) between 1 and 60),
  created_at    timestamptz not null default now(),
  primary key (group_id, user_id)
);
-- only one owner per group
create unique index members_one_owner on public.members (group_id) where role = 'owner';

create table public.players (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  nickname    text check (char_length(nickname) <= 40),
  photo_url   text constraint players_photo_ok check (
                photo_url is null
                or photo_url ~* '^https://'
                or (photo_url ~ '^data:image/(jpeg|png|webp);base64,' and length(photo_url) < 60000)),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.sessions (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  played_on   date not null default current_date,
  location    text check (char_length(location) <= 120),
  notes       text check (char_length(notes) <= 4000),
  status      text not null default 'live' check (status in ('live', 'ended')),
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);

create table public.session_players (
  session_id     uuid not null references public.sessions(id) on delete cascade,
  player_id      uuid not null references public.players(id) on delete restrict,
  group_id       uuid not null references public.groups(id) on delete cascade,
  cash_out       numeric(10,2) check (cash_out is null or cash_out >= 0),
  cashed_out_at  timestamptz,
  joined_at      timestamptz not null default now(),
  primary key (session_id, player_id)
);

create table public.buy_ins (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  player_id   uuid not null references public.players(id) on delete restrict,
  group_id    uuid not null references public.groups(id) on delete cascade,
  amount      numeric(10,2) not null check (amount > 0 and amount <= 100000),
  bought_at   timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  foreign key (session_id, player_id) references public.session_players(session_id, player_id) on delete cascade
);
create index buy_ins_session_idx on public.buy_ins (session_id, bought_at);

create table public.settle_payments (
  session_id      uuid not null references public.sessions(id) on delete cascade,
  from_player_id  uuid not null references public.players(id) on delete restrict,
  to_player_id    uuid not null references public.players(id) on delete restrict,
  group_id        uuid not null references public.groups(id) on delete cascade,
  amount          numeric(10,2) not null check (amount > 0),
  paid            boolean not null default false,
  paid_at         timestamptz,
  primary key (session_id, from_player_id, to_player_id)
);

create index players_group_idx  on public.players (group_id);
create index sessions_group_idx on public.sessions (group_id, played_on desc);
create index sp_group_idx       on public.session_players (group_id);
create index bi_group_idx       on public.buy_ins (group_id);
create index pay_group_idx      on public.settle_payments (group_id);

-- ---------- Keep group_id honest (copied from the game night) ----------

create or replace function public.copy_group_from_session()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select s.group_id into new.group_id from public.sessions s where s.id = new.session_id;
  if new.group_id is null then
    raise exception 'Unknown game night';
  end if;
  if not exists (select 1 from public.players p
                 where p.id = new.player_id and p.group_id = new.group_id) then
    raise exception 'Player is not in this group';
  end if;
  return new;
end $$;

create trigger sp_group  before insert or update on public.session_players
  for each row execute function public.copy_group_from_session();
create trigger bi_group  before insert or update on public.buy_ins
  for each row execute function public.copy_group_from_session();

create or replace function public.copy_group_for_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select s.group_id into new.group_id from public.sessions s where s.id = new.session_id;
  if new.group_id is null then raise exception 'Unknown game night'; end if;
  if (select count(*) from public.players p
      where p.id in (new.from_player_id, new.to_player_id) and p.group_id = new.group_id) <> 2 then
    raise exception 'Players are not in this group';
  end if;
  return new;
end $$;

create trigger pay_group before insert or update on public.settle_payments
  for each row execute function public.copy_group_for_payment();

-- ---------- Helper checks used by the rules ---------------------------

create or replace function public.is_banker(gid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m
    where m.group_id = gid and m.user_id = auth.uid() and m.role in ('owner', 'banker')
  );
$$;

create or replace function public.is_owner(gid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m
    where m.group_id = gid and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

-- ---------- Protection rules (Row Level Security) ---------------------

alter table public.groups          enable row level security;
alter table public.members         enable row level security;
alter table public.players         enable row level security;
alter table public.sessions        enable row level security;
alter table public.session_players enable row level security;
alter table public.buy_ins         enable row level security;
alter table public.settle_payments enable row level security;

-- Everyone (with the link) can read game data
create policy "read groups"   on public.groups          for select to anon, authenticated using (true);
create policy "read players"  on public.players         for select to anon, authenticated using (true);
create policy "read sessions" on public.sessions        for select to anon, authenticated using (true);
create policy "read sp"       on public.session_players for select to anon, authenticated using (true);
create policy "read buyins"   on public.buy_ins         for select to anon, authenticated using (true);
create policy "read payments" on public.settle_payments for select to anon, authenticated using (true);

-- Owner can rename the group
create policy "owner edits group" on public.groups for update to authenticated
  using (public.is_owner(id)) with check (public.is_owner(id));

-- Bankers can add / change / delete game data in their group
create policy "bankers insert players" on public.players for insert to authenticated with check (public.is_banker(group_id));
create policy "bankers update players" on public.players for update to authenticated using (public.is_banker(group_id)) with check (public.is_banker(group_id));
create policy "bankers delete players" on public.players for delete to authenticated using (public.is_banker(group_id));

create policy "bankers insert sessions" on public.sessions for insert to authenticated with check (public.is_banker(group_id));
create policy "bankers update sessions" on public.sessions for update to authenticated using (public.is_banker(group_id)) with check (public.is_banker(group_id));
create policy "bankers delete sessions" on public.sessions for delete to authenticated using (public.is_banker(group_id));

create policy "bankers insert sp" on public.session_players for insert to authenticated with check (public.is_banker(group_id));
create policy "bankers update sp" on public.session_players for update to authenticated using (public.is_banker(group_id)) with check (public.is_banker(group_id));
create policy "bankers delete sp" on public.session_players for delete to authenticated using (public.is_banker(group_id));

create policy "bankers insert buyins" on public.buy_ins for insert to authenticated with check (public.is_banker(group_id));
create policy "bankers update buyins" on public.buy_ins for update to authenticated using (public.is_banker(group_id)) with check (public.is_banker(group_id));
create policy "bankers delete buyins" on public.buy_ins for delete to authenticated using (public.is_banker(group_id));

create policy "bankers insert payments" on public.settle_payments for insert to authenticated with check (public.is_banker(group_id));
create policy "bankers update payments" on public.settle_payments for update to authenticated using (public.is_banker(group_id)) with check (public.is_banker(group_id));
create policy "bankers delete payments" on public.settle_payments for delete to authenticated using (public.is_banker(group_id));

-- Members list: you see your own row; the owner sees everyone in the group.
-- Who-entered-what names are shown through banker_names() below instead.
create policy "see own or owner sees all" on public.members for select to authenticated
  using (user_id = auth.uid() or public.is_owner(group_id));
-- (No insert/update/delete rules: members are only changed through the functions below.)

-- ---------- Table access for the app (rules above still apply) ---------

grant usage on schema public to anon, authenticated;
grant select on public.groups, public.players, public.sessions, public.session_players,
               public.buy_ins, public.settle_payments to anon, authenticated;
grant select on public.members to authenticated;
grant update on public.groups to authenticated;
grant insert, update, delete on public.players, public.sessions, public.session_players,
               public.buy_ins, public.settle_payments to authenticated;
revoke insert, update, delete on public.members from anon, authenticated;
revoke insert, delete on public.groups from anon, authenticated;
revoke all on public.members from anon;

-- ---------- Owner / banker management ---------------------------------

-- First signed-in person becomes the owner — only works while the group has NO owner.
create or replace function public.claim_ownership(gid uuid, my_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Please sign in first'; end if;
  if exists (select 1 from public.members where group_id = gid and role = 'owner') then
    raise exception 'This group already has an owner';
  end if;
  insert into public.members (group_id, user_id, role, display_name)
  values (gid, auth.uid(), 'owner', coalesce(nullif(trim(my_name), ''), 'Owner'))
  on conflict (group_id, user_id) do update set role = 'owner';
end $$;

-- Owner adds a banker. The banker's login must already exist
-- (Supabase → Authentication → Users → Add user).
create or replace function public.add_banker(gid uuid, banker_email text, banker_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if not public.is_owner(gid) then raise exception 'Only the owner can add bankers'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(banker_email));
  if uid is null then
    raise exception 'No login found for that email. Create it first in Supabase → Authentication → Users.';
  end if;
  insert into public.members (group_id, user_id, role, display_name)
  values (gid, uid, 'banker', coalesce(nullif(trim(banker_name), ''), split_part(banker_email, '@', 1)))
  on conflict (group_id, user_id) do update
    set display_name = excluded.display_name
    where public.members.role <> 'owner';
end $$;

-- Owner removes a banker (cannot remove the owner).
create or replace function public.remove_banker(gid uuid, banker_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_owner(gid) then raise exception 'Only the owner can remove bankers'; end if;
  delete from public.members where group_id = gid and user_id = banker_user and role = 'banker';
end $$;

-- Names of bankers (no emails) — used to show "entered by".
create or replace function public.banker_names(gid uuid)
returns table (user_id uuid, display_name text, role text)
language sql stable security definer set search_path = '' as $$
  select m.user_id, m.display_name, m.role from public.members m where m.group_id = gid;
$$;

-- Does the group have an owner yet? (so the app knows to show "Become owner")
create or replace function public.group_has_owner(gid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members where group_id = gid and role = 'owner');
$$;

-- Only the owner may see bankers' emails (for the Bankers page).
create or replace function public.banker_emails(gid uuid)
returns table (user_id uuid, email text, display_name text, role text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_owner(gid) then raise exception 'Only the owner can see this'; end if;
  return query
    select m.user_id, u.email::text, m.display_name, m.role
    from public.members m join auth.users u on u.id = m.user_id
    where m.group_id = gid order by m.role, m.display_name;
end $$;

revoke execute on function public.claim_ownership(uuid, text)      from public, anon;
revoke execute on function public.add_banker(uuid, text, text)     from public, anon;
revoke execute on function public.remove_banker(uuid, uuid)        from public, anon;
revoke execute on function public.banker_emails(uuid)              from public, anon;
revoke execute on function public.copy_group_from_session()        from public, anon, authenticated;
revoke execute on function public.copy_group_for_payment()         from public, anon, authenticated;
grant  execute on function public.claim_ownership(uuid, text)      to authenticated;
grant  execute on function public.add_banker(uuid, text, text)     to authenticated;
grant  execute on function public.remove_banker(uuid, uuid)        to authenticated;
grant  execute on function public.banker_emails(uuid)              to authenticated;
grant  execute on function public.banker_names(uuid)               to anon, authenticated;
grant  execute on function public.group_has_owner(uuid)            to anon, authenticated;
grant  execute on function public.is_banker(uuid)                  to anon, authenticated;
grant  execute on function public.is_owner(uuid)                   to anon, authenticated;

-- ---------- Live updates on everyone's phone ---------------------------

alter publication supabase_realtime add table
  public.sessions, public.session_players, public.buy_ins, public.settle_payments, public.players;

-- ---------- Your group --------------------------------------------------

insert into public.groups (name) values ('Our Poker Group');

-- Done! Next: follow SETUP-GUIDE.md, Part A step 3 (turn off sign-ups).
