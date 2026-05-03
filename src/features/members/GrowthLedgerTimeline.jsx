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
 * Vertical growth ledger for the member simulator (exp_logs).
 */
export default function GrowthLedgerTimeline({ entries, loading = false }) {
  if (loading) {
    return (
      <div className="py-8 text-center text-[11px] uppercase tracking-wider text-emerald-500/40">Loading ledger…</div>
    );
  }

  if (!entries?.length) {
    return (
      <div className="rounded-xl border border-white/5 bg-white/[0.03] py-8 text-center text-sm text-white/35">
        아직 기록된 성취가 없습니다. EXP를 저장하면 타임라인에 쌓입니다.
      </div>
    );
  }

  return (
    <div className="max-h-[min(40vh,360px)] overflow-y-auto pr-1 [scrollbar-width:thin]">
      {entries.map((row) => {
        const dt = formatLedgerDate(row.created_at);
        const category = row.category_name || '—';
        const pctLabel = formatExpAfter(row);
        const headline = `[${dt}] ${category}: ${pctLabel} 도달`;
        const basis = (row.reason ?? row.achievement_note ?? '').trim();

        return (
          <div key={row.id} className="relative mb-4 pl-3 before:absolute before:left-0 before:top-2 before:h-[calc(100%-0.5rem)] before:w-px before:bg-emerald-500/25 last:mb-0 last:before:hidden">
            <p className="text-[12px] font-semibold leading-snug tracking-tight text-white/88">{headline}</p>
            <div className="mt-2.5 rounded-r-xl bg-[#111111] border-l-2 border-emerald-500 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-500/75">성취 근거</p>
              {basis ? (
                <p className="mt-1.5 text-sm leading-relaxed text-white/82">{basis}</p>
              ) : (
                <p className="mt-1.5 text-[11px] text-white/30">기록된 근거 없음</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
