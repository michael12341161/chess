-- Chess Platform database schema.
-- Run this single file in Supabase SQL Editor to create the full database.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.rank_title_for_points(points integer)
returns text
language sql
immutable
as $$
  select case
    when coalesce(points, 0) >= 2500 then 'GM'
    when coalesce(points, 0) >= 2400 then 'IM'
    when coalesce(points, 0) >= 2300 then 'FM'
    when coalesce(points, 0) >= 2200 then 'NM'
    when coalesce(points, 0) >= 2000 then 'CM'
    else 'Unranked'
  end;
$$;

create or replace function public.set_rank_title()
returns trigger
language plpgsql
as $$
begin
  new.ranking_points = greatest(0, coalesce(new.ranking_points, 1200));
  new.rank_title = public.rank_title_for_points(new.ranking_points);
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  role text not null default 'user' check (role in ('admin', 'user')),
  account_status text not null default 'active' check (account_status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references public.users(id) on delete cascade,
  username text unique not null,
  full_name text,
  avatar_url text,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  ranking_points integer not null default 1200 check (ranking_points >= 0),
  rank_title text not null default 'Unranked',
  match_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  white_user_id uuid references public.users(id) on delete set null,
  black_user_id uuid references public.users(id) on delete set null,
  mode text not null default 'local',
  status text not null default 'active',
  result text,
  result_reason text,
  current_fen text not null,
  final_fen text,
  pgn text,
  ranked_result_applied boolean not null default false,
  time_control jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.moves (
  id bigserial primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  move_number integer not null,
  color text not null check (color in ('w', 'b')),
  san text not null,
  lan text,
  from_square text not null,
  to_square text not null,
  promotion text,
  captured text,
  fen_after text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (game_id, move_number, color)
);

create table if not exists public.saved_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  game_id uuid references public.games(id) on delete cascade,
  title text not null,
  state jsonb not null,
  fen text not null,
  pgn text,
  auto_saved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_statistics (
  user_id uuid primary key references public.users(id) on delete cascade,
  games_played integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  ranking_points integer not null default 1200 check (ranking_points >= 0),
  rank_title text not null default 'Unranked',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leaderboard (
  user_id uuid primary key references public.users(id) on delete cascade,
  username text not null,
  avatar_url text,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  ranking_points integer not null default 1200 check (ranking_points >= 0),
  rank_title text not null default 'Unranked',
  updated_at timestamptz not null default now()
);

create table if not exists public.friend_challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references public.users(id) on delete cascade,
  opponent_id uuid not null references public.users(id) on delete cascade,
  color_preference text not null default 'random' check (color_preference in ('white', 'black', 'random')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'canceled')),
  game_id uuid references public.games(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz,
  check (challenger_id <> opponent_id)
);

create table if not exists public.online_users (
  user_id uuid primary key references public.users(id) on delete cascade,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_credentials (
  username text primary key,
  password_hash text not null,
  role text not null default 'admin' check (role = 'admin'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_sessions (
  id uuid primary key default gen_random_uuid(),
  username text not null references public.admin_credentials(username) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

alter table public.profiles drop column if exists rating;
alter table public.game_statistics drop column if exists rating;
alter table public.game_statistics drop column if exists best_rating;
alter table public.leaderboard drop column if exists rating;

alter table public.users add column if not exists role text not null default 'user';
alter table public.users add column if not exists account_status text not null default 'active';
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists ranking_points integer not null default 1200;
alter table public.profiles add column if not exists rank_title text not null default 'Unranked';
alter table public.game_statistics add column if not exists ranking_points integer not null default 1200;
alter table public.game_statistics add column if not exists rank_title text not null default 'Unranked';
alter table public.leaderboard add column if not exists ranking_points integer not null default 1200;
alter table public.leaderboard add column if not exists rank_title text not null default 'Unranked';
alter table public.games add column if not exists ranked_result_applied boolean not null default false;

update public.users
set role = 'user'
where role is null or role not in ('admin', 'user');

update public.users
set account_status = 'active'
where account_status is null or account_status not in ('active', 'inactive');

alter table public.users alter column role set default 'user';
alter table public.users alter column role set not null;
alter table public.users alter column account_status set default 'active';
alter table public.users alter column account_status set not null;

update public.profiles
set full_name = coalesce(nullif(trim(full_name), ''), username)
where full_name is null or trim(full_name) = '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'users_role_check'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users add constraint users_role_check check (role in ('admin', 'user'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'users_account_status_check'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users add constraint users_account_status_check check (account_status in ('active', 'inactive'));
  end if;
end;
$$;

update public.profiles
set rank_title = public.rank_title_for_points(ranking_points);

update public.game_statistics
set rank_title = public.rank_title_for_points(ranking_points);

update public.leaderboard
set rank_title = public.rank_title_for_points(ranking_points);

create index if not exists users_role_status_idx on public.users (role, account_status, created_at desc);
create index if not exists admin_sessions_expires_idx on public.admin_sessions (expires_at);
create index if not exists games_players_idx on public.games (white_user_id, black_user_id);
create index if not exists games_status_idx on public.games (status);
create index if not exists moves_game_idx on public.moves (game_id, move_number);
create index if not exists saved_games_user_idx on public.saved_games (user_id, updated_at desc);
drop index if exists leaderboard_rating_idx;
create index if not exists leaderboard_ranking_idx on public.leaderboard (ranking_points desc, wins desc, draws desc, losses asc);
create index if not exists leaderboard_results_idx on public.leaderboard (wins desc, draws desc, losses asc);
create index if not exists friend_challenges_challenger_idx on public.friend_challenges (challenger_id, updated_at desc);
create index if not exists friend_challenges_opponent_idx on public.friend_challenges (opponent_id, updated_at desc);
create unique index if not exists friend_challenges_pending_unique_idx
  on public.friend_challenges (challenger_id, opponent_id)
  where status = 'pending';
create index if not exists online_users_last_seen_idx on public.online_users (last_seen desc);

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at before update on public.users for each row execute function public.set_updated_at();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

drop trigger if exists set_profiles_rank_title on public.profiles;
create trigger set_profiles_rank_title before insert or update of ranking_points on public.profiles for each row execute function public.set_rank_title();

drop trigger if exists set_user_settings_updated_at on public.user_settings;
create trigger set_user_settings_updated_at before update on public.user_settings for each row execute function public.set_updated_at();

drop trigger if exists set_games_updated_at on public.games;
create trigger set_games_updated_at before update on public.games for each row execute function public.set_updated_at();

drop trigger if exists set_saved_games_updated_at on public.saved_games;
create trigger set_saved_games_updated_at before update on public.saved_games for each row execute function public.set_updated_at();

drop trigger if exists set_game_statistics_updated_at on public.game_statistics;
create trigger set_game_statistics_updated_at before update on public.game_statistics for each row execute function public.set_updated_at();

drop trigger if exists set_game_statistics_rank_title on public.game_statistics;
create trigger set_game_statistics_rank_title before insert or update of ranking_points on public.game_statistics for each row execute function public.set_rank_title();

drop trigger if exists set_leaderboard_rank_title on public.leaderboard;
create trigger set_leaderboard_rank_title before insert or update of ranking_points on public.leaderboard for each row execute function public.set_rank_title();

drop trigger if exists set_leaderboard_updated_at on public.leaderboard;
create trigger set_leaderboard_updated_at before update on public.leaderboard for each row execute function public.set_updated_at();

drop trigger if exists set_friend_challenges_updated_at on public.friend_challenges;
create trigger set_friend_challenges_updated_at before update on public.friend_challenges for each row execute function public.set_updated_at();

drop trigger if exists set_online_users_updated_at on public.online_users;
create trigger set_online_users_updated_at before update on public.online_users for each row execute function public.set_updated_at();

drop trigger if exists set_admin_credentials_updated_at on public.admin_credentials;
create trigger set_admin_credentials_updated_at before update on public.admin_credentials for each row execute function public.set_updated_at();

create or replace function public.available_profile_username(base_name text, target_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
begin
  candidate := coalesce(nullif(trim(base_name), ''), 'player');

  if exists (
    select 1
    from public.profiles
    where lower(username) = lower(candidate)
      and id <> target_user_id
  ) then
    candidate := candidate || '-' || left(target_user_id::text, 8);
  end if;

  return candidate;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_name text;
  profile_full_name text;
begin
  profile_name := public.available_profile_username(
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1), 'player'),
    new.id
  );
  profile_full_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'username'), ''),
    profile_name
  );

  insert into public.users (id, email, role, account_status)
  values (new.id, new.email, 'user', 'active')
  on conflict (id) do update set email = excluded.email;

  insert into public.profiles (id, username, full_name)
  values (new.id, profile_name, profile_full_name)
  on conflict (id) do update set full_name = coalesce(public.profiles.full_name, excluded.full_name);

  insert into public.user_settings (user_id, settings)
  values (new.id, '{}'::jsonb)
  on conflict (user_id) do nothing;

  insert into public.game_statistics (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.leaderboard (user_id, username)
  values (new.id, profile_name)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create or replace function public.accept_friend_challenge(target_challenge_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  challenge_row public.friend_challenges%rowtype;
  new_game_id uuid;
  white_id uuid;
  black_id uuid;
begin
  select *
  into challenge_row
  from public.friend_challenges
  where id = target_challenge_id
  for update;

  if not found then
    raise exception 'Challenge not found.';
  end if;

  if auth.uid() <> challenge_row.opponent_id then
    raise exception 'Only the challenged player can accept this challenge.';
  end if;

  if challenge_row.status = 'accepted' and challenge_row.game_id is not null then
    return challenge_row.game_id;
  end if;

  if challenge_row.status <> 'pending' then
    raise exception 'This challenge is no longer pending.';
  end if;

  if challenge_row.color_preference = 'white' then
    white_id := challenge_row.challenger_id;
    black_id := challenge_row.opponent_id;
  elsif challenge_row.color_preference = 'black' then
    white_id := challenge_row.opponent_id;
    black_id := challenge_row.challenger_id;
  elsif random() < 0.5 then
    white_id := challenge_row.challenger_id;
    black_id := challenge_row.opponent_id;
  else
    white_id := challenge_row.opponent_id;
    black_id := challenge_row.challenger_id;
  end if;

  insert into public.games (
    white_user_id,
    black_user_id,
    mode,
    status,
    current_fen,
    metadata
  )
  values (
    white_id,
    black_id,
    'friend',
    'active',
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    jsonb_build_object('challenge_id', challenge_row.id)
  )
  returning id into new_game_id;

  update public.friend_challenges
  set status = 'accepted',
      game_id = new_game_id,
      responded_at = now()
  where id = challenge_row.id;

  return new_game_id;
end;
$$;

create or replace function public.apply_ranked_game_result(target_game_id uuid)
returns table (user_id uuid, ranking_points integer, rank_title text)
language plpgsql
security definer
set search_path = public
as $$
declare
  game_row public.games%rowtype;
  white_delta integer := 0;
  black_delta integer := 0;
  white_wins integer := 0;
  white_losses integer := 0;
  black_wins integer := 0;
  black_losses integer := 0;
  draw_count integer := 0;
begin
  select *
  into game_row
  from public.games
  where id = target_game_id
  for update;

  if not found then
    raise exception 'Game not found.';
  end if;

  if auth.uid() not in (game_row.white_user_id, game_row.black_user_id) then
    raise exception 'Only game participants can apply this result.';
  end if;

  if game_row.status <> 'completed' or game_row.result is null then
    raise exception 'Game is not complete.';
  end if;

  if game_row.ranked_result_applied then
    return query
    select leaderboard.user_id, leaderboard.ranking_points, leaderboard.rank_title
    from public.leaderboard
    where leaderboard.user_id in (game_row.white_user_id, game_row.black_user_id);
    return;
  end if;

  if game_row.result = '1-0' then
    white_delta := 25;
    black_delta := -15;
    white_wins := 1;
    black_losses := 1;
  elsif game_row.result = '0-1' then
    white_delta := -15;
    black_delta := 25;
    white_losses := 1;
    black_wins := 1;
  elsif game_row.result = '1/2-1/2' then
    white_delta := 5;
    black_delta := 5;
    draw_count := 1;
  else
    raise exception 'Unsupported game result.';
  end if;

  insert into public.game_statistics (user_id)
  values (game_row.white_user_id), (game_row.black_user_id)
  on conflict (user_id) do nothing;

  update public.profiles
  set wins = wins + white_wins,
      losses = losses + white_losses,
      draws = draws + draw_count,
      ranking_points = greatest(0, ranking_points + white_delta)
  where id = game_row.white_user_id;

  update public.profiles
  set wins = wins + black_wins,
      losses = losses + black_losses,
      draws = draws + draw_count,
      ranking_points = greatest(0, ranking_points + black_delta)
  where id = game_row.black_user_id;

  update public.game_statistics
  set games_played = games_played + 1,
      wins = wins + white_wins,
      losses = losses + white_losses,
      draws = draws + draw_count,
      current_streak = case
        when white_wins = 1 then current_streak + 1
        when white_losses = 1 then 0
        else current_streak
      end,
      longest_streak = case
        when white_wins = 1 then greatest(longest_streak, current_streak + 1)
        else longest_streak
      end,
      ranking_points = greatest(0, ranking_points + white_delta)
  where user_id = game_row.white_user_id;

  update public.game_statistics
  set games_played = games_played + 1,
      wins = wins + black_wins,
      losses = losses + black_losses,
      draws = draws + draw_count,
      current_streak = case
        when black_wins = 1 then current_streak + 1
        when black_losses = 1 then 0
        else current_streak
      end,
      longest_streak = case
        when black_wins = 1 then greatest(longest_streak, current_streak + 1)
        else longest_streak
      end,
      ranking_points = greatest(0, ranking_points + black_delta)
  where user_id = game_row.black_user_id;

  insert into public.leaderboard (user_id, username, avatar_url, wins, losses, draws, ranking_points, rank_title)
  select id, username, avatar_url, wins, losses, draws, ranking_points, rank_title
  from public.profiles
  where id in (game_row.white_user_id, game_row.black_user_id)
  on conflict (user_id) do update
  set username = excluded.username,
      avatar_url = excluded.avatar_url,
      wins = excluded.wins,
      losses = excluded.losses,
      draws = excluded.draws,
      ranking_points = excluded.ranking_points,
      rank_title = excluded.rank_title,
      updated_at = now();

  update public.games
  set ranked_result_applied = true
  where id = game_row.id;

  return query
  select leaderboard.user_id, leaderboard.ranking_points, leaderboard.rank_title
  from public.leaderboard
  where leaderboard.user_id in (game_row.white_user_id, game_row.black_user_id);
end;
$$;

create or replace function public.touch_online_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  current_email text;
  profile_name text;
begin
  current_user_id := auth.uid();
  current_email := auth.jwt()->>'email';

  if current_user_id is null then
    raise exception 'Login is required to mark a player online.';
  end if;

  insert into public.users (id, email)
  values (current_user_id, current_email)
  on conflict (id) do update set email = excluded.email;

  profile_name := public.available_profile_username(
    coalesce(nullif(split_part(current_email, '@', 1), ''), 'player'),
    current_user_id
  );

  insert into public.profiles (id, username, full_name)
  values (current_user_id, profile_name, profile_name)
  on conflict (id) do update
  set username = coalesce(nullif(public.profiles.username, ''), excluded.username),
      full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name);

  insert into public.online_users (user_id, last_seen)
  values (current_user_id, now())
  on conflict (user_id) do update set last_seen = excluded.last_seen;
end;
$$;

create or replace function public.create_online_player_challenge(
  target_opponent_id uuid,
  target_color_preference text default 'random'
)
returns public.friend_challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  normalized_color text;
  challenge_row public.friend_challenges%rowtype;
begin
  current_user_id := auth.uid();
  normalized_color := coalesce(nullif(trim(target_color_preference), ''), 'random');

  if current_user_id is null then
    raise exception 'Login is required to challenge an online player.';
  end if;

  if target_opponent_id is null then
    raise exception 'Choose an online player to challenge.';
  end if;

  if target_opponent_id = current_user_id then
    raise exception 'Choose another online player to challenge.';
  end if;

  if normalized_color not in ('white', 'black', 'random') then
    raise exception 'Unsupported color preference.';
  end if;

  perform public.touch_online_user();

  if not exists (
    select 1
    from public.online_users
    where user_id = target_opponent_id
      and last_seen >= now() - interval '90 seconds'
  ) then
    raise exception 'That player is no longer online.';
  end if;

  select *
  into challenge_row
  from public.friend_challenges
  where status = 'pending'
    and (
      (challenger_id = current_user_id and opponent_id = target_opponent_id)
      or (challenger_id = target_opponent_id and opponent_id = current_user_id)
    )
  order by updated_at desc
  limit 1;

  if found then
    return challenge_row;
  end if;

  insert into public.friend_challenges (
    challenger_id,
    opponent_id,
    color_preference,
    status
  )
  values (
    current_user_id,
    target_opponent_id,
    normalized_color,
    'pending'
  )
  returning * into challenge_row;

  return challenge_row;
end;
$$;

create or replace function public.create_friend_challenge_by_username(
  target_opponent_username text,
  target_color_preference text default 'random'
)
returns public.friend_challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  normalized_username text;
  normalized_color text;
  target_opponent_id uuid;
  challenge_row public.friend_challenges%rowtype;
begin
  current_user_id := auth.uid();
  normalized_username := nullif(trim(target_opponent_username), '');
  normalized_color := coalesce(nullif(trim(target_color_preference), ''), 'random');

  if current_user_id is null then
    raise exception 'Login is required to challenge a friend.';
  end if;

  if normalized_username is null then
    raise exception 'Enter a username to challenge.';
  end if;

  if normalized_color not in ('white', 'black', 'random') then
    raise exception 'Unsupported color preference.';
  end if;

  select profiles.id
  into target_opponent_id
  from public.profiles
  where lower(profiles.username) = lower(normalized_username)
  order by profiles.created_at asc, profiles.id asc
  limit 1;

  if not found then
    raise exception 'No player found with that username.';
  end if;

  if target_opponent_id = current_user_id then
    raise exception 'Choose another player to challenge.';
  end if;

  perform public.touch_online_user();

  select *
  into challenge_row
  from public.friend_challenges
  where status = 'pending'
    and (
      (challenger_id = current_user_id and opponent_id = target_opponent_id)
      or (challenger_id = target_opponent_id and opponent_id = current_user_id)
    )
  order by updated_at desc
  limit 1;

  if found then
    return challenge_row;
  end if;

  insert into public.friend_challenges (
    challenger_id,
    opponent_id,
    color_preference,
    status
  )
  values (
    current_user_id,
    target_opponent_id,
    normalized_color,
    'pending'
  )
  returning * into challenge_row;

  return challenge_row;
end;
$$;

create or replace function public.set_friend_challenge_status(
  target_challenge_id uuid,
  target_status text
)
returns public.friend_challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  normalized_status text;
  challenge_row public.friend_challenges%rowtype;
begin
  current_user_id := auth.uid();
  normalized_status := lower(coalesce(nullif(trim(target_status), ''), ''));

  if current_user_id is null then
    raise exception 'Login is required to update a challenge.';
  end if;

  if normalized_status not in ('declined', 'canceled') then
    raise exception 'Use the accept action to start a game, or choose decline/cancel.';
  end if;

  select *
  into challenge_row
  from public.friend_challenges
  where id = target_challenge_id
  for update;

  if not found then
    raise exception 'Challenge not found.';
  end if;

  if challenge_row.status <> 'pending' then
    raise exception 'This challenge is no longer pending.';
  end if;

  if normalized_status = 'declined' and current_user_id <> challenge_row.opponent_id then
    raise exception 'Only the challenged player can decline this challenge.';
  end if;

  if normalized_status = 'canceled' and current_user_id <> challenge_row.challenger_id then
    raise exception 'Only the challenger can cancel this challenge.';
  end if;

  update public.friend_challenges
  set status = normalized_status,
      responded_at = now()
  where id = challenge_row.id
  returning * into challenge_row;

  return challenge_row;
end;
$$;

create or replace function public.leave_online_user()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.online_users
  where user_id = auth.uid();
$$;

drop function if exists public.list_online_profiles(integer);

create or replace function public.list_online_profiles(stale_after_seconds integer default 90)
returns table (
  id uuid,
  username text,
  avatar_url text,
  ranking_points integer,
  rank_title text,
  email text,
  last_seen timestamptz,
  challenge_id uuid,
  challenge_status text,
  challenge_direction text,
  challenge_game_id uuid,
  challenge_color_preference text,
  challenge_updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    online_users.user_id as id,
    coalesce(profiles.username, split_part(users.email, '@', 1), 'player') as username,
    profiles.avatar_url,
    coalesce(profiles.ranking_points, 1200) as ranking_points,
    coalesce(profiles.rank_title, public.rank_title_for_points(coalesce(profiles.ranking_points, 1200))) as rank_title,
    users.email,
    online_users.last_seen,
    active_challenge.id as challenge_id,
    active_challenge.status as challenge_status,
    active_challenge.direction as challenge_direction,
    active_challenge.game_id as challenge_game_id,
    active_challenge.color_preference as challenge_color_preference,
    active_challenge.updated_at as challenge_updated_at
  from public.online_users
  left join public.profiles on profiles.id = online_users.user_id
  left join public.users on users.id = online_users.user_id
  left join lateral (
    select
      friend_challenges.*,
      case
        when friend_challenges.challenger_id = auth.uid() then 'outgoing'
        else 'incoming'
      end as direction
    from public.friend_challenges
    where online_users.user_id <> auth.uid()
      and friend_challenges.status in ('pending', 'accepted')
      and (
        (friend_challenges.challenger_id = auth.uid() and friend_challenges.opponent_id = online_users.user_id)
        or (friend_challenges.opponent_id = auth.uid() and friend_challenges.challenger_id = online_users.user_id)
      )
    order by
      case friend_challenges.status
        when 'pending' then 0
        when 'accepted' then 1
        else 2
      end,
      friend_challenges.updated_at desc
    limit 1
  ) active_challenge on true
  where auth.uid() is not null
    and online_users.last_seen >= now() - (greatest(coalesce(stale_after_seconds, 90), 30) * interval '1 second')
  order by coalesce(profiles.username, split_part(users.email, '@', 1), 'player') asc;
$$;

drop function if exists public.list_challenge_profiles(integer);

create or replace function public.list_challenge_profiles(stale_after_seconds integer default 90)
returns table (
  id uuid,
  username text,
  avatar_url text,
  ranking_points integer,
  rank_title text,
  email text,
  last_seen timestamptz,
  is_online boolean,
  challenge_id uuid,
  challenge_status text,
  challenge_direction text,
  challenge_game_id uuid,
  challenge_color_preference text,
  challenge_updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    online_users.user_id as id,
    coalesce(profiles.username, split_part(users.email, '@', 1), 'player') as username,
    profiles.avatar_url,
    coalesce(profiles.ranking_points, 1200) as ranking_points,
    coalesce(profiles.rank_title, public.rank_title_for_points(coalesce(profiles.ranking_points, 1200))) as rank_title,
    users.email,
    online_users.last_seen,
    true as is_online,
    active_challenge.id as challenge_id,
    active_challenge.status as challenge_status,
    active_challenge.direction as challenge_direction,
    active_challenge.game_id as challenge_game_id,
    active_challenge.color_preference as challenge_color_preference,
    active_challenge.updated_at as challenge_updated_at
  from public.online_users
  left join public.profiles on profiles.id = online_users.user_id
  left join public.users on users.id = online_users.user_id
  left join lateral (
    select
      friend_challenges.*,
      case
        when friend_challenges.challenger_id = auth.uid() then 'outgoing'
        else 'incoming'
      end as direction
    from public.friend_challenges
    where auth.uid() is not null
      and friend_challenges.status in ('pending', 'accepted')
      and (
        (friend_challenges.challenger_id = auth.uid() and friend_challenges.opponent_id = online_users.user_id)
        or (friend_challenges.opponent_id = auth.uid() and friend_challenges.challenger_id = online_users.user_id)
      )
    order by
      case friend_challenges.status
        when 'pending' then 0
        when 'accepted' then 1
        else 2
      end,
      friend_challenges.updated_at desc
    limit 1
  ) active_challenge on true
  where online_users.last_seen >= now() - (greatest(coalesce(stale_after_seconds, 90), 30) * interval '1 second')
  order by coalesce(profiles.username, split_part(users.email, '@', 1), 'player') asc;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where users.id = auth.uid()
      and users.role = 'admin'
      and users.account_status = 'active'
  );
$$;

create or replace function public.has_valid_admin_session(admin_session_token text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(length(admin_session_token), 0) > 0
    and exists (
      select 1
      from public.admin_sessions sessions
      join public.admin_credentials credentials on credentials.username = sessions.username
      where sessions.token_hash = encode(extensions.digest(admin_session_token, 'sha256'), 'hex')
        and sessions.expires_at > now()
        and credentials.role = 'admin'
    );
$$;

create or replace function public.require_admin_access(admin_session_token text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return;
  end if;

  if public.has_valid_admin_session(admin_session_token) then
    update public.admin_sessions
    set last_used_at = now()
    where token_hash = encode(extensions.digest(admin_session_token, 'sha256'), 'hex')
      and expires_at > now();
    return;
  end if;

  raise exception 'Admin access required.' using errcode = '42501';
end;
$$;

create or replace function public.admin_login(target_username text, target_password text)
returns table (admin_username text, role text, session_token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  credential_row public.admin_credentials%rowtype;
  raw_token text;
  token_expires_at timestamptz;
begin
  select *
  into credential_row
  from public.admin_credentials
  where lower(username) = lower(trim(coalesce(target_username, '')))
    and admin_credentials.role = 'admin';

  if not found or credential_row.password_hash <> extensions.crypt(coalesce(target_password, ''), credential_row.password_hash) then
    raise exception 'Invalid admin username or password.' using errcode = '28000';
  end if;

  delete from public.admin_sessions
  where admin_sessions.expires_at <= now();

  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  token_expires_at := now() + interval '8 hours';

  insert into public.admin_sessions (username, token_hash, expires_at)
  values (credential_row.username, encode(extensions.digest(raw_token, 'sha256'), 'hex'), token_expires_at);

  admin_username := credential_row.username;
  role := credential_row.role;
  session_token := raw_token;
  expires_at := token_expires_at;
  return next;
end;
$$;

create or replace function public.admin_validate_session(admin_session_token text)
returns table (admin_username text, role text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.admin_sessions sessions
  set last_used_at = now()
  from public.admin_credentials credentials
  where credentials.username = sessions.username
    and sessions.token_hash = encode(extensions.digest(admin_session_token, 'sha256'), 'hex')
    and sessions.expires_at > now()
    and credentials.role = 'admin'
  returning sessions.username, credentials.role, sessions.expires_at;
end;
$$;

create or replace function public.admin_logout(admin_session_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.admin_sessions
  where token_hash = encode(extensions.digest(coalesce(admin_session_token, ''), 'sha256'), 'hex');
  return true;
end;
$$;

create or replace function public.admin_list_users(
  admin_session_token text default null,
  search_text text default '',
  status_filter text default 'all',
  role_filter text default 'all'
)
returns table (
  user_id uuid,
  full_name text,
  email text,
  role text,
  account_status text,
  date_registered timestamptz,
  username text,
  avatar_url text,
  wins integer,
  losses integer,
  draws integer,
  ranking_points integer,
  rank_title text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_search text;
  normalized_status text;
  normalized_role text;
begin
  perform public.require_admin_access(admin_session_token);

  normalized_search := nullif(trim(coalesce(search_text, '')), '');
  normalized_status := lower(coalesce(nullif(trim(status_filter), ''), 'all'));
  normalized_role := lower(coalesce(nullif(trim(role_filter), ''), 'all'));

  if normalized_status not in ('all', 'active', 'inactive') then
    normalized_status := 'all';
  end if;

  if normalized_role not in ('all', 'admin', 'user') then
    normalized_role := 'all';
  end if;

  return query
  select
    users.id as user_id,
    coalesce(nullif(trim(profiles.full_name), ''), profiles.username, split_part(users.email, '@', 1), 'Unnamed user') as full_name,
    users.email,
    users.role,
    users.account_status,
    users.created_at as date_registered,
    profiles.username,
    profiles.avatar_url,
    coalesce(profiles.wins, 0) as wins,
    coalesce(profiles.losses, 0) as losses,
    coalesce(profiles.draws, 0) as draws,
    coalesce(profiles.ranking_points, 1200) as ranking_points,
    coalesce(profiles.rank_title, 'Unranked') as rank_title,
    users.updated_at
  from public.users
  left join public.profiles on profiles.id = users.id
  where (normalized_status = 'all' or users.account_status = normalized_status)
    and (normalized_role = 'all' or users.role = normalized_role)
    and (
      normalized_search is null
      or users.id::text ilike '%' || normalized_search || '%'
      or users.email ilike '%' || normalized_search || '%'
      or profiles.username ilike '%' || normalized_search || '%'
      or profiles.full_name ilike '%' || normalized_search || '%'
    )
  order by users.created_at desc, users.email asc;
end;
$$;

create or replace function public.admin_get_user(admin_session_token text default null, target_user_id uuid default null)
returns table (
  user_id uuid,
  full_name text,
  email text,
  role text,
  account_status text,
  date_registered timestamptz,
  username text,
  avatar_url text,
  wins integer,
  losses integer,
  draws integer,
  ranking_points integer,
  rank_title text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_admin_access(admin_session_token);

  return query
  select
    users.id as user_id,
    coalesce(nullif(trim(profiles.full_name), ''), profiles.username, split_part(users.email, '@', 1), 'Unnamed user') as full_name,
    users.email,
    users.role,
    users.account_status,
    users.created_at as date_registered,
    profiles.username,
    profiles.avatar_url,
    coalesce(profiles.wins, 0) as wins,
    coalesce(profiles.losses, 0) as losses,
    coalesce(profiles.draws, 0) as draws,
    coalesce(profiles.ranking_points, 1200) as ranking_points,
    coalesce(profiles.rank_title, 'Unranked') as rank_title,
    users.updated_at
  from public.users
  left join public.profiles on profiles.id = users.id
  where users.id = target_user_id;
end;
$$;

create or replace function public.admin_update_user(
  admin_session_token text default null,
  target_user_id uuid default null,
  target_full_name text default '',
  target_email text default '',
  target_role text default 'user',
  target_account_status text default 'active'
)
returns table (
  user_id uuid,
  full_name text,
  email text,
  role text,
  account_status text,
  date_registered timestamptz,
  username text,
  avatar_url text,
  wins integer,
  losses integer,
  draws integer,
  ranking_points integer,
  rank_title text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text;
  normalized_full_name text;
  normalized_role text;
  normalized_status text;
  fallback_username text;
begin
  perform public.require_admin_access(admin_session_token);

  if target_user_id is null then
    raise exception 'User ID is required.';
  end if;

  normalized_email := lower(nullif(trim(coalesce(target_email, '')), ''));
  normalized_full_name := nullif(trim(coalesce(target_full_name, '')), '');
  normalized_role := lower(coalesce(nullif(trim(target_role), ''), 'user'));
  normalized_status := lower(coalesce(nullif(trim(target_account_status), ''), 'active'));

  if normalized_email is null then
    raise exception 'Email address is required.';
  end if;

  if normalized_role not in ('admin', 'user') then
    raise exception 'Unsupported user role.';
  end if;

  if normalized_status not in ('active', 'inactive') then
    raise exception 'Unsupported account status.';
  end if;

  if auth.uid() = target_user_id and normalized_status = 'inactive' then
    raise exception 'You cannot deactivate your current admin account.';
  end if;

  if not exists (select 1 from public.users where users.id = target_user_id) then
    raise exception 'User not found.';
  end if;

  normalized_full_name := coalesce(normalized_full_name, split_part(normalized_email, '@', 1), 'User');
  fallback_username := public.available_profile_username(split_part(normalized_email, '@', 1), target_user_id);

  update public.users
  set email = normalized_email,
      role = normalized_role,
      account_status = normalized_status
  where users.id = target_user_id;

  insert into public.profiles (id, username, full_name)
  values (target_user_id, fallback_username, normalized_full_name)
  on conflict (id) do update set full_name = excluded.full_name;

  begin
    update auth.users
    set email = normalized_email,
        raw_user_meta_data = jsonb_set(coalesce(raw_user_meta_data, '{}'::jsonb), '{full_name}', to_jsonb(normalized_full_name), true),
        updated_at = now()
    where auth.users.id = target_user_id;
  exception
    when insufficient_privilege or undefined_table then
      null;
  end;

  return query
  select *
  from public.admin_get_user(admin_session_token, target_user_id);
end;
$$;

create or replace function public.admin_set_user_status(
  admin_session_token text default null,
  target_user_id uuid default null,
  target_account_status text default 'active'
)
returns table (
  user_id uuid,
  full_name text,
  email text,
  role text,
  account_status text,
  date_registered timestamptz,
  username text,
  avatar_url text,
  wins integer,
  losses integer,
  draws integer,
  ranking_points integer,
  rank_title text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_status text;
begin
  perform public.require_admin_access(admin_session_token);

  normalized_status := lower(coalesce(nullif(trim(target_account_status), ''), 'active'));
  if normalized_status not in ('active', 'inactive') then
    raise exception 'Unsupported account status.';
  end if;

  if auth.uid() = target_user_id and normalized_status = 'inactive' then
    raise exception 'You cannot deactivate your current admin account.';
  end if;

  update public.users
  set account_status = normalized_status
  where users.id = target_user_id;

  if not found then
    raise exception 'User not found.';
  end if;

  return query
  select *
  from public.admin_get_user(admin_session_token, target_user_id);
end;
$$;

create or replace function public.admin_delete_user(admin_session_token text default null, target_user_id uuid default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_auth_user boolean := false;
begin
  perform public.require_admin_access(admin_session_token);

  if target_user_id is null then
    raise exception 'User ID is required.';
  end if;

  if auth.uid() = target_user_id then
    raise exception 'You cannot delete your current admin account.';
  end if;

  begin
    delete from auth.users
    where auth.users.id = target_user_id;
    deleted_auth_user := found;
  exception
    when insufficient_privilege or undefined_table then
      deleted_auth_user := false;
  end;

  if not deleted_auth_user then
    delete from public.users
    where users.id = target_user_id;
    if not found then
      raise exception 'User not found.';
    end if;
  end if;

  return true;
end;
$$;
grant execute on function public.admin_login(text, text) to anon, authenticated;
grant execute on function public.admin_validate_session(text) to anon, authenticated;
grant execute on function public.admin_logout(text) to anon, authenticated;
grant execute on function public.admin_list_users(text, text, text, text) to anon, authenticated;
grant execute on function public.admin_get_user(text, uuid) to anon, authenticated;
grant execute on function public.admin_update_user(text, uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.admin_set_user_status(text, uuid, text) to anon, authenticated;
grant execute on function public.admin_delete_user(text, uuid) to anon, authenticated;
grant execute on function public.accept_friend_challenge(uuid) to authenticated;
grant execute on function public.apply_ranked_game_result(uuid) to authenticated;
grant execute on function public.touch_online_user() to authenticated;
grant execute on function public.create_online_player_challenge(uuid, text) to authenticated;
grant execute on function public.create_friend_challenge_by_username(text, text) to authenticated;
grant execute on function public.set_friend_challenge_status(uuid, text) to authenticated;
grant execute on function public.leave_online_user() to authenticated;
grant execute on function public.list_online_profiles(integer) to authenticated;
grant execute on function public.list_challenge_profiles(integer) to anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.users (id, email, role, account_status, created_at, updated_at)
select id, email, 'user', 'active', created_at, now()
from auth.users
on conflict (id) do update set email = excluded.email;

insert into public.admin_credentials (username, password_hash, role)
values ('admin', extensions.crypt('norzel123123e', extensions.gen_salt('bf')), 'admin')
on conflict (username) do update
set password_hash = excluded.password_hash,
    role = excluded.role,
    updated_at = now();

with auth_user_base as (
  select
    auth_users.id,
    auth_users.created_at,
    coalesce(
      nullif(trim(auth_users.raw_user_meta_data->>'username'), ''),
      nullif(split_part(auth_users.email, '@', 1), ''),
      'player'
    ) as base_username
  from auth.users auth_users
),
numbered_auth_users as (
  select
    id,
    created_at,
    base_username,
    row_number() over (partition by lower(base_username) order by created_at, id) as username_number
  from auth_user_base
),
profile_names as (
  select
    id,
    case
      when username_number = 1 then public.available_profile_username(base_username, id)
      else public.available_profile_username(base_username || '-' || left(id::text, 8), id)
    end as username
  from numbered_auth_users
)
insert into public.profiles (id, username, full_name)
select id, username, username
from profile_names
on conflict do nothing;

update public.profiles
set full_name = coalesce(nullif(trim(full_name), ''), username)
where full_name is null or trim(full_name) = '';

insert into public.user_settings (user_id, settings)
select id, '{}'::jsonb
from auth.users
on conflict (user_id) do nothing;

insert into public.game_statistics (user_id)
select id
from auth.users
on conflict (user_id) do nothing;

insert into public.leaderboard (user_id, username, avatar_url, wins, losses, draws, ranking_points, rank_title)
select id, username, avatar_url, wins, losses, draws, ranking_points, rank_title
from public.profiles
on conflict (user_id) do update
set username = excluded.username,
    avatar_url = excluded.avatar_url,
    wins = excluded.wins,
    losses = excluded.losses,
    draws = excluded.draws,
    ranking_points = excluded.ranking_points,
    rank_title = excluded.rank_title,
    updated_at = now();

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'games'
  ) then
    alter publication supabase_realtime add table public.games;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'moves'
  ) then
    alter publication supabase_realtime add table public.moves;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'saved_games'
  ) then
    alter publication supabase_realtime add table public.saved_games;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'friend_challenges'
  ) then
    alter publication supabase_realtime add table public.friend_challenges;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'online_users'
  ) then
    alter publication supabase_realtime add table public.online_users;
  end if;
end;
$$;

alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.games enable row level security;
alter table public.moves enable row level security;
alter table public.saved_games enable row level security;
alter table public.game_statistics enable row level security;
alter table public.leaderboard enable row level security;
alter table public.friend_challenges enable row level security;
alter table public.online_users enable row level security;
alter table public.admin_credentials enable row level security;
alter table public.admin_sessions enable row level security;

drop policy if exists "Users read own row" on public.users;
create policy "Users read own row" on public.users
for select to authenticated using (auth.uid() = id or public.is_admin());

drop policy if exists "Users update own row" on public.users;
drop policy if exists "Admins update users" on public.users;
create policy "Admins update users" on public.users
for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Profiles are public" on public.profiles;
create policy "Profiles are public" on public.profiles
for select to anon, authenticated using (auth.role() in ('anon', 'authenticated'));

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile" on public.profiles
for insert to authenticated with check (auth.uid() = id);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles
for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users read own settings" on public.user_settings;
create policy "Users read own settings" on public.user_settings
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users write own settings" on public.user_settings;
drop policy if exists "Users insert own settings" on public.user_settings;
create policy "Users insert own settings" on public.user_settings
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users update own settings" on public.user_settings;
create policy "Users update own settings" on public.user_settings
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users delete own settings" on public.user_settings;
create policy "Users delete own settings" on public.user_settings
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Game participants read games" on public.games;
create policy "Game participants read games" on public.games
for select using (auth.uid() in (white_user_id, black_user_id) or status = 'public');

drop policy if exists "Game participants create games" on public.games;
create policy "Game participants create games" on public.games
for insert with check (auth.uid() in (white_user_id, black_user_id));

drop policy if exists "Game participants update games" on public.games;
create policy "Game participants update games" on public.games
for update using (auth.uid() in (white_user_id, black_user_id))
with check (auth.uid() in (white_user_id, black_user_id));

drop policy if exists "Game participants read moves" on public.moves;
create policy "Game participants read moves" on public.moves
for select using (
  exists (
    select 1 from public.games
    where games.id = moves.game_id
    and (auth.uid() in (games.white_user_id, games.black_user_id) or games.status = 'public')
  )
);

drop policy if exists "Game participants write moves" on public.moves;
create policy "Game participants write moves" on public.moves
for insert with check (
  exists (
    select 1 from public.games
    where games.id = moves.game_id
    and auth.uid() in (games.white_user_id, games.black_user_id)
  )
);

drop policy if exists "Users manage own saved games" on public.saved_games;
drop policy if exists "Users read own saved games" on public.saved_games;
create policy "Users read own saved games" on public.saved_games
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users insert own saved games" on public.saved_games;
create policy "Users insert own saved games" on public.saved_games
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users update own saved games" on public.saved_games;
create policy "Users update own saved games" on public.saved_games
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users delete own saved games" on public.saved_games;
create policy "Users delete own saved games" on public.saved_games
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Users read own statistics" on public.game_statistics;
create policy "Users read own statistics" on public.game_statistics for select using (auth.uid() = user_id);

drop policy if exists "Users update own statistics" on public.game_statistics;
create policy "Users update own statistics" on public.game_statistics
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Leaderboard is public" on public.leaderboard;
create policy "Leaderboard is public" on public.leaderboard
for select to anon, authenticated using (auth.role() in ('anon', 'authenticated'));

drop policy if exists "Users update own leaderboard row" on public.leaderboard;
create policy "Users update own leaderboard row" on public.leaderboard
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users insert own leaderboard row" on public.leaderboard;
create policy "Users insert own leaderboard row" on public.leaderboard
for insert with check (auth.uid() = user_id);

drop policy if exists "Challenge participants read challenges" on public.friend_challenges;
create policy "Challenge participants read challenges" on public.friend_challenges
for select using (auth.uid() in (challenger_id, opponent_id));

drop policy if exists "Users create own challenges" on public.friend_challenges;
create policy "Users create own challenges" on public.friend_challenges
for insert with check (
  auth.uid() = challenger_id
  and challenger_id <> opponent_id
  and status = 'pending'
);

drop policy if exists "Challenge participants update challenges" on public.friend_challenges;
create policy "Challenge participants update challenges" on public.friend_challenges
for update to authenticated using (
  status = 'pending'
  and auth.uid() in (challenger_id, opponent_id)
)
with check (
  (auth.uid() = opponent_id and status = 'declined' and game_id is null)
  or (auth.uid() = challenger_id and status = 'canceled' and game_id is null)
);

drop policy if exists "Authenticated users read online users" on public.online_users;
create policy "Authenticated users read online users" on public.online_users
for select to authenticated using (auth.role() = 'authenticated');

drop policy if exists "Users insert own online row" on public.online_users;
create policy "Users insert own online row" on public.online_users
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users update own online row" on public.online_users;
create policy "Users update own online row" on public.online_users
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users delete own online row" on public.online_users;
create policy "Users delete own online row" on public.online_users
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Avatar images are public" on storage.objects;
create policy "Avatar images are public" on storage.objects
for select using (bucket_id = 'avatars');

drop policy if exists "Users upload own avatar" on storage.objects;
create policy "Users upload own avatar" on storage.objects
for insert with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users update own avatar" on storage.objects;
create policy "Users update own avatar" on storage.objects
for update using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1])
with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
