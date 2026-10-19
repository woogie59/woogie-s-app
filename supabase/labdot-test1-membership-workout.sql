-- LAB DOT: 테스트용1 기능 지원 SQL (additive only)
-- 범위: 컬럼 추가 / 신규 테이블 / 테스트용1 본인 행 값만. 삭제·기존 데이터 변경 없음.
-- 프로젝트: qleaffojoqeqlyrwxpeb (LAB DOT) 에서만 실행. 짐매니오 프로젝트 금지.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- 0) 가드: 대상 계정이 정확히 1명이 아니면 전체 중단
do $$
declare n int;
begin
  select count(*) into n from public.profiles where name = '테스트용1';
  if n <> 1 then
    raise exception 'expected exactly 1 profile named 테스트용1, found %', n;
  end if;
end $$;

-- 1) 회원권 기간 필드 (nullable, additive)
alter table public.profiles
  add column if not exists membership_start date,
  add column if not exists membership_end date;

-- 2) 테스트용1 본인 행에만 샘플 회원권 기간
update public.profiles
set membership_start = date '2026-10-01',
    membership_end   = date '2026-12-31'
where name = '테스트용1';

-- 3) 개인 운동 기록 테이블 (신규)
create table if not exists public.member_workout_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  at timestamptz not null default now(),
  kind text not null default 'personal' check (kind in ('personal','pt')),
  parts text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- 개인운동 하루 1회 (KST 날짜 기준, PT 행은 제외)
create unique index if not exists member_workout_entries_personal_one_per_day
  on public.member_workout_entries (user_id, ((at at time zone 'Asia/Seoul')::date))
  where kind = 'personal';

-- 본인 행만 읽기/쓰기 (다른 회원 데이터 접근 불가)
alter table public.member_workout_entries enable row level security;

create policy member_workout_entries_select_own on public.member_workout_entries
  for select using (auth.uid() = user_id);
create policy member_workout_entries_insert_own on public.member_workout_entries
  for insert with check (auth.uid() = user_id);
create policy member_workout_entries_update_own on public.member_workout_entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4) 테스트용1 샘플 개인운동 기록 (본인 것만, 재실행해도 중복 없음)
insert into public.member_workout_entries (user_id, at, kind, parts)
select p.id, v.at, 'personal', v.parts
from public.profiles p
cross join (values
  ('2026-09-28T07:40:00+09:00'::timestamptz, array['하체']::text[]),
  ('2026-10-05T07:30:00+09:00'::timestamptz, array['가슴']::text[]),
  ('2026-10-09T08:10:00+09:00'::timestamptz, array['등','팔']::text[]),
  ('2026-10-14T07:30:00+09:00'::timestamptz, array['어깨']::text[]),
  ('2026-10-18T09:20:00+09:00'::timestamptz, array['하체','유산소']::text[])
) as v(at, parts)
where p.name = '테스트용1'
on conflict do nothing;

commit;

-- 롤백 안내 (post-commit, 필요 시 수동 실행):
--   drop table if exists public.member_workout_entries;
--   alter table public.profiles drop column if exists membership_start, drop column if exists membership_end;
--   (이번 update 이전 값은 NULL이었으므로) update public.profiles set membership_start = null, membership_end = null where name = '테스트용1';
-- 주의: create policy는 if not exists를 지원하지 않아 이 파일은 1회 실행용입니다.

-- 사후 확인용:
-- select name, membership_start, membership_end from public.profiles where name = '테스트용1';
-- select at, kind, parts from public.member_workout_entries we join public.profiles p on p.id = we.user_id where p.name = '테스트용1' order by at;
