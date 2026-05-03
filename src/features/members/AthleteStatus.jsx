import React, { useMemo } from 'react';
import { motion as Motion } from 'framer-motion';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts';
import LevelUpEpicFX from './LevelUpEpicFX';

const HEX_VERTICES = 6;
const EMPTY_HEX_LABELS = ['STR', 'END', 'AGI', 'VIT', 'TEC', 'MND'];

function buildRadarRows(stats) {
  let rows = [];
  if (stats?.length) {
    rows = stats.map((s) => ({
      subject:
        s.category_name?.length > 12 ? `${s.category_name.slice(0, 11)}…` : s.category_name || '—',
      value: Math.min(100, Math.max(0, Number(s.exp_percent) || 0)),
      key: s.id,
    }));
  } else {
    rows = EMPTY_HEX_LABELS.map((l, i) => ({ subject: l, value: 0, key: `placeholder-${i}` }));
  }
  if (rows.length < HEX_VERTICES) {
    let pad = 0;
    while (rows.length < HEX_VERTICES) {
      rows.push({ subject: 'OPEN', value: 0, key: `open-slot-${pad++}` });
    }
  }
  return rows;
}

/**
 * High-end gamified athlete status — Recharts polygon radar, matte black, neon fill.
 */
export default function AthleteStatus({
  memberName,
  memberLevel,
  stats,
  subtitle = '내 스테이터스',
  compact = false,
  epicLevelUpKey = 0,
}) {
  const radarData = useMemo(() => buildRadarRows(stats), [stats]);

  const chartH = compact ? 260 : 300;
  const lv = Math.max(1, Number(memberLevel) || 1);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-[#0a0a0a] text-white shadow-[0_0_80px_rgba(16,185,129,0.12)]">
      {/* Radial glow behind chart */}
      <div
        className="pointer-events-none absolute left-1/2 top-[42%] h-[min(120%,520px)] w-[min(140%,520px)] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-90"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(16,185,129,0.22) 0%, rgba(5,46,22,0.35) 38%, transparent 68%)',
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,255,255,0.06)_0%,transparent_55%)]" />

      <LevelUpEpicFX triggerKey={epicLevelUpKey} />

      {/* Massive metallic level */}
      <div className="relative z-10 px-4 pt-6 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-emerald-400/70">{subtitle}</p>
        <Motion.div
          key={epicLevelUpKey}
          className="mt-2"
          initial={epicLevelUpKey > 0 ? { scale: 0.92, opacity: 0.75 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <span
            className="relative inline-block text-[clamp(2.75rem,10vw,3.75rem)] font-black leading-none tracking-tight tabular-nums"
            style={{
              background: 'linear-gradient(185deg, #ecfdf5 0%, #6ee7b7 38%, #059669 72%, #064e3b 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              filter: 'drop-shadow(0 0 15px rgba(16,185,129,0.5)) drop-shadow(0 2px 0 rgba(0,0,0,0.85))',
            }}
          >
            LV. {lv}
          </span>
        </Motion.div>
        <p className="mt-2 text-sm font-medium tracking-wide text-white/55">{memberName || '회원'}</p>
      </div>

      <div className="relative z-10 px-1 pb-6 pt-2" style={{ height: chartH }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="54%" outerRadius="74%" data={radarData}>
            <defs>
              <filter id="athlete-radar-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <PolarGrid
              gridType="polygon"
              stroke="rgba(16,185,129,0.28)"
              strokeWidth={1}
              radialLines
            />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: 'rgba(209,250,229,0.88)', fontSize: 10, fontWeight: 700 }}
              tickLine={false}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={false}
              axisLine={false}
            />
            <Radar
              name="EXP"
              dataKey="value"
              stroke="#10b981"
              strokeWidth={2.5}
              fill="#0B3B24"
              fillOpacity={0.6}
              filter="url(#athlete-radar-glow)"
              dot={{ r: 4, fill: '#34d399', stroke: '#022c22', strokeWidth: 1 }}
              isAnimationActive
              animationDuration={480}
              animationEasing="ease-out"
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <p className="relative z-10 pb-4 text-center text-[10px] font-medium uppercase tracking-[0.25em] text-emerald-500/35">
        Performance Matrix
      </p>
    </div>
  );
}
