begin;

alter table public.tracking_sessions
  add column if not exists max_altitude_m double precision;

create or replace function public.tracking_set_end_time()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.max_altitude_m := greatest(old.max_altitude_m, new.max_altitude_m);
  if new.ended_at is not null then
    new.ended_at := now();
  end if;
  return new;
end
$$;

drop policy if exists "Users can finish own tracking sessions" on public.tracking_sessions;
drop policy if exists "Users can update own active tracking sessions" on public.tracking_sessions;
create policy "Users can update own active tracking sessions"
  on public.tracking_sessions for update to authenticated
  using (user_id = (select auth.jwt()->>'sub') and ended_at is null)
  with check (user_id = (select auth.jwt()->>'sub'));
grant update (max_altitude_m) on public.tracking_sessions to authenticated;

commit;
