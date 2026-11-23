-- Feed paginado e busca no servidor. A busca respeita as mesmas regras de
-- visibilidade, bloqueio e conta ativa usadas pelo feed normal.

create or replace function public.community_search_profiles(search_term text)
returns table (user_id uuid, full_name text, username text, avatar_url text, is_private boolean)
language sql stable security definer set search_path = public as $$
  select profile.id, coalesce(nullif(trim(profile.full_name), ''), 'Membro MOVELYA'), setting.username, profile.avatar_url,
    coalesce(setting.profile_visibility, 'public') = 'private'
  from public.community_profile_settings setting
  join public.profiles profile on profile.id = setting.user_id and profile.account_status = 'active'
  where auth.uid() is not null
    and not public.are_community_users_blocked(auth.uid(), profile.id)
    and setting.username is not null
    and (setting.username like lower(regexp_replace(trim(search_term), '^@', '')) || '%'
      or (coalesce(setting.profile_visibility, 'public') = 'public' and profile.full_name ilike '%' || trim(search_term) || '%'))
  order by case when setting.username = lower(regexp_replace(trim(search_term), '^@', '')) then 0 else 1 end, setting.username
  limit 12;
$$;

create or replace function public.community_feed_page(
  requested_limit integer default 20,
  before_created_at timestamptz default null,
  before_id uuid default null,
  search_term text default null
)
returns table (id uuid, user_id uuid, type text, caption text, created_at timestamptz, edited_at timestamptz, is_permanent boolean, expires_at timestamptz)
language sql stable security definer set search_path = public as $$
  with params as (
    select least(greatest(coalesce(requested_limit, 20), 1), 40) as page_limit,
      nullif(trim(search_term), '') as term
  )
  select post_item.id, post_item.user_id, post_item.type, post_item.caption, post_item.created_at, post_item.edited_at, post_item.is_permanent, post_item.expires_at
  from public.posts post_item
  join params on true
  left join public.profiles profile on profile.id = post_item.user_id
  left join public.community_profile_settings setting on setting.user_id = post_item.user_id
  where auth.uid() is not null
    and public.can_view_community_post(post_item.id)
    and (before_created_at is null or post_item.created_at < before_created_at or (post_item.created_at = before_created_at and before_id is not null and post_item.id < before_id))
    and (params.term is null
      or post_item.caption ilike '%' || params.term || '%'
      or (coalesce(setting.profile_visibility, 'public') = 'public' and profile.full_name ilike '%' || params.term || '%')
      or setting.username like lower(regexp_replace(params.term, '^@', '')) || '%')
  order by post_item.created_at desc, post_item.id desc
  limit (select page_limit from params);
$$;

create index if not exists posts_created_id_desc_idx on public.posts (created_at desc, id desc);

revoke all on function public.community_feed_page(integer, timestamptz, uuid, text) from public, anon;
grant execute on function public.community_feed_page(integer, timestamptz, uuid, text) to authenticated;
