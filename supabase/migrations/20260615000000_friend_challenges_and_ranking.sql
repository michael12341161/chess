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

create index if not exists leaderboard_ranking_idx on public.leaderboard (ranking_points desc, wins desc, draws desc, losses asc);
create index if not exists friend_challenges_challenger_idx on public.friend_challenges (challenger_id, updated_at desc);
create index if not exists friend_challenges_opponent_idx on public.friend_challenges (opponent_id, updated_at desc);
create unique index if not exists friend_challenges_pending_unique_idx
  on public.friend_challenges (challenger_id, opponent_id)
  where status = 'pending';

drop trigger if exists set_profiles_rank_title on public.profiles;
create trigger set_profiles_rank_title before insert or update of ranking_points on public.profiles for each row execute function public.set_rank_title();

drop trigger if exists set_game_statistics_rank_title on public.game_statistics;
create trigger set_game_statistics_rank_title before insert or update of ranking_points on public.game_statistics for each row execute function public.set_rank_title();

drop trigger if exists set_leaderboard_rank_title on public.leaderboard;
create trigger set_leaderboard_rank_title before insert or update of ranking_points on public.leaderboard for each row execute function public.set_rank_title();

drop trigger if exists set_leaderboard_updated_at on public.leaderboard;
create trigger set_leaderboard_updated_at before update on public.leaderboard for each row execute function public.set_updated_at();

drop trigger if exists set_friend_challenges_updated_at on public.friend_challenges;
create trigger set_friend_challenges_updated_at before update on public.friend_challenges for each row execute function public.set_updated_at();

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

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'friend_challenges'
  ) then
    alter publication supabase_realtime add table public.friend_challenges;
  end if;
end;
$$;

alter table public.friend_challenges enable row level security;

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
