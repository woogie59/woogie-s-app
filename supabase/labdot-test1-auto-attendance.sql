-- LAB DOT: 테스트용1 자동 출석 (option 1 — 수업 시작 시각 도달 즉시 자동 출석)
-- 범위: additive only. 신규 함수 2개 + pg_cron 스케줄 1개. 삭제/기존 행 변경 없음.
-- 게이트: profiles.name = '테스트용1' 단일 계정만 대상. 다른 계정 데이터는 읽기만 하고 쓰지 않음.
-- 1회 실행용.

-- pg_net: 엣지 함수 호출용 (이미 활성화돼 있으면 no-op)
create extension if not exists pg_net with schema extensions;

begin;

-- 1) 자동 출석: 시작 시각이 지난 당일 예약을 check_in_user와 동일 규칙으로 출석 처리 (멱등)
create or replace function public.labdot_test1_auto_attendance()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_date_kst text;
  v_time_kst text;
  r record;
  v_total int;
  v_used int;
  v_remaining_before int;
  v_batch_id uuid;
  v_price int;
  v_time_norm text;
  n int := 0;
begin
  -- 테스트용1 게이트: 정확히 1개 프로필일 때만 동작
  if (select count(*) from public.profiles where name = '테스트용1') <> 1 then
    return 0;
  end if;
  select id into v_uid from public.profiles where name = '테스트용1';

  v_date_kst := to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date, 'YYYY-MM-DD');
  v_time_kst := to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul', 'HH24:MI');

  perform 1 from public.profiles where id = v_uid for update;

  for r in
    select b.id as booking_id, b.time as booking_time
    from public.bookings b
    where b.user_id = v_uid
      and b.date = v_date_kst
      and lower(replace(btrim(coalesce(b.status, '')), '_', '-')) not in ('cancelled', 'canceled', 'completed')
      and public._normalize_booking_time(b.time) is not null
      and public._normalize_booking_time(b.time) <= v_time_kst
    order by public._normalize_booking_time(b.time)
  loop
    v_time_norm := public._normalize_booking_time(r.booking_time);

    -- 멱등: 같은 날짜+시간 완료 로그가 이미 있으면 booking만 completed 처리
    if public._find_completed_attendance_log(v_uid, v_date_kst, v_time_norm) is not null then
      update public.bookings set status = 'completed'
      where id = r.booking_id
        and lower(replace(btrim(coalesce(status, '')), '_', '-')) <> 'completed';
      continue;
    end if;

    -- 잔여 검증 (check_in_user와 동일 규칙: total - 완료 출석 수)
    select coalesce(sum(total_count), 0)::int into v_total
    from public.session_batches where user_id = v_uid;

    select count(*)::int into v_used
    from public.attendance_logs al
    where al.user_id = v_uid
      and ((al.status is null or btrim(al.status) = '')
           or upper(replace(btrim(al.status), '-', '_')) = 'COMPLETED')
      and upper(replace(btrim(coalesce(al.status, '')), '-', '_')) not in
          ('CANCELLED','CANCELED','VOID','INVALID','PENDING');

    if v_total <= 0 then
      continue;  -- session_batches가 없으면 자동 처리하지 않음
    end if;
    v_remaining_before := greatest(0, v_total - v_used);
    if v_remaining_before <= 0 then
      continue;  -- 잔여 0이면 자동 출석하지 않음
    end if;

    select id, coalesce(price_per_session, 0) into v_batch_id, v_price
    from public.session_batches
    where user_id = v_uid and remaining_count > 0
    order by created_at asc
    limit 1
    for update;

    if v_batch_id is not null then
      update public.session_batches
      set remaining_count = remaining_count - 1
      where id = v_batch_id;
    else
      select coalesce(price_per_session, 0) into v_price from public.profiles where id = v_uid;
    end if;

    update public.profiles
    set remaining_sessions = v_remaining_before - 1
    where id = v_uid;

    insert into public.attendance_logs (user_id, session_price_snapshot, session_time_fixed, status)
    values (v_uid, v_price, v_time_norm, 'COMPLETED');

    update public.bookings set status = 'completed'
    where id = r.booking_id
      and lower(replace(btrim(coalesce(status, '')), '_', '-')) <> 'completed';

    n := n + 1;

    -- 출석 푸시 (신규 처리된 건에만 1회; 멱등 스킵/잔여 부족 스킵 시 발송 없음)
    perform net.http_post(
      url := 'https://qleaffojoqeqlyrwxpeb.supabase.co/functions/v1/notify-member-events',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsZWFmZm9qb3FlcWx5cnd4cGViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzI2OTIsImV4cCI6MjA4NTk0ODY5Mn0.JGkOF597Ua1wZ3vQmeDJhsa8PdaJ3-sIruqkv6DGY0Y",
        'Authorization', "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsZWFmZm9qb3FlcWx5cnd4cGViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzI2OTIsImV4cCI6MjA4NTk0ODY5Mn0.JGkOF597Ua1wZ3vQmeDJhsa8PdaJ3-sIruqkv6DGY0Y"
      ),
      body := jsonb_build_object(
        'user_id', v_uid,
        'title', 'LAB DOT · 출석',
        'message', (split_part(v_time_norm, ':', 1)::int)::text || '시 수업이 출석처리 되었습니다',
        'event_kind', 'attendance'
      )
    );
  end loop;

  return n;
