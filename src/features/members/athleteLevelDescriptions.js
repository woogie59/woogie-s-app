export const LEVEL_1_DESCRIPTION = '운동의 필요성을 체감하고 열정에 불을 붙이는 첫걸음.';

export const LEVEL_TIER_DESCRIPTIONS = {
  tier2to4: '운동 동작의 목적과 관절의 궤적을 머리로 이해하고 몸으로 습득해나가는 상태.',
  tier5to7: '정확한 타겟 근육에 자극을 넣을 수 있으며, 기본 체력과 절대 근력을 장착한 상태.',
  tier8to9: '근력 운동의 원리를 타인에게 설명할 수 있고, 스스로 자세 교정이 가능한 상급자.',
  tier10: '고중량을 능숙하게 다루며, 모든 신체 부위의 운동루틴을 스스로 구성하는데 어려움이 없는 최상위 상태.',
};

export const MASTER_DESCRIPTION = '어디서든 운동능력으로 인정 받을 수 있는 자립 가능한 자.';

export function getAthleteLevelDescription(level, { isMaster = false, status = '' } = {}) {
  const normalizedStatus = String(status || '').trim().toLowerCase();
  const explicitMaster =
    normalizedStatus === 'master' ||
    normalizedStatus === '마스터';
  const lv = Number(level);
  if (explicitMaster || isMaster) return MASTER_DESCRIPTION;
  if (!Number.isFinite(lv) || lv <= 1) return LEVEL_1_DESCRIPTION;
  if (lv === 10) return LEVEL_TIER_DESCRIPTIONS.tier10;
  if (lv >= 8) return LEVEL_TIER_DESCRIPTIONS.tier8to9;
  if (lv >= 5) return LEVEL_TIER_DESCRIPTIONS.tier5to7;
  if (lv >= 2) return LEVEL_TIER_DESCRIPTIONS.tier2to4;
  return LEVEL_1_DESCRIPTION;
}
