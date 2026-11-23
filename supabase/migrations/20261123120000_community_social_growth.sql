-- Crescimento seguro da Comunidade: convites de clubes e avisos sociais internos.

alter table public.app_notifications drop constraint if exists app_notifications_type_check;
alter table public.app_notifications add constraint app_notifications_type_check check (
  type in ('workout', 'water', 'meal', 'walk', 'weigh_in', 'goal_near', 'weekly_summary', 'social_like', 'social_comment', 'social_follow', 'club_invite')
);

create table if not exists public.club_invitations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  invited_user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint club_invitations_status_check check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  constraint club_invitations_not_self_check check (invited_user_id <> invited_by),
  unique (club_id, invited_user_id)
);

create index if not exists club_invitations_recipient_pending_idx
  on public.club_invitations (invited_user_id, created_at desc) where status = 'pending';

alter table public.club_invitations enable row level security;

drop policy if exists "Recipients view their club invitations" on public.club_invitations;
create policy "Recipients view their club invitations" on public.club_invitations for select to authenticated
  using (invited_user_id = auth.uid());

create or replace function public.community_add_notification(
  recipient_id uuid,
  notification_type text,
  notification_title text,
  notification_message text,
  notification_path text default '/notificacoes',
  notification_label text default 'Abrir'
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if recipient_id is null or recipient_id = auth.uid() then return; end if;
  insert into public.app_notifications (user_id, type, title, message, action_path, action_label)
  values (recipient_id, notification_type, notification_title, notification_message, notification_path, notification_label);
end;
$$;

create or replace function public.community_social_like_notification()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_user uuid; actor_name text;
begin
  select user_id into target_user from public.posts where id = new.post_id;
  if target_user is null or target_user = new.user_id or public.are_community_users_blocked(target_user, new.user_id) then return new; end if;
  select coalesce(nullif(trim(full_name), ''), 'Alguém') into actor_name from public.profiles where id = new.user_id;
  perform public.community_add_notification(target_user, 'social_like', 'Nova curtida', coalesce(actor_name, 'Alguém') || ' curtiu sua publicação.', '/comunidade', 'Ver publicação');
  return new;
end;
$$;

create or replace function public.community_social_comment_notification()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_user uuid; actor_name text;
begin
  select user_id into target_user from public.posts where id = new.post_id;
  if target_user is null or target_user = new.user_id or public.are_community_users_blocked(target_user, new.user_id) then return new; end if;
  select coalesce(nullif(trim(full_name), ''), 'Alguém') into actor_name from public.profiles where id = new.user_id;
  perform public.community_add_notification(target_user, 'social_comment', 'Novo comentário', coalesce(actor_name, 'Alguém') || ' comentou na sua publicação.', '/comunidade', 'Ver comentário');
  return new;
end;
$$;

create or replace function public.community_social_follow_notification()
returns trigger language plpgsql security definer set search_path = public as $$
declare actor_name text;
begin
  if new.following_id = new.follower_id or public.are_community_users_blocked(new.following_id, new.follower_id) then return new; end if;
  select coalesce(nullif(trim(full_name), ''), 'Alguém') into actor_name from public.profiles where id = new.follower_id;
  perform public.community_add_notification(new.following_id, 'social_follow', 'Novo seguidor', coalesce(actor_name, 'Alguém') || ' começou a seguir você.', '/perfil-social?user=' || new.follower_id::text, 'Ver perfil');
  return new;
end;
$$;

drop trigger if exists community_social_like_notification on public.post_likes;
create trigger community_social_like_notification after insert on public.post_likes for each row execute function public.community_social_like_notification();
drop trigger if exists community_social_comment_notification on public.post_comments;
create trigger community_social_comment_notification after insert on public.post_comments for each row execute function public.community_social_comment_notification();
drop trigger if exists community_social_follow_notification on public.follows;
create trigger community_social_follow_notification after insert on public.follows for each row execute function public.community_social_follow_notification();

create or replace function public.community_invite_to_club(target_club_id uuid, target_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare viewer_id uuid := auth.uid(); target_club public.clubs%rowtype;
begin
  if viewer_id is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  select * into target_club from public.clubs where id = target_club_id;
  if not found then raise exception using errcode = 'P0002', message = 'club_not_found'; end if;
  if target_club.privacy <> 'private' then raise exception using errcode = '22023', message = 'club_is_not_private'; end if;
  if not public.can_manage_community_club(target_club_id) then raise exception using errcode = '42501', message = 'club_manager_required'; end if;
  if target_user_id = viewer_id or public.are_community_users_blocked(viewer_id, target_user_id) then raise exception using errcode = '42501', message = 'invitation_not_available'; end if;
  if not exists (select 1 from public.profiles where id = target_user_id and account_status = 'active') then raise exception using errcode = 'P0002', message = 'user_not_available'; end if;
  if exists (select 1 from public.club_members where club_id = target_club_id and user_id = target_user_id) then raise exception using errcode = '22023', message = 'user_already_member'; end if;
  insert into public.club_invitations (club_id, invited_user_id, invited_by, status, created_at, responded_at)
  values (target_club_id, target_user_id, viewer_id, 'pending', now(), null)
  on conflict (club_id, invited_user_id) do update set invited_by = excluded.invited_by, status = 'pending', created_at = now(), responded_at = null;
  perform public.community_add_notification(target_user_id, 'club_invite', 'Convite para clube', 'Você recebeu um convite para entrar em ' || target_club.name || '.', '/comunidade', 'Ver convite');
  return jsonb_build_object('invited', true);
end;
$$;

create or replace function public.community_my_club_invitations()
returns table(id uuid, club_id uuid, club_name text, club_description text, invited_by_name text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select invitation.id, club.id, club.name, club.description,
    coalesce(nullif(trim(profile.full_name), ''), 'Membro MOVELYA'), invitation.created_at
  from public.club_invitations invitation
  join public.clubs club on club.id = invitation.club_id
  left join public.profiles profile on profile.id = invitation.invited_by
  where invitation.invited_user_id = auth.uid() and invitation.status = 'pending'
  order by invitation.created_at desc;
$$;

create or replace function public.community_respond_to_club_invitation(target_invitation_id uuid, accept_invitation boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare viewer_id uuid := auth.uid(); invitation public.club_invitations%rowtype;
begin
  if viewer_id is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  select * into invitation from public.club_invitations where id = target_invitation_id and invited_user_id = viewer_id for update;
  if not found or invitation.status <> 'pending' then raise exception using errcode = 'P0002', message = 'invitation_not_available'; end if;
  if accept_invitation then
    insert into public.club_members (club_id, user_id, role) values (invitation.club_id, viewer_id, 'member') on conflict (club_id, user_id) do nothing;
    update public.club_invitations set status = 'accepted', responded_at = now() where id = invitation.id;
  else
    update public.club_invitations set status = 'declined', responded_at = now() where id = invitation.id;
  end if;
  return jsonb_build_object('accepted', accept_invitation, 'club_id', invitation.club_id);
end;
$$;

create or replace function public.community_my_clubs()
returns table(id uuid, name text, description text, avatar_url text, cover_url text, members_count integer, challenges_count integer, joined boolean)
language sql stable security definer set search_path = public as $$
  select club.id, club.name, club.description, club.avatar_url, club.cover_url,
    (select count(*)::integer from public.club_members member where member.club_id = club.id),
    (select count(*)::integer from public.club_challenges challenge where challenge.club_id = club.id and challenge.status in ('upcoming', 'active')),
    true
  from public.club_members membership
  join public.clubs club on club.id = membership.club_id
  where membership.user_id = auth.uid()
  order by membership.joined_at desc;
$$;

revoke all on function public.community_add_notification(uuid, text, text, text, text, text) from public, anon;
revoke all on function public.community_invite_to_club(uuid, uuid), public.community_my_club_invitations(), public.community_respond_to_club_invitation(uuid, boolean), public.community_my_clubs() from public, anon;
grant execute on function public.community_invite_to_club(uuid, uuid), public.community_my_club_invitations(), public.community_respond_to_club_invitation(uuid, boolean), public.community_my_clubs() to authenticated;
