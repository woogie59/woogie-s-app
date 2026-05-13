import React, { useMemo, useState } from 'react';

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
  const [isLedgerExpanded, setIsLedgerExpanded] = useState(false);
  const records = useMemo(() => {
    const list = Array.isArray(entries) ? entries : [];
    return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [entries]);

  if (loading) {
    return (
      <div className="py-8 text-center text-[11px] tracking-wider text-white/25">기록 불러오는 중…</div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="py-8 text-center text-sm font-light text-gray-500">
        아직 기록된 성장 이력이 없습니다.
      </div>
    );
  }

  const latestRecord = records[0];
  const olderRecords = records.slice(1);

  const renderRecord = (row, { variant }) => {
    const dt = formatLedgerDate(row.created_at);
    const achievedLevel = Number(row.achieved_level) || Number(row.new_level) || '—';
    const standard = (row.standard_comment ?? '').trim();
    const custom = (row.custom_comment ?? '').trim();
    const titleName = String(
      row.title_name || row.granted_title || row.sub_title_name || row.main_title_name || ''
    ).trim();
    const unlockedMainTitle = String(row.unlocked_main_title || row.main_title_name || '').trim();
    const hasTitleGain = titleName !== '';
    const hasMainUnlock = unlockedMainTitle !== '';

    const isHero = variant === 'hero';
    return (
      <div
        className={`rounded-2xl border px-4 py-4 transition-all duration-300 ${
          isHero
            ? 'border-emerald-400/25 bg-white/[0.03] shadow-[0_0_24px_rgba(16,185,129,0.12)]'
            : 'border-white/10 bg-white/[0.015] opacity-80'
        }`}
      >
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/35">{dt}</p>
        {hasTitleGain ? (
          <p className={`mt-2 text-xs font-semibold tracking-wide ${isHero ? 'text-emerald-200' : 'text-emerald-300/80'}`}>
            [칭호 획득] {titleName}
          </p>
        ) : null}
        {hasMainUnlock ? (
          <p
            className={`mt-2 rounded-md border px-2 py-1 text-xs font-semibold tracking-wide ${
              isHero
                ? 'border-amber-300/45 bg-amber-900/20 text-amber-200'
                : 'border-amber-300/30 bg-amber-900/10 text-amber-200/80'
            }`}
          >
            [메인 칭호 해금] {unlockedMainTitle}
          </p>
        ) : null}
        <p className={`mt-2 font-semibold tracking-wide ${isHero ? 'text-emerald-300 text-base' : 'text-emerald-400 text-sm'}`}>
          [LV. {achievedLevel} 달성]
        </p>
        <p className={`mt-2 leading-relaxed ${isHero ? 'text-gray-300 text-sm' : 'text-gray-400 text-sm'}`}>
          {standard || '표준 기준 코멘트 없음'}
        </p>
        {custom ? (
          <div className={`mt-3 rounded-lg border px-3 py-2.5 ${isHero ? 'border-emerald-500/25 bg-emerald-950/20' : 'border-zinc-800 bg-[#0A0A0A]'}`}>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-500/90">
              Woogie&apos;s Comment
            </p>
            <p className={`leading-relaxed ${isHero ? 'text-emerald-200 text-sm font-semibold' : 'text-zinc-300 text-sm'}`}>
              {custom}
            </p>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {renderRecord(latestRecord, { variant: 'hero' })}

      {olderRecords.length > 0 ? (
        <button
          type="button"
          onClick={() => setIsLedgerExpanded(!isLedgerExpanded)}
          className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm font-semibold text-white/70 transition hover:border-white/20 hover:text-white"
        >
          {isLedgerExpanded ? '이전 기록 닫기' : '이전 성장 기록 보기'}
        </button>
      ) : null}

      <div
        className={`space-y-3 overflow-hidden transition-all duration-300 ${
          isLedgerExpanded ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        {isLedgerExpanded ? olderRecords.map((r) => <div key={r.id}>{renderRecord(r, { variant: 'older' })}</div>) : null}
      </div>
    </div>
  );
}