end;
$$;

comment on function public.labdot_test1_auto_attendance() is
  '테스트용1 전용 자동 출석: 수업 시작 시각이 지난 당일 예약을 즉시 출석 처리. check_in_user와 동일 잔여/차감 규칙, 날짜+시간 멱등.';

-- 2) 관리자 되돌리기: 테스트용1 출석 로그 1건을 VOID로 전환하고 배치/잔여 복원 (삭제 아님)
create or replace function public.labdot_test1_void_attendance(p_log_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_log record;
  v_batch uuid;
begin
  if (select count(*) from public.profiles where name = '테스트용1') <> 1 then
    raise exception 'guard: 테스트용1 profile not unique';
  end if;
  select id into v_uid from public.profiles where name = '테스트용1';

  select * into v_log from public.attendance_logs where id = p_log_id for update;
  if not found or v_log.user_id <> v_uid then
    raise exception 'attendance log not found for 테스트용1';
  end if;
  if not (v_log.status is null or btrim(v_log.status) = ''
          or upper(replace(btrim(v_log.status), '-', '_')) = 'COMPLETED') then
    return jsonb_build_object('success', true, 'already_not_completed', true);
  end if;

  update public.attendance_logs set status = 'VOID' where id = p_log_id;

  -- 물리 배치 카운트 복원 (FIFO 차감의 역방향: 차감된 가장 이른 배치에 +1)
  select id into v_batch from public.session_batches
  where user_id = v_uid and remaining_count < total_count
  order by created_at asc
  limit 1
  for update;
  if v_batch is not null then
    update public.session_batches set remaining_count = remaining_count + 1 where id = v_batch;
  end if;

  -- profiles.remaining_sessions 재계산 (total - 완료 출석 수 규칙)
  update public.profiles
  set remaining_sessions = greatest(0,
    (select coalesce(sum(total_count), 0) from public.session_batches where user_id = v_uid)
    - (select count(*) from public.attendance_logs al
       where al.user_id = v_uid
         and ((al.status is null or btrim(al.status) = '')
              or upper(replace(btrim(al.status), '-', '_')) = 'COMPLETED')
         and upper(replace(btrim(coalesce(al.status, '')), '-', '_')) not in
             ('CANCELLED','CANCELED','VOID','INVALID','PENDING')))
  where id = v_uid;

  return jsonb_build_object('success', true, 'voided', p_log_id);
end;
$$;

comment on function public.labdot_test1_void_attendance(uuid) is
  '테스트용1 전용: 출석 로그를 VOID로 전환(삭제 아님)하고 배치/잔여 복원. 관리자 되돌리기용.';

commit;

-- 3) 스케줄: 1분마다 실행 (pg_cron 확장 필요 — 이미 다른 job이 있으면 활성화된 것)
select cron.schedule('labdot-test1-auto-attendance', '* * * * *', $$select public.labdot_test1_auto_attendance();$$);

-- 스케줄 해제 시:
-- select cron.unschedule('labdot-test1-auto-attendance');
-- 롤백 시:
-- select cron.unschedule('labdot-test1-auto-attendance');
-- drop function if exists public.labdot_test1_auto_attendance();
-- drop function if exists public.labdot_test1_void_attendance(uuid);
