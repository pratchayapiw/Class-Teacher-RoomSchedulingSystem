-- =============================================================
-- ระบบตารางสอน กลุ่มสาระฯ ภาษาต่างประเทศ : Supabase schema
-- วิธีใช้: Supabase Dashboard → SQL Editor → New query → วางทั้งไฟล์ → Run
-- รันซ้ำได้ ไม่ทำให้ข้อมูลเดิมหาย
-- =============================================================

-- 1) ตารางเก็บข้อมูลตาราง (1 แถว = 1 ภาคเรียน)
create table if not exists public.timetables (
  id               text primary key,             -- เช่น '2569-2' (ตั้งใน config.js → termId)
  data             jsonb not null,
  version          integer not null default 1,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users(id) on delete set null,
  updated_by_email text
);

-- 2) ประวัติทุกเวอร์ชัน (เก็บล่าสุด 200 เวอร์ชันต่อภาคเรียน)
create table if not exists public.timetable_history (
  hid            bigint generated always as identity primary key,
  id             text not null,
  data           jsonb not null,
  version        integer not null,
  saved_at       timestamptz not null default now(),
  saved_by_email text
);
create index if not exists timetable_history_id_idx on public.timetable_history (id, hid desc);

-- 3) รายชื่อผู้มีสิทธิ์แก้ไข (ใส่อีเมลครูที่แก้ไขได้)
create table if not exists public.editors (
  email text primary key,
  name  text
);

-- ---------- สิทธิ์การเข้าถึง (Row Level Security) ----------
alter table public.timetables        enable row level security;
alter table public.timetable_history enable row level security;
alter table public.editors           enable row level security;

create or replace function public.is_editor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.editors e where lower(e.email) = lower(auth.jwt() ->> 'email'));
$$;

drop policy if exists "anyone can read timetables" on public.timetables;
create policy "anyone can read timetables" on public.timetables for select using (true);
-- ถ้าต้องการให้ดูได้เฉพาะผู้ที่เข้าสู่ระบบ ให้ใช้บรรทัดนี้แทน:
-- create policy "anyone can read timetables" on public.timetables for select to authenticated using (true);

drop policy if exists "editors insert" on public.timetables;
create policy "editors insert" on public.timetables for insert to authenticated with check (public.is_editor());
drop policy if exists "editors update" on public.timetables;
create policy "editors update" on public.timetables for update to authenticated using (public.is_editor()) with check (public.is_editor());

drop policy if exists "editors read history" on public.timetable_history;
create policy "editors read history" on public.timetable_history for select to authenticated using (public.is_editor());

drop policy if exists "read own editor row" on public.editors;
create policy "read own editor row" on public.editors for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- ---------- เก็บประวัติก่อนบันทึกทับ ----------
create or replace function public.tt_keep_history() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.timetable_history (id, data, version, saved_at, saved_by_email)
  values (old.id, old.data, old.version, old.updated_at, old.updated_by_email);
  delete from public.timetable_history
   where id = old.id
     and hid not in (select hid from public.timetable_history where id = old.id order by hid desc limit 200);
  return new;
end $$;

drop trigger if exists tt_history on public.timetables;
create trigger tt_history before update on public.timetables
  for each row execute function public.tt_keep_history();

-- ---------- บันทึกแบบกันชนกัน (optimistic locking) ----------
create or replace function public.save_timetable(p_id text, p_data jsonb, p_base integer)
returns integer language plpgsql security invoker set search_path = public as $$
declare v integer;
begin
  if not public.is_editor() then raise exception 'not allowed'; end if;
  if p_base = 0 then
    insert into public.timetables (id, data, version, updated_by, updated_by_email)
    values (p_id, p_data, 1, auth.uid(), auth.jwt() ->> 'email')
    on conflict (id) do nothing
    returning version into v;
  else
    update public.timetables
       set data = p_data, version = version + 1, updated_at = now(),
           updated_by = auth.uid(), updated_by_email = auth.jwt() ->> 'email'
     where id = p_id and version = p_base
     returning version into v;
  end if;
  if v is null then raise exception 'conflict'; end if;
  return v;
end $$;

revoke all on function public.save_timetable(text, jsonb, integer) from public, anon;
grant execute on function public.save_timetable(text, jsonb, integer) to authenticated;

-- ---------- อัปเดตแบบเรียลไทม์ไปยังทุกเครื่อง ----------
do $$ begin
  alter publication supabase_realtime add table public.timetables;
exception when duplicate_object then null; end $$;

-- ---------- เพิ่มผู้แก้ไข (แก้อีเมลแล้วรัน) ----------
-- insert into public.editors (email, name) values ('teacher@example.com', 'ครูปรัชญา') on conflict do nothing;
