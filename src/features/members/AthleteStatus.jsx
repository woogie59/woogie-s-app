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
const ROADMAP_MAX = 10;
const EMPTY_HEX_LABELS = ['STR', 'END', 'AGI', 'VIT', 'TEC', 'MND'];
const RADAR_NEON = '#10b981';

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
 * High-end minimalist gamified athlete status — abyssal chrome, wireframe radar, monolith level.
 */
export default function AthleteStatus({
  memberName,
  memberLevel,
  stats,
  subtitle = 'Physical Autonomy',
  compact = false,
  epicLevelUpKey = 0,
}) {
  const radarData = useMemo(() => buildRadarRows(stats), [stats]);

  const chartH = compact ? 240 : 280;
  const rawLv = Number(memberLevel) || 1;
  const roadmapLevel = Math.min(ROADMAP_MAX, Math.max(1, rawLv));
  const isGraduated = roadmapLevel >= ROADMAP_MAX;
  const levelProgressPct = Math.min(100, Math.max(0, (roadmapLevel / ROADMAP_MAX) * 100));

  const radarStroke = isGraduated ? '#eab308' : RADAR_NEON;
  const radarFill = isGraduated ? '#422006' : '#064e3b';

  return (
    <div className="relative overflow-hidden bg-black text-white">
      <LevelUpEpicFX triggerKey={epicLevelUpKey} />

      {/* Monolith level — top center */}
      <div className="relative z-10 px-4 pt-5 text-center">
        <Motion.div
          key={epicLevelUpKey}
          initial={epicLevelUpKey > 0 ? { scale: 0.96, opacity: 0.85 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="block text-5xl font-black leading-none tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500 tabular-nums">
            LV. {roadmapLevel}
          </span>
        </Motion.div>

        <div className="mx-auto mt-4 flex w-32 flex-col items-center gap-1.5">
          <div className="h-1 w-full overflow-hidden rounded-full bg-gray-900">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.65)] transition-[width] duration-500 ease-out"
              style={{ width: `${levelProgressPct}%` }}
            />
          </div>
          {isGraduated ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-amber-400/80">Graduation</p>
          ) : null}
        </div>

        <p className="mt-4 text-sm font-light tracking-wide text-gray-500">{memberName || '회원'}</p>
        <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.35em] text-white/25">
          {subtitle} · {roadmapLevel}/{ROADMAP_MAX}
        </p>
      </div>

      {/* Holographic glow + radar */}
      <div className="relative z-10 px-1 pb-6 pt-4" style={{ height: chartH }}>
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[min(105%,420px)] w-[min(105%,420px)] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(circle_at_center,rgba(6,78,59,0.1)_0%,#000000_50%,#000000_100%)]"
          aria-hidden
        />
        <div className="relative h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="52%" outerRadius="72%" data={radarData}>
              <defs>
                <filter id="athlete-radar-line-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <PolarGrid
                gridType="polygon"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth={1}
                radialLines
              />
              <PolarAngleAxis
                dataKey="subject"
                tick={{
                  fill: 'rgba(255,255,255,0.4)',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                }}
                tickLine={false}
              />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
              <Radar
                name="EXP"
                dataKey="value"
                stroke={radarStroke}
                strokeWidth={2}
                fill={radarFill}
                fillOpacity={isGraduated ? 0.1 : 0.08}
                filter="url(#athlete-radar-line-glow)"
                dot={{
                  r: 3,
                  fill: radarStroke,
                  stroke: '#000',
                  strokeWidth: 1,
                }}
                isAnimationActive
                animationDuration={480}
                animationEasing="ease-out"
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="relative z-10 pb-4 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-white/20">
        {isGraduated ? 'Physical Autonomy — Complete' : 'Performance Matrix'}
      </p>
    </div>
  );
}
