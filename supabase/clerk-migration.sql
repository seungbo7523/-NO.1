-- Preserve existing messages and memberships while allowing Clerk's text user IDs.
begin;

alter table public.course_room_members drop constraint if exists course_room_members_user_id_fkey;
alter table public.course_room_messages drop constraint if exists course_room_messages_user_id_fkey;

drop policy if exists "Members can read their own room memberships" on public.course_room_members;
drop policy if exists "Users can join rooms as themselves" on public.course_room_members;
drop policy if exists "Users can leave their own rooms" on public.course_room_members;
drop policy if exists "Room members can read room messages" on public.course_room_messages;
drop policy if exists "Room members can send messages as themselves" on public.course_room_messages;

alter table public.course_room_members alter column user_id type text using user_id::text;
alter table public.course_room_messages alter column user_id type text using user_id::text;

create policy "Members can read their own room memberships"
  on public.course_room_members for select to authenticated
  using (user_id = (select auth.jwt()->>'sub'));

create policy "Users can join rooms as themselves"
  on public.course_room_members for insert to authenticated
  with check (user_id = (select auth.jwt()->>'sub'));

create policy "Users can leave their own rooms"
  on public.course_room_members for delete to authenticated
  using (user_id = (select auth.jwt()->>'sub'));

create policy "Room members can read room messages"
  on public.course_room_messages for select to authenticated
  using (
    exists (
      select 1 from public.course_room_members as member
      where member.course_id = course_room_messages.course_id
        and member.user_id = (select auth.jwt()->>'sub')
    )
  );

create policy "Room members can send messages as themselves"
  on public.course_room_messages for insert to authenticated
  with check (
    user_id = (select auth.jwt()->>'sub')
    and exists (
      select 1 from public.course_room_members as member
      where member.course_id = course_room_messages.course_id
        and member.user_id = (select auth.jwt()->>'sub')
    )
  );

commit;
