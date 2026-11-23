-- Uma edição nunca altera a data original da publicação. A marcação é exibida no feed
-- para que comentários e contexto permaneçam transparentes para a comunidade.
alter table public.posts add column if not exists edited_at timestamptz;

create or replace function public.posts_mark_community_edit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.caption is distinct from old.caption
    or new.type is distinct from old.type
    or new.visibility is distinct from old.visibility then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists posts_mark_community_edit on public.posts;
create trigger posts_mark_community_edit
before update on public.posts
for each row execute function public.posts_mark_community_edit();

create index if not exists posts_edited_at_idx on public.posts (edited_at desc) where edited_at is not null;
