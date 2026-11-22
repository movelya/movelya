create table if not exists public.client_diagnostics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('error', 'unhandled_rejection', 'performance')),
  message text not null check (char_length(message) between 1 and 420),
  route text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists client_diagnostics_created_at_idx on public.client_diagnostics(created_at desc);
create index if not exists client_diagnostics_kind_created_at_idx on public.client_diagnostics(kind, created_at desc);

alter table public.client_diagnostics enable row level security;
create policy "Users create own diagnostics" on public.client_diagnostics for insert to authenticated with check (user_id = auth.uid());
create policy "Admins read diagnostics" on public.client_diagnostics for select to authenticated using (public.has_admin_role('admin'));

create or replace function public.admin_client_diagnostics_summary(input_hours integer default 24)
returns table(kind text, occurrences bigint, latest_at timestamptz, sample_message text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_admin_role('admin') then raise exception 'admin_role_required'; end if;
  return query
    select d.kind, count(*)::bigint, max(d.created_at), max(d.message)
    from public.client_diagnostics d
    where d.created_at >= now() - make_interval(hours => greatest(input_hours, 1))
    group by d.kind
    order by count(*) desc, max(d.created_at) desc;
end;
$$;

revoke all on function public.admin_client_diagnostics_summary(integer) from public;
grant execute on function public.admin_client_diagnostics_summary(integer) to authenticated;
