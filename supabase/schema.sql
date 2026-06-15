-- Chess Platform database schema.
-- Run this single file in Supabase SQL Editor to create the full database.

create extension if not exists pgcrypto;

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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references public.users(id) on delete cascade,
  username text unique not null,
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

alter table public.profiles drop column if exists rating;
alter table public.game_statistics drop column if exists rating;
alter table public.game_statistics drop column if exists best_rating;
alter table public.leaderboard drop column if exists rating;

alter table public.profiles add column if not exists ranking_points integer not null default 1200;
alter table public.profiles add column if not exists rank_title text not null default 'Unranked';
alter table public.game_statistics add column if not exists ranking_points integer not null default 1200;
alter table public.game_statistics add column if not exists rank_title text not null default 'Unranked';
alter table public.leaderboard add column if not exists ranking_points integer not null default 1200;
alter table public.leaderboard add column if not exists rank_title text not null default 'Unranked';
alter table public.games add column if not exists ranked_result_applied boolean not null default false;

update public.profiles
set rank_title = public.rank_title_for_points(ranking_points);

update public.game_statistics
set rank_title = public.rank_title_for_points(ranking_points);

update public.leaderboard
set rank_title = public.rank_title_for_points(ranking_points);

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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_name text;
begin
  profile_name := coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1), 'player');

  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;

  insert into public.profiles (id, username)
  values (new.id, profile_name)
  on conflict (id) do nothing;

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

grant execute on function public.accept_friend_challenge(uuid) to authenticated;
grant execute on function public.apply_ranked_game_result(uuid) to authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

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

drop policy if exists "Users read own row" on public.users;
create policy "Users read own row" on public.users for select using (auth.uid() = id);

drop policy if exists "Users update own row" on public.users;
create policy "Users update own row" on public.users for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Profiles are public" on public.profiles;
create policy "Profiles are public" on public.profiles for select using (true);

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users read own settings" on public.user_settings;
create policy "Users read own settings" on public.user_settings for select using (auth.uid() = user_id);

drop policy if exists "Users write own settings" on public.user_settings;
create policy "Users write own settings" on public.user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

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
create policy "Users manage own saved games" on public.saved_games
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users read own statistics" on public.game_statistics;
create policy "Users read own statistics" on public.game_statistics for select using (auth.uid() = user_id);

drop policy if exists "Users update own statistics" on public.game_statistics;
create policy "Users update own statistics" on public.game_statistics
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Leaderboard is public" on public.leaderboard;
create policy "Leaderboard is public" on public.leaderboard for select using (true);

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
for update using (auth.uid() in (challenger_id, opponent_id))
with check (auth.uid() in (challenger_id, opponent_id));

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
