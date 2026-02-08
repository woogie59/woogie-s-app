// Mock data extracted from App.jsx

export const INITIAL_USERS = [
  {
    user_id: 'u1',
    role: 'user',
    name: '김회원',
    login_id: 'user1',
    pw_hash: '1234',
    dob: '900101',
    gender: 'M',
    goal: '3개월 내 체지방 10% 미만 진입',
    memo: '무릎 관절 주의, 식단 철저함',
    session_packs: [
      {
        id: 'p1',
        registered_at: '2023-10-01',
        total_count: 20,
        service_count: 2,
        unit_price: 60000,
        used_count: 22,
        status: 'completed',
      },
      {
        id: 'p2',
        registered_at: '2024-01-15',
        total_count: 10,
        service_count: 0,
        unit_price: 70000,
        used_count: 3,
        status: 'active',
      },
    ],
  },
  {
    user_id: 'u2',
    role: 'user',
    name: '이회원',
    login_id: 'user2',
    pw_hash: '1234',
    dob: '950505',
    gender: 'F',
    goal: '바디프로필 준비',
    memo: '어깨 가동범위 제한 있음',
    session_packs: [
      {
        id: 'p3',
        registered_at: '2024-01-20',
        total_count: 20,
        service_count: 0,
        unit_price: 80000,
        used_count: 0,
        status: 'active',
      },
    ],
  },
]

export const INITIAL_BOOKINGS = [
  {
    id: 'b1',
    user_id: 'u1',
    date_str: new Date().toISOString().split('T')[0],
    time: '14:00',
    status: 'reserved',
  },
  {
    id: 'b2',
    user_id: 'u2',
    date_str: new Date().toISOString().split('T')[0],
    time: '19:00',
    status: 'reserved',
  },
]

export const INITIAL_KNOWLEDGE = [
  {
    post_id: 'n1',
    category: 'Nutrition',
    title: '체지방 감량을 위한 탄수화물 사이클링',
    content:
      '고강도 운동일에는 탄수화물 섭취를 늘리고, 휴식일에는 줄이는 전략적 식단 가이드입니다.',
    body: `<p>탄수화물 사이클링(Carb Cycling)은 다이어트 정체기를 극복하고 근손실을 최소화하며 체지방을 태우는 고급 영양 전략입니다.</p>`,
    date: '2024.01.20',
    image:
      'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&q=80',
  },
  {
    post_id: 'n2',
    category: 'Nutrition',
    title: '단백질 보충제, 언제 어떻게 먹어야 할까?',
    content:
      '운동 직후 골든타임은 존재하는가? 과학적 근거에 기반한 단백질 섭취 타이밍 완벽 정리.',
    body: `<h3>기회의 창 (Anabolic Window)의 진실</h3><p>과거에는 운동 직후 30분 이내에 단백질을 섭취하지 않으면 근성장이 일어나지 않는다는 '기회의 창' 이론이 지배적이었습니다.</p>`,
    date: '2024.01.25',
    image:
      'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=800&q=80',
  },
  {
    post_id: 'r1',
    category: 'Rehab',
    title: '라운드 숄더 교정 루틴 A',
    content:
      '벽에 기대어 서서 팔을 W자로 만드는 동작을 15회 3세트 반복하여 말린 어깨를 펴줍니다.',
    body: `<h3>라운드 숄더의 원인</h3><p>스마트폰과 PC 사용으로 인해 소흉근이 단축되고, 등 근육(중부/하부 승모근, 능형근)이 약화되어 발생합니다.</p>`,
    date: '2024.01.22',
    image:
      'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=800&q=80',
  },
  {
    post_id: 'w1',
    category: 'Workout',
    title: '3대 운동 증량 프로그램 (5x5)',
    content:
      '스트렝스 향상을 위한 가장 클래식하고 효과적인 5x5 프로그램의 원리와 적용.',
    body: `<h3>StrongLifts 5x5 프로그램 가이드</h3><p>3대 운동(스쿼트, 벤치프레스, 데드리프트) 중량을 늘리고 싶다면 가장 확실한 방법은 5x5 훈련법입니다.</p>`,
    date: '2024.02.01',
    image:
      'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80',
  },
  {
    post_id: 'w2',
    category: 'Workout',
    title: '등 근육의 해부학적 이해와 타겟팅',
    content:
      '광배근 상부와 하부, 승모근을 각각 어떻게 타겟팅해야 넓고 두꺼운 등을 만들 수 있을까?',
    body: `<h3>넓이(Width) vs 두께(Thickness)</h3><p>등은 입체적인 근육입니다. 넓은 프레임을 위해서는 광배근을, 두꺼운 등을 위해서는 승모근 중하부와 능형근을 타겟팅해야 합니다.</p>`,
    date: '2024.02.03',
    image:
      'https://images.unsplash.com/photo-1603287681836-e174ce718028?w=800&q=80',
  },
]

