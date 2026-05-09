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

/** Latest row per canonical category (matches admin tooling when duplicates exist). */
export function latestCoreBioRowByCategory(stats) {
  const byCat = new Map();
  for (const row of stats || []) {
    const cat = String(row.category_name || '').trim();
    if (!CORE_BIO_METRIC_SET.has(cat)) continue;
    const prev = byCat.get(cat);
    const t = row.created_at ? new Date(row.created_at).getTime() : 0;
    const pt = prev?.created_at ? new Date(prev.created_at).getTime() : -1;
    if (!prev || t >= pt) byCat.set(cat, row);
  }
  return byCat;
}

/** Always 5 rows in canonical order — placeholders when DB has no row yet. */
export function coreBioMetricsForMemberDisplay(stats) {
  const byCat = latestCoreBioRowByCategory(stats);
  return CORE_BIO_METRICS.map((name) => {
    const row = byCat.get(name);
    if (row) return row;
    return {
      id: `core-placeholder-${name}`,
      category_name: name,
      level: 1,
      exp_percent: 0,
    };
  });
}
