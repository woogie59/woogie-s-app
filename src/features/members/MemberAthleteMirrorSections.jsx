import React, { useMemo } from 'react';
import { coreBioMetricsForMemberDisplay, sortCoreBioMetrics } from './coreBioMetrics';

function getTitleName(row) {
  return String(row?.name ?? row?.title ?? '').trim();
}

/**
 * Read-only replica of the admin "칭호 토글 보드" visuals (no grant/revoke/delete).
 */
/** Distinct pill list of titles the member has actually earned (read-only). */
export function MemberAcquiredTitlePills({ ownedTitles, loading }) {
  const labels = useMemo(() => {
    const rows = Array.isArray(ownedTitles) ? ownedTitles : [];
    return [...new Set(rows.map((r) => String(r.title || '').trim()).filter(Boolean))];
  }, [ownedTitles]);

  if (loading) {
    return <p className="py-10 text-center text-sm text-zinc-500">칭호를 불러오는 중…</p>;
  }

  if (labels.length === 0) {
    return <p className="py-10 text-center text-sm text-zinc-500">아직 획득한 칭호가 없습니다.</p>;
  }

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {labels.map((t) => (
        <span
          key={t}
          className="rounded-full border border-zinc-400/70 bg-gradient-to-r from-zinc-700/80 to-zinc-500/60 px-3 py-1.5 text-xs font-semibold text-zinc-100 shadow-[0_0_12px_rgba(161,161,170,0.32)]"
        >
          {t}
        </span>
      ))}
    </div>
  );
}

export function MemberAthleteTitleBoardReadOnly({ titleDefinitions, ownedTitles, loading }) {
  const titleHierarchy = useMemo(() => {
    const defs = Array.isArray(titleDefinitions) ? titleDefinitions : [];
    const subRows = defs.filter((row) => String(row.parent_title ?? '').trim() !== '');
    const mainRows = defs.filter((row) => String(row.parent_title ?? '').trim() === '');
    const mainTitlesFromSubs = [...new Set(subRows.map((row) => String(row.parent_title || '').trim()).filter(Boolean))];
    const allMainTitles = [
      ...new Set([
        ...mainRows.map((row) => String(row.title || '').trim()).filter(Boolean),
        ...mainTitlesFromSubs,
      ]),
    ];
    return allMainTitles.map((mainTitle) => {
      const subs = subRows.filter((row) => String(row.parent_title || '').trim() === mainTitle);
      return { mainTitle, subs };
    });
  }, [titleDefinitions]);

  const ownedTitleSet = useMemo(
    () => new Set((ownedTitles || []).map((row) => String(row.title || '').trim()).filter(Boolean)),
    [ownedTitles]
  );

  if (loading) {
    return <p className="py-4 text-center text-sm text-zinc-500">칭호 정보를 불러오는 중…</p>;
  }

  if (titleHierarchy.length === 0) {
    return <p className="py-4 text-center text-sm text-zinc-500">등록된 칭호 체계가 없습니다.</p>;
  }

  return (
    <div className="mt-3 space-y-3">
      {titleHierarchy.map(({ mainTitle, subs }) => {
        const mainOwned = ownedTitleSet.has(mainTitle);
        return (
          <div key={mainTitle} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <p
              className={`text-sm font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 via-yellow-300 to-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.35)] ${
                mainOwned ? '' : 'opacity-55'
              }`}
            >
              {mainTitle || '메인 칭호'}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {subs.map((sub) => {
                const subTitle = getTitleName(sub);
                const active = ownedTitleSet.has(subTitle);
                return (
                  <span
                    key={sub.id}
                    className={`rounded-full border px-2.5 py-1 text-xs ${
                      active
                        ? 'border-zinc-400/70 bg-gradient-to-r from-zinc-700/80 to-zinc-500/60 text-zinc-100 shadow-[0_0_12px_rgba(161,161,170,0.32)]'
                        : 'border-zinc-700 bg-zinc-900 text-zinc-500'
                    }`}
                  >
                    {subTitle}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Core bio-metrics grid — same categories as admin `member_stats` tooling.
 */
export function MemberAthleteCoreStatsGrid({ stats, loading, fillCanonicalFive = true }) {
  const rows = useMemo(
    () => (fillCanonicalFive ? coreBioMetricsForMemberDisplay(stats) : sortCoreBioMetrics(stats)),
    [stats, fillCanonicalFive]
  );

  if (loading) {
    return <p className="py-4 text-center text-sm text-zinc-500">스탯을 불러오는 중…</p>;
  }

  if (rows.length === 0) {
    return <p className="py-4 text-center text-sm text-zinc-500">등록된 카테고리 스탯이 없습니다.</p>;
  }

  return (
    <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {rows.map((s) => (
        <div
          key={String(s.id ?? s.category_name)}
          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
        >
          <p className="text-xs font-semibold leading-snug text-zinc-200">{String(s.category_name || '').trim()}</p>
          <p className="mt-1.5 text-[11px] tabular-nums tracking-wide text-zinc-500">
            LV. {Number(s.level) || 1}
            <span className="mx-1.5 text-zinc-600">·</span>
            EXP {Number(s.exp_percent ?? 0).toFixed(1)}%
          </p>
        </div>
      ))}
    </div>
  );
}
