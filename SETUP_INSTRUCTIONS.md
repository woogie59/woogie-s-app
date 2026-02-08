# 🏋️‍♀️ THE COACH - Setup Instructions

## Task 1.1 & 1.2 완료!

### ✅ Task 1.1: Database Setup (Supabase SQL)

**실행 방법:**
1. Supabase Dashboard → SQL Editor 열기
2. `supabase_check_in_function.sql` 파일의 내용을 복사
3. SQL Editor에 붙여넣기 후 실행 (Run 버튼 클릭)

**생성된 내용:**
- ✅ `check_in_user(user_uuid)` RPC 함수
  - 남은 세션 확인 (remaining_sessions > 0)
  - 세션 1 차감
  - 원자적 트랜잭션 보장 (FOR UPDATE 락)
  - 성공/실패 JSON 반환

- ✅ `check_ins` 테이블 (체크인 로그)
  - id, user_id, checked_in_at, remaining_sessions_after
  - RLS 정책: 유저는 자신의 기록만, 관리자는 전체 기록 조회 가능

---

### ✅ Task 1.2: QR Scanner UI Implementation

**구현된 기능:**

#### 1. **QRScanner 컴포넌트** (`src/App.jsx`)
```javascript
const QRScanner = ({ setView }) => { ... }
```

**주요 기능:**
- 📋 **회원 목록 표시**: Supabase에서 `role='user'`인 회원만 로드
- 🔍 **검색 기능**: 이름 또는 이메일로 실시간 필터링
- ✅ **체크인 처리**: 
  - 회원 선택 시 `check_in_user()` RPC 함수 호출
  - 세션 자동 차감
  - 남은 세션이 0인 경우 비활성화
- 🎨 **결과 모달**:
  - 성공: 초록색 체크 아이콘 + 남은 세션 표시
  - 실패: 빨간색 X 아이콘 + 에러 메시지
- 🔄 **실시간 업데이트**: 체크인 후 회원 목록 자동 새로고침

#### 2. **AdminHome 연결**
- "QR SCAN" 버튼 클릭 시 → `setView('scanner')` 호출
- App 컴포넌트에서 `scanner` 뷰 렌더링
- AdminRoute로 관리자 권한 검증

---

## 🎯 사용 방법

### 1️⃣ 관리자 로그인
```
이메일: admin@example.com (또는 role='admin'인 계정)
```

### 2️⃣ QR 스캔 화면 접근
1. 로그인 후 Admin Home 화면에서
2. "QR SCAN" 버튼 클릭

### 3️⃣ 회원 체크인
1. 검색창에서 회원 이름/이메일 검색 (선택사항)
2. 체크인할 회원 카드 클릭
3. 확인 다이얼로그에서 "확인" 클릭
4. 성공 모달 확인:
   - ✅ 체크인 성공
   - 📊 남은 세션 수 표시
5. "CLOSE" 버튼으로 모달 닫기

### 4️⃣ 에러 처리
- **세션 부족**: "No remaining sessions available" 메시지 표시
- **존재하지 않는 유저**: "User not found" 에러
- **DB 연결 실패**: 자동으로 에러 캐치 후 표시

---

## 🎨 UI/UX 특징

### Design System
- **색상 테마**: Zinc-950 배경 + Yellow-500 강조색
- **아이콘**: lucide-react 사용
- **애니메이션**: Framer Motion (모달 등장/사라짐)
- **반응형**: Tailwind CSS

### 사용자 피드백
- ✅ **확인 다이얼로그**: 실수 방지
- 🎯 **실시간 검색**: 빠른 회원 찾기
- 🚫 **세션 0 비활성화**: 클릭 불가 + 시각적 피드백
- 📊 **대형 숫자 표시**: 남은 세션 강조

---

## 🔧 기술 스택

| 항목 | 기술 |
|------|------|
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS |
| Animation | Framer Motion |
| Icons | lucide-react |
| Backend | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth |

---

## 📝 체크인 로그 확인

### Supabase Dashboard에서:
```sql
SELECT 
  c.checked_in_at,
  p.name,
  p.email,
  c.remaining_sessions_after
FROM check_ins c
JOIN profiles p ON c.user_id = p.id
ORDER BY c.checked_in_at DESC
LIMIT 20;
```

---

## 🚀 Next Steps (Phase 1 완료 후)

- [ ] **Task 1.3**: ClientHome에 QR 코드 표시
  - 유저 UUID를 QR 코드로 인코딩
  - 모달로 QR 이미지 표시
  - 실제 QR 스캐너 연동 (선택사항)

- [ ] **Phase 2**: 클래스 예약 시스템
  - `bookings` 테이블 생성
  - 시간대별 예약 UI
  - 중복 예약 방지 로직

---

## ⚠️ 주의사항

1. **관리자 권한**: `profiles` 테이블에서 `role='admin'` 확인 필요
2. **RPC 함수 권한**: `GRANT EXECUTE ON FUNCTION check_in_user TO authenticated;` 필수
3. **RLS 정책**: check_ins 테이블 정책 활성화 필수
4. **에러 핸들링**: 모든 DB 호출은 try-catch로 감싸야 함

---

## 🐛 Troubleshooting

### "Function not found" 에러
→ SQL 파일 전체를 Supabase SQL Editor에서 실행했는지 확인

### "Permission denied" 에러
→ RLS 정책 및 GRANT 문이 올바르게 실행되었는지 확인

### 체크인 후 숫자가 업데이트되지 않음
→ 브라우저 새로고침 또는 컴포넌트가 자동 리프레시되는지 확인

---

**✨ 개발 완료일**: 2024.02.08  
**📧 문의**: 프로젝트 담당자에게 연락
