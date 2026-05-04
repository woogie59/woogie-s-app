import React, { useEffect, useMemo, useRef, useState } from 'react';
import { animate, motion as Motion } from 'framer-motion';
import LevelUpEpicFX from './LevelUpEpicFX';

const ROADMAP_MAX = 10;
const SEGMENT_COUNT = 16;
const LEVEL_PHASES = [
  {
    key: 'phase-1',
    label: 'Phase 1 · Neophyte',
    rangeLabel: 'Lv.1-3',
    min: 1,
    max: 3,
    description: '인지 - 기본 가동 범위 확보 및 운동 용어 이해',
  },
  {
    key: 'phase-2',
    label: 'Phase 2 · Stabilizer',
    rangeLabel: 'Lv.4-5',
    min: 4,
    max: 5,
    description: '안정 - 코어 안정성 및 7대 기초 패턴 완벽 수행',
  },
  {
    key: 'phase-3',
    label: 'Phase 3 · Performer',
    rangeLabel: 'Lv.6-7',
    min: 6,
    max: 7,
    description: '근력 - 자기 체중 비례 중량 통제 및 루틴 변형',
  },
  {
    key: 'phase-4',
    label: 'Phase 4 · Master',
    rangeLabel: 'Lv.8-9',
    min: 8,
    max: 9,
    description: '숙달 - RPE 통제 및 컨디션별 프로그램 최적화',
  },
  {
    key: 'phase-5',
    label: 'Level 10 · Athlete',
    rangeLabel: 'Lv.10',
    min: 10,
    max: 10,
    description: '자립 - 완벽한 독립. 자가 루틴 설계 및 기술적 마스터',
  },
];

const ACTIVE_SEGMENT =
  'rounded-[1px] bg-[#10b981] shadow-[0_0_10px_rgba(16,185,129,0.85),0_0_4px_rgba(16,185,129,0.5)]';
const INACTIVE_SEGMENT = 'rounded-[1px] bg-[rgba(255,255,255,0.05)]';

function StatBiometricRow({ label, pct }) {
  const clamped = Math.min(100, Math.max(0, Number(pct) || 0));
  const prevRef = useRef(clamped);
  const [displayPct, setDisplayPct] = useState(clamped);

  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = clamped;
    const controls = animate(from, clamped, {
      duration: 0.38,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplayPct(v),
    });
    return () => controls.stop();
  }, [clamped]);

  const activeCount = Math.min(
    SEGMENT_COUNT,
    Math.max(0, Math.round((displayPct / 100) * SEGMENT_COUNT))
  );
  const rounded = Math.round(displayPct * 10) / 10;

  return (
    <div className="mb-8 last:mb-0">
      <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-gray-500">{label}</p>
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 gap-[3px]">
          {Array.from({ length: SEGMENT_COUNT }, (_, i) => {
            const on = i < activeCount;
            return (
              <Motion.div
                key={i}
                layout
                className={`h-2 min-w-[3px] flex-1 ${on ? ACTIVE_SEGMENT : INACTIVE_SEGMENT}`}
                initial={false}
                animate={{ scaleY: on ? 1 : 0.92 }}
                transition={{
                  delay: on ? i * 0.02 : (SEGMENT_COUNT - 1 - i) * 0.012,
                  duration: 0.14,
                  ease: 'easeOut',
                }}
              />
            );
          })}
        </div>
        <span className="shrink-0 font-mono text-xl font-black tabular-nums tracking-tight text-white">
          {rounded}
          <span className="text-base font-bold text-white/80">%</span>
        </span>
      </div>
    </div>
  );
}

/**
 * Linear bio-metrics HUD — segmented instrument bars (Oura / Health Pro style).
 */
