# LAB DOT: Core Architecture & Product Requirements Document (PRD)

## 1. Brand Philosophy (핵심 철학)
- **Concept:** "Silent Luxury" (조용한 럭셔리), "Clinical Lab" (정밀한 연구실).
- **Tone & Manner:** 절대 '프리미엄', 'VIP', '케어' 같은 직접적이고 저렴한 세일즈 단어를 쓰지 않는다. 압도적인 여백, 정밀한 데이터, 통제된 환경으로 수준을 증명한다. 앱의 이름(LAB DOT)조차 전면에 내세우지 않고 경험 자체에 집중하게 한다.

## 2. Global UI/UX Guidelines (디자인 원칙)
- **Colors:** Background (`bg-gray-50`), Cards (`bg-white`), Primary Action (`bg-[#064e3b]` 다크 그린).
- **Typography:** Pretendard 폰트 글로벌 적용. 날짜와 시간은 반드시 직관적인 한국어 포맷(예: "4월 3일 (금)")을 사용한다. 영어는 아주 작은 서브 라벨(`text-[10px] tracking-widest uppercase text-gray-400`)에만 미학적으로 사용한다.
- **Components:** - 모서리가 둥근 Bento Grid 카드 형태 유지 (`rounded-2xl border border-gray-100 shadow-sm p-5`).
  - 클릭 가능한 요소는 반드시 쫀득한 터치감(`active:scale-[0.98]`)을 부여한다.
  - 아이콘은 `lucide-react`를 사용하며 얇고 차가운 느낌(`strokeWidth={1.5}` 또는 `1`)을 유지한다.
  - 화면을 가리는 팝업(Modal) 남발을 금지하며, 풀스크린 트랜지션이나 서늘한 하단 Toast 알림을 지향한다.

## 3. Client App (회원 모드)
- **Welcome Screen:** 가입 직후 "환영합니다, OOO님" 텍스트와 다크 그린색 "ENTER" 버튼만 존재하는 극단적 미니멀리즘(The Void) 화면 적용.
- **Home Dashboard:**
  - **Top Billboard:** '다음 수업' 정보. 클릭 불가능한 읽기 전용(Read-only) 전광판 역할.
  - **Insights (Library):** 우측 상단 책(BookOpen) 아이콘. 클릭 시 파트너의 팁이 풀스크린 편집장(Editorial) 뷰로 열림.
  - **2+1 Bento Grid:** - 1열 (50:50): [수업 예약] / [내 일정] (컨트롤 패널 역할)
    - 2열 (100%): [나의 운동 일지] Gateway 카드. 최근 운동 기록 요약 표시.
- **Booking System (Silent Drop):**
  - 월간 달력 폐기. 현재 주(Current Week)만 표시.
  - "잔여 1" 등의 숫자 표기 폐기. 오직 시간만 노출.
  - 다음 주 일정은 토요일 지정된 시간 전까지 락(Lock) 상태 유지. 클릭 시 Toast로 오픈 시간 통보.
- **Training Log (운동 일지):**
  - 리스트 뷰 -> 상세 뷰(Clinical Report)의 뎁스 구조.
  - [운동명 - 중량 - 횟수/세트] 데이터 및 '코치 프라이빗 코멘트' 포함.

## 4. Admin App (관리자/파트너 모드)
- **Home Dashboard (Control Panel):**
  - **Data Radar:** 최상단에 "일정 미확정 회원" 알림(100% width). 어떠한 액션 버튼(예: Schedule Now)도 없이 순수 데이터(이름, 마지막 수업 후 경과일)만 서늘하게 노출.
  - **QR Scanner:** 중앙에 가로로 긴 다크 그린색 스캐너 버튼 배치.
  - **2x2 Bento Grid:** [회원 관리] / [일정 관리] / [라이브러리 작성] / [매출 정산] (설정 버튼은 일정 관리 내부로 통합하여 삭제).
- **Member Management (CRM):**
  - 이용 중인 회원은 상단, 횟수가 끝난 회원은 하단으로 자동 침잠(`opacity-60`).
  - 상세 화면 내 불필요한 회원 목표(Goal), 개인 메모(Private Note) 입력창 영구 삭제 (머릿속 CRM 의존).
  - 상세 화면 하단에 2단계 확인을 거치는 '회원 영구 삭제' 기능 존재.
- **Schedule Setting:** - 시작/종료 시간이 아닌 00:00~23:00의 '24시간 타임 블록 매트릭스(Array)' 토글 방식으로 휴식 시간 등 자유로운 설정 가능.

## 5. Backend & Data Pipeline
- **Database:** Supabase 사용.
- **Library Pipeline:** 관리자가 라이브러리 작성 시 `insert` 후 회원의 Insights 화면에 즉각 연동되어야 함.
- **Google Calendar Sync (God's Eye Algorithm):**
  - 구글 시트와 구글 캘린더 연동 시, 시트의 상태를 캘린더에 강제로 100% 거울화(Mirroring)하는 절대 동기화 방식 사용.
  - 생성된 일정에는 `LAB_DOT` 태그를 부착하여 파트너의 개인 일정과 완벽히 격리 및 추적.
