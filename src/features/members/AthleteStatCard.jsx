import React, { useMemo } from 'react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts';

/**
 * Admin-only preview: dark glassmorphism + neon green radar for category EXP balance.
 */
export default function AthleteStatCard({ memberName, memberLevel, stats }) {
  const radarData = useMemo(() => {
    const rows = stats?.length
      ? stats
      : [{ category_name: '데이터 없음', exp_percent: 0, id: 'empty' }];
    return rows.map((s) => ({
      subject: s.category_name?.length > 10 ? `${s.category_name.slice(0, 9)}…` : s.category_name || '—',
      value: Math.min(100, Math.max(0, Number(s.exp_percent) || 0)),
      key: s.id,
    }));
  }, [stats]);

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-white/10 px-5 py-6 text-white shadow-[0_0_60px_rgba(34,197,94,0.12)]"
      style={{
        background: 'linear-gradient(145deg, rgba(15,23,42,0.92) 0%, rgba(2,6,23,0.88) 100%)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
      }}
    >
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-emerald-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-teal-400/10 blur-3xl" />

      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-300/70">Athlete preview</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-white/95">{memberName || '회원'}</h3>
        </div>
        <div className="shrink-0 text-right">
          <p
            className="text-4xl font-black tabular-nums tracking-tighter text-emerald-400"
            style={{
              textShadow:
                '0 0 18px rgba(52,211,153,0.85), 0 0 42px rgba(16,185,129,0.45), 0 0 2px rgba(6,78,59,0.9)',
            }}
          >
            LV. {Math.max(1, Number(memberLevel) || 1)}
          </p>
        </div>
      </div>

      <div className="relative mt-6 h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="52%" outerRadius="68%" data={radarData}>
            <PolarGrid stroke="rgba(148,163,184,0.25)" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(226,232,240,0.75)', fontSize: 11 }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'rgba(148,163,184,0.45)', fontSize: 10 }} />
            <Radar
              name="EXP"
              dataKey="value"
              stroke="#34d399"
              strokeWidth={2}
              fill="#22c55e"
              fillOpacity={0.35}
              dot={{ r: 3, fill: '#6ee7b7', strokeWidth: 0 }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <p className="relative mt-2 text-center text-[11px] text-slate-400">각 축: 카테고리 경험치 % (0–100)</p>
    </div>
  );
}
