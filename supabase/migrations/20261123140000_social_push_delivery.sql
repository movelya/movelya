-- Permite registrar, com limite, entregas push das interações sociais.
alter table public.notification_delivery_log drop constraint if exists notification_delivery_log_type_check;
alter table public.notification_delivery_log add constraint notification_delivery_log_type_check check (
  type in ('workout', 'water', 'meal', 'walk', 'weigh_in', 'goal_near', 'weekly_summary', 'social_like', 'social_comment', 'social_follow', 'club_invite')
);
