import React from 'react';

function formatLedgerDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatExpAfter(row) {
  const v = row.exp_after != null ? Number(row.exp_after) : null;
  if (v == null || !Number.isFinite(v)) return '—';
  const rounded = Math.round(v * 10) / 10;
  return `${rounded}%`;
}

/**
 * Unboxed vertical growth ledger (exp_logs) — rail, nodes, typographic hierarchy.
 */
export default function GrowthLedgerTimeline({ entries, loading = false }) {
  if (loading) {
    return (
      <div className="py-8 text-center text-[11px] uppercase tracking-wider text-white/25">Loading ledger…</div>
    );
  }

  if (!entries?.length) {
    return (
      <div className="py-8 text-center text-sm font-light text-gray-500">
        아직 기록된 성취가 없습니다. EXP를 저장하면 타임라인에 쌓입니다.
      </div>
    );
  }

  return (
    <div className="max-h-[min(40vh,360px)] overflow-y-auto pr-1 [scrollbar-width:thin]">
      <div className="relative">
        <div
          className="pointer-events-none absolute bottom-2 left-[5px] top-2 w-px bg-white/10"
          aria-hidden
        />
        <ul className="relative space-y-10 pb-2 pt-1">
          {entries.map((row) => {
            const dt = formatLedgerDate(row.created_at);
            const category = row.category_name || '—';
            const pctLabel = formatExpAfter(row);
            const header = `${dt} · ${category}: ${pctLabel} 도달`;
            const basis = (row.reason ?? row.achievement_note ?? '').trim();

            return (
              <li key={row.id} className="relative">
                <div
                  className="absolute left-[5px] top-1.5 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"
                  aria-hidden
                />
                <div className="ml-6">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-emerald-400">{header}</p>
                  {basis ? (
                    <p className="text-sm font-light leading-relaxed text-gray-300">{basis}</p>
                  ) : (
                    <p className="text-sm font-light text-gray-600">기록된 근거 없음</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
