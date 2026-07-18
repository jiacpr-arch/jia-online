-- รูปตัวละครเกม CPR HERO ที่แอดมินอัปโหลดเอง (override รูป default ใน public/images/characters/)
-- เขียนผ่าน admin-api (service role) เท่านั้น — anon อ่านได้อย่างเดียว (เกมฝั่งผู้เรียนต้องโหลด)

create table if not exists public.game_character_images (
  char_id text not null,
  pose text not null, -- idle | talk | panic | stern | happy (+ suffix _talk สำหรับเฟรมปากอ้า)
  url text not null,
  updated_at timestamptz not null default now(),
  primary key (char_id, pose)
);

alter table public.game_character_images enable row level security;

-- ผู้เรียน (anon) อ่านได้อย่างเดียว — ไม่มี policy INSERT/UPDATE/DELETE ให้ anon
drop policy if exists game_character_images_select on public.game_character_images;
create policy game_character_images_select
  on public.game_character_images for select
  to anon, authenticated
  using (true);

-- bucket เก็บไฟล์รูป (public read) — เขียนได้เฉพาะ service role (ไม่เพิ่ม storage policy ให้ anon)
insert into storage.buckets (id, name, public)
values ('game-characters', 'game-characters', true)
on conflict (id) do nothing;
