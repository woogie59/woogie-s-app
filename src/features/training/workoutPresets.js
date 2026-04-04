/** Focus chips + exercise catalog for Admin Training Report form */

/** Strip legacy bracket prefixes e.g. "[등] 랫풀다운" → "랫풀다운" */
export function stripBracketPrefix(name) {
  if (name == null || typeof name !== 'string') return '';
  return name.replace(/^\[[^\]]+\]\s*/, '').trim();
}

export const FOCUS_CHIPS = ['하체', '가슴', '등', '어깨', '팔', '전신'];

/** @type {Record<string, string[]>} */
export const EXERCISES_BY_FOCUS = {
  하체: [
    '스쿼트',
    '프론트 스쿼트',
    '레그 프레스',
    '레그 익스텐션',
    '레그 컬',
    '루마니안 데드리프트',
    '힙 어덕션',
    '힙 어브덕션',
    '카프 레이즈',
    '힙 쓰러스트',
  ],
  가슴: [
    '벤치 프레스',
    '인클라인 벤치 프레스',
    '덤벨 프레스',
    '케이블 크로스오버',
    '딥스',
    '푸시업',
    '펙덱 플라이',
  ],
  등: [
    '데드리프트',
    '랫 풀다운',
    '시티드 로우',
    '바벨 로우',
    '원암 덤벨 로우',
    '풀업',
    '페이스 풀',
    'T바 로우',
  ],
  어깨: [
    '오버헤드 프레스',
    '덤벨 숄더 프레스',
    '사이드 레터럴 레이즈',
    '프론트 레이즈',
    '리어 델트 플라이',
    '업라이트 로우',
  ],
  팔: [
    '바벨 컬',
    '덤벨 컬',
    '케이블 푸시다운',
    '오버헤드 익스텐션',
    '해머 컬',
    '프리처 컬',
  ],
  전신: [
    '데드리프트',
    '클린 앤 저크',
    '케틀벨 스윙',
    '버피',
    '프랭크',
    '마운틴 클라이머',
  ],
};

export function exercisesForFocus(focus) {
  const list = EXERCISES_BY_FOCUS[focus];
  const raw = Array.isArray(list) ? list : EXERCISES_BY_FOCUS.전신;
  return raw.map((n) => stripBracketPrefix(String(n))).filter(Boolean);
}
