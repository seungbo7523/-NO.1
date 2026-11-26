begin;

do $$
declare
  existing_constraint record;
begin
  for existing_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.tracking_sessions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%ended_at%'
      and pg_get_constraintdef(oid) like '%end_lat%'
      and pg_get_constraintdef(oid) like '%end_lng%'
  loop
    execute format(
      'alter table public.tracking_sessions drop constraint %I',
      existing_constraint.conname
    );
  end loop;
end
$$;

alter table public.tracking_sessions
  add constraint tracking_sessions_end_state_check check (
    (ended_at is null and end_lat is null and end_lng is null)
    or (
      ended_at is not null and ended_at >= started_at
      and (
        (end_lat is null and end_lng is null)
        or (end_lat is not null and end_lng is not null)
      )
    )
  );

commit;
