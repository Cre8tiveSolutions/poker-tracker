-- ONLY needed if you ran setup.sql BEFORE 23 Nov 2026 6 pm.
-- Lets player photos (shrunk on the phone) be saved. Safe to run more than once.
alter table public.players drop constraint if exists players_photo_url_check;
alter table public.players drop constraint if exists players_photo_ok;
alter table public.players add constraint players_photo_ok check (
  photo_url is null
  or photo_url ~* '^https://'
  or (photo_url ~ '^data:image/(jpeg|png|webp);base64,' and length(photo_url) < 60000));