export default function AthleteStatus({
  memberName,
  memberLevel,
  stats,
  subtitle = 'Physical Autonomy',
  compact = false,
  epicLevelUpKey = 0,
}) {
  const [isRoadmapOpen, setIsRoadmapOpen] = useState(false);
  const rows = useMemo(() => {
    const list = (stats || []).map((s) => ({
      id: s.id,
      label: (s.category_name || '—').toUpperCase(),
      pct: Math.min(100, Math.max(0, Number(s.exp_percent) || 0)),
    }));
    return list.length
      ? list
      : [{ id: 'placeholder', label: 'NO METRICS', pct: 0 }];
  }, [stats]);

  const rawLv = Number(memberLevel) || 1;
  const roadmapLevel = Math.min(ROADMAP_MAX, Math.max(1, rawLv));
  const isGraduated = roadmapLevel >= ROADMAP_MAX;
  const levelProgressPct = Math.min(100, Math.max(0, (roadmapLevel / ROADMAP_MAX) * 100));
  const currentPhaseKey = useMemo(() => {
    const found = LEVEL_PHASES.find((phase) => roadmapLevel >= phase.min && roadmapLevel <= phase.max);
    return found?.key ?? null;
  }, [roadmapLevel]);

  const bioPad = compact ? 'pt-3 pb-4' : 'pt-4 pb-6';

  return (
    <div className="relative overflow-hidden bg-black text-white">
      <LevelUpEpicFX triggerKey={epicLevelUpKey} />

      <div className="pointer-events-none absolute left-1/2 top-[58%] h-[min(90%,380px)] w-[min(100%,360px)] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(circle_at_center,rgba(6,78,59,0.1)_0%,#000000_55%,#000000_100%)]" />

      <div className="relative z-10 px-3 pt-5 text-center">
        <Motion.div
          key={epicLevelUpKey}
          initial={epicLevelUpKey > 0 ? { scale: 0.96, opacity: 0.85 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center justify-center gap-2">
            <span className="block text-5xl font-black leading-none tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500 tabular-nums">
              LV. {roadmapLevel}
            </span>
            <button
              type="button"
              aria-label="레벨 가이드 열기"
              onClick={() => setIsRoadmapOpen(true)}
              className="mt-1 text-xs font-semibold leading-none text-white/55 transition hover:text-emerald-300"
            >
              (i)
            </button>
          </div>
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

      <div className={`relative z-10 px-3 ${bioPad}`}>
        <p className="mb-6 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-white/20">
          Bio-metrics
        </p>
        <div>
          {rows.map((r) => (
            <StatBiometricRow key={r.id} label={r.label} pct={r.pct} />
          ))}
        </div>
      </div>

      {isRoadmapOpen ? (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 px-4 backdrop-blur-xl"
          role="dialog"
          aria-modal="true"
          aria-label="Physical Autonomy Roadmap"
        >
          <div className="relative w-full max-w-[320px] rounded-2xl border border-white/10 bg-zinc-950/95 p-5 shadow-[0_20px_80px_-10px_rgba(0,0,0,0.7)]">
            <button
              type="button"
              aria-label="가이드 닫기"
              onClick={() => setIsRoadmapOpen(false)}
              className="absolute right-4 top-4 text-base font-medium leading-none text-white/55 transition hover:text-white"
            >
              X
            </button>
            <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-emerald-400/80">
              Physical Autonomy Roadmap
            </p>
            <p className="mt-2 text-sm leading-7 text-white/70">
              현재 레벨의 의미를 단계별 로드맵으로 확인하세요.
            </p>

            <div className="mt-4 space-y-2.5">
              {LEVEL_PHASES.map((phase) => {
                const isCurrent = phase.key === currentPhaseKey;
                return (
                  <div
                    key={phase.key}
                    className={`rounded-xl border px-3 py-3 transition-all ${
                      isCurrent
                        ? 'border-emerald-400/60 bg-emerald-900/20 opacity-100 shadow-[0_0_22px_rgba(16,185,129,0.35)]'
                        : 'border-white/10 bg-white/[0.02] opacity-40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold tracking-wide text-white">{phase.label}</p>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">{phase.rangeLabel}</span>
                    </div>
                    <p className="mt-1.5 text-xs leading-6 text-white/75">{phase.description}</p>
                    {isCurrent ? (
                      <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.22em] text-emerald-300">
                        Current Location
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
