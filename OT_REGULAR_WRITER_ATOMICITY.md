# 정규 예약 writer ↔ 오티 슬롯 원자성 — 부작용 검토 (rev7, 미적용 설계안)

> 상태: 분석 문서. 구현·적용은 별도 사용자 승인 대상. rev7 코드에 포함된 변경 없음.

## 1. 슬롯 쓰기 경로 3개 (현행, 실제 코드 기준)

| 경로 | 코드 | 슬롯 점유 검사 | 원자성 |
|---|---|---|---|
| 회원 예약 | `ClassBooking.jsx:315` — 클라이언트가 `blocked_slots`를 SELECT로 읽고(화면 로드 시) `bookings`에 직접 INSERT | 클라이언트 측 사전 읽기뿐. 서버 측 blocked_slots 검사 **없음** | booking↔booking만 bookings 유니크 인덱스로 방어 |
| 관리자 대리 예약 | `admin_create_booking` RPC (20260820120000) | bookings 중복만 검사. blocked_slots 검사 **없음** | 동일 |
| 오티 신청 | `ot_book` RPC (20261023170000, 이번 브랜치) | bookings·blocked_slots·ot_bookings 3방향 재조회 후 blocked_slots INSERT | OT↔OT/홀드는 (block_date,block_time) 유니크로 원자적 |

## 2. 남은 경쟁 (정직한 범위)

1. **동시 실행 경쟁 (race)**: 회원 INSERT와 ot_book의 사전검사가 서로의 테이블을 SELECT-then-INSERT로만 검사. 양쪽 SELECT가 모두 비어 있으면 두 INSERT가 모두 성공 → 같은 시각에 정규 예약과 OT가 공존. 창은 좁지만 존재.
2. **순차 정합성은 OT 쪽만 확보됨**: ot_book은 기존 예약이 있는 슬롯을 거부한다. 반대 방향(OT 선점 후 회원/관리자 예약)은 서버에서 막는 것이 없다. 회원 화면은 오래된 목록을 보고 있을 수 있고, `admin_create_booking`은 blocked_slots를 아예 보지 않는다.
3. **관리자 대리 예약의 현행 동작**: 오늘도 관리자는 홀드된 슬롯에 회원을 예약할 수 있다(검사 부재). 이를 막는 것은 기존 동작 변경이므로 별도 결정 사항이다.

## 3. 수정 후보와 부작용

### 후보 R1 — 양방향 BEFORE INSERT 트리거 + 슬롯 단위 advisory lock
- `bookings` BEFORE INSERT 트리거: `pg_advisory_xact_lock(hashtext(date||' '||time))` 후 blocked_slots에 같은 슬롯(정규화된 시각)이 있으면 거부.
- `ot_book` 내부: 동일 키로 advisory lock을 잡은 뒤 기존 검사 수행 (REV7 코드에는 미포함, 적용 시 추가).
- 기대 효과: 동시 경쟁을 직렬화해 양방향 모두 방어.
- 부작용:
  - **모든 정규 예약 INSERT가 새 트리거를 거친다.** 트리거 오류는 정규 예약 전면 중단을 의미 → 예외 처리와 배포 전 PGlite 회귀 테스트 필수.
  - 매 예약 INSERT에 잠금+조회 1회 추가. 단건 예약의 체감 영향은 작을 것으로 예상하나 **실측하지 않았으므로 단정하지 않음**.
  - `admin_create_booking`도 같은 INSERT를 쓰므로 관리자의 홀드 슬롯 예약이 막힌다 → **기존 동작 변경**. 관리자 우회가 필요하면 `current_setting('app.allow_blocked_booking', true)` 같은 명시 우회를 RPC에만 열어야 하며, 이것도 별도 승인.
  - 시각 비교는 `_normalize_booking_time` 기준이어야 포맷 차이 오검사를 피한다.
### 후보 R2 — 회원 예약도 서버 RPC로 이전
- 가장 깨끗하지만 회원 예약 경로 전체를 바꾸는 큰 변경. 기존 회원 동작 불변 원칙과 충돌 위험이 커서 이번 범위에서는 비추천.
### 후보 R3 — 방어 대신 감지
- 경쟁은 받아들이고, bookings↔blocked_slots 겹침을 잡아 관리자에게 알리는 조회/리포트만 추가. 예방이 아니라 사후 발견.

## 4. UPDATE 경로에 대한 보완 (부모 지시 16:19)
- 현재 코드에서 bookings의 UPDATE는 전부 status 변경뿐이다(완료 전이 등). date/time을
  바꾸는 이동(리스케줄) 경로는 아직 없음을 grep으로 확인(2026-10-23).
- 다만 향후 이동 경로가 생기면 R1이 INSERT만 막아서는 우회된다. R1 적용 시 트리거를
  `BEFORE INSERT OR UPDATE OF date, time ON bookings`로 정의해 처음부터 닫아두는
  것을 권고(오늘은 해당 UPDATE가 없으므로 비용 0). ot_book은 UPDATE 경로가 없다.

## 5. 권고
- 이번 실테스트 전 필수는 아니다: 테스트 슬롯을 회원 예약 가능 기간 밖·수요 낮은 시각으로 고르면 경쟁 확률은 낮다. 단, **0은 아니므로 사용자 승인 문구에 이 영향을 명시**한다(부모 지시 16:11).
- 정식 적용 전에는 R1을 별도 승인 항목으로 제안. 관리자 우회 허용 여부가 사용자 결정 사항.
