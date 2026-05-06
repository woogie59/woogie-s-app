/** Canonical 5 core bio-metrics — category_name values in `member_stats`. */
export const CORE_BIO_METRICS = [
  'Movement IQ (운동 지능)',
  'Mobility (가동성)',
  'Strength (절대 근력)',
  'Metabolic (대사 능력)',
  'Resilience (수행 심리)',
];

export const CORE_BIO_METRIC_SET = new Set(CORE_BIO_METRICS);

export const CORE_BIO_METRIC_INDEX = new Map(CORE_BIO_METRICS.map((name, idx) => [name, idx]));

export function sortCoreBioMetrics(stats) {
  return [...(stats || [])]
    .filter((s) => CORE_BIO_METRIC_SET.has(String(s.category_name || '').trim()))
    .sort((a, b) => {
      const ai = CORE_BIO_METRIC_INDEX.get(String(a.category_name || '').trim()) ?? Number.MAX_SAFE_INTEGER;
      const bi = CORE_BIO_METRIC_INDEX.get(String(b.category_name || '').trim()) ?? Number.MAX_SAFE_INTEGER;
      return ai - bi;
    });
}
