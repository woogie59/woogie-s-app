import React from 'react';

/**
 * Vertical growth ledger for the member simulator (admin + future client).
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
        const dt = row.created_at
          ? new Date(row.created_at).toLocaleString('ko-KR', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '';
        const isLevel = row.entry_kind === 'level_up';
        const delta = row.exp_delta != null ? Number(row.exp_delta) : null;
        const deltaLabel =
          delta != null && Number.isFinite(delta)
            ? `${delta > 0 ? '+' : ''}${delta}% 바 조정`
            : null;
        const profileJump =
          isLevel && row.profile_level_after != null && row.profile_level_before != null
            ? `프로필 LV ${row.profile_level_before} → ${row.profile_level_after}`
            : null;

        return (
          <div
            key={row.id}
            className="mb-3 border-l-2 border-emerald-500 bg-white/5 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          >
            <div className="flex items-start justify-between gap-2">
              <span
                className={`text-[11px] font-black uppercase tracking-[0.2em] ${
                  isLevel ? 'text-amber-300/95' : 'text-emerald-400/90'
                }`}
              >
                {isLevel ? 'Level Up' : 'EXP Gain'}
              </span>
              <span className="shrink-0 text-[10px] tabular-nums text-white/35">{dt}</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-white/90">{row.category_name || '—'}</p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-emerald-200/55">
              {deltaLabel ? <span>{deltaLabel}</span> : null}
              {profileJump ? <span>{profileJump}</span> : null}
              {row.category_levels_gained > 0 ? (
                <span>카테고리 +{row.category_levels_gained} 구간</span>
              ) : null}
            </div>
            {row.achievement_note ? (
              <p className="mt-3 border-t border-white/10 pt-3 text-sm leading-relaxed text-white/70">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500/60">근거 · </span>
                {row.achievement_note}
              </p>
            ) : (
              <p className="mt-2 text-[10px] text-white/25">성취 근거 없음</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
