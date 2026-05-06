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

/**
 * Vertical growth ledger for `growth_records`.
 */
export default function GrowthLedgerTimeline({ entries, loading = false }) {
  const list = Array.isArray(entries) ? entries : [];

  if (loading) {
    return (
      <div className="py-8 text-center text-[11px] tracking-wider text-white/25">기록 불러오는 중…</div>
    );
  }

  if (list.length === 0) {
    return (
      <div className="py-8 text-center text-sm font-light text-gray-500">
        아직 기록된 성장 이력이 없습니다.
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
          {list.map((row) => {
            const dt = formatLedgerDate(row.created_at);
            const achievedLevel = Number(row.achieved_level) || Number(row.new_level) || '—';
            const standard = (row.standard_comment ?? '').trim();
            const custom = (row.custom_comment ?? '').trim();

            return (
              <li key={row.id} className="relative">
                <div
                  className="absolute left-[5px] top-1.5 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"
                  aria-hidden
                />
                <div className="ml-6">
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.22em] text-white/35">{dt}</p>
                  <p className="text-sm font-semibold tracking-wide text-emerald-400">[LV. {achievedLevel} 달성]</p>
                  <p className="mt-2 text-sm leading-relaxed text-gray-400">
                    {standard || '표준 기준 코멘트 없음'}
                  </p>
                  {custom ? (
                    <div className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-950/20 px-3 py-2">
                      <p className="text-sm font-semibold leading-relaxed text-emerald-300">{custom}</p>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
