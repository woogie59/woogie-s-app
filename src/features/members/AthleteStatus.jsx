import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabaseClient';
import LevelUpEpicFX from './LevelUpEpicFX';

const ROADMAP_MAX = 10;
const DEFAULT_LEVEL_PHASES = [
  { id: 'phase-1', phase_order: 1, title: '1단계', level_range: 'Lv.1-3', description: '인지 - 기본 가동 범위 확보 및 운동 용어 이해' },
  { id: 'phase-2', phase_order: 2, title: '2단계', level_range: 'Lv.4-5', description: '안정 - 코어 안정성 및 7대 기초 패턴 완벽 수행' },
  { id: 'phase-3', phase_order: 3, title: '3단계', level_range: 'Lv.6-7', description: '근력 - 자기 체중 비례 중량 통제 및 루틴 변형' },
  { id: 'phase-4', phase_order: 4, title: '4단계', level_range: 'Lv.8-9', description: '숙달 - RPE 통제 및 컨디션별 프로그램 최적화' },
  { id: 'phase-5', phase_order: 5, title: '10레벨', level_range: 'Lv.10', description: '자립 - 완벽한 독립. 자가 루틴 설계 및 기술적 마스터' },
];

function toGuideDraft(row) {
  return {
    ...row,
    title: String(row.title ?? ''),
    level_range: String(row.level_range ?? ''),
    description: String(row.description ?? ''),
  };
}

function parseLevelRange(levelRangeText) {
  const nums = String(levelRangeText || '')
    .match(/\d+/g)
    ?.map((n) => Number.parseInt(n, 10))
    .filter((n) => Number.isFinite(n));
  if (!nums || nums.length === 0) return null;
  if (nums.length === 1) return { min: nums[0], max: nums[0] };
  return { min: Math.min(nums[0], nums[1]), max: Math.max(nums[0], nums[1]) };
}

function getTitleName(row) {
  return String(row?.name ?? row?.title ?? '').trim();
}

export default function AthleteStatus({
  memberId,
  memberName,
  memberLevel,
  memberTitle = '',
  subtitle = '아틀리트 상태',
  epicLevelUpKey = 0,
}) {
  const [isRoadmapOpen, setIsRoadmapOpen] = useState(false);
  const [roadmapGuides, setRoadmapGuides] = useState(DEFAULT_LEVEL_PHASES);
  const [guideDrafts, setGuideDrafts] = useState(DEFAULT_LEVEL_PHASES.map(toGuideDraft));
  const [isRoadmapLoading, setIsRoadmapLoading] = useState(false);
  const [isRoadmapSaving, setIsRoadmapSaving] = useState(false);
  const [isRoadmapEditMode, setIsRoadmapEditMode] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  // Title modal (member autonomy)
  const [isTitleModalOpen, setIsTitleModalOpen] = useState(false);
  const [titleRows, setTitleRows] = useState([]);
  const [loadingTitles, setLoadingTitles] = useState(false);
  const [titleDefinitions, setTitleDefinitions] = useState([]);
  const [loadingTitleDefinitions, setLoadingTitleDefinitions] = useState(false);
  const [localCurrentTitle, setLocalCurrentTitle] = useState(() => String(memberTitle || '').trim());
  const [equippingTitle, setEquippingTitle] = useState('');
  const touchStartYRef = useRef(null);
  const titleTouchStartYRef = useRef(null);
  const rawLv = Number(memberLevel) || 1;
  const roadmapLevel = Math.min(ROADMAP_MAX, Math.max(1, rawLv));
  const isMaxLevel = roadmapLevel === ROADMAP_MAX;
  const phaseTheme = useMemo(() => {
    if (roadmapLevel <= 3) {
      return {
        phaseName: '기틀 (Foundation)',
        halo: 'radial-gradient(circle_at_center,rgba(156,163,175,0.16)_0%,#000000_58%,#000000_100%)',
        accent: 'text-gray-300',
        lvGradient: 'from-white to-gray-400',
      };
    }
    if (roadmapLevel <= 5) {
      return {
        phaseName: '통제 (Alignment)',
        halo: 'radial-gradient(circle_at_center,rgba(16,185,129,0.18)_0%,#000000_58%,#000000_100%)',
        accent: 'text-emerald-300',
        lvGradient: 'from-emerald-100 to-emerald-400',
      };
    }
    if (roadmapLevel <= 7) {
      return {
        phaseName: '발현 (Performance)',
        halo: 'radial-gradient(circle_at_center,rgba(34,197,94,0.28)_0%,#000000_58%,#000000_100%)',
        accent: 'text-lime-300',
        lvGradient: 'from-lime-100 to-green-400',
      };
    }
    return {
      phaseName: '초월 (Autonomy)',
      halo: 'radial-gradient(circle_at_center,rgba(251,191,36,0.26)_0%,rgba(255,255,255,0.05)_38%,#000000_64%,#000000_100%)',
      accent: 'text-amber-200',
      lvGradient: 'from-white to-amber-300',
    };
  }, [roadmapLevel]);
  const currentPhaseKey = useMemo(() => {
    const found = roadmapGuides.find((phase) => {
      const parsed = parseLevelRange(phase.level_range);
      if (!parsed) return false;
      return roadmapLevel >= parsed.min && roadmapLevel <= parsed.max;
    });
    return found?.id ?? null;
  }, [roadmapGuides, roadmapLevel]);

  const closeRoadmap = () => setIsRoadmapOpen(false);

  useEffect(() => {
    setLocalCurrentTitle(String(memberTitle || '').trim());
  }, [memberTitle]);

  useEffect(() => {
    if (!isRoadmapOpen) {
      setIsRoadmapEditMode(false);
      return;
    }

    let cancelled = false;
    const loadRoadmap = async () => {
      setIsRoadmapLoading(true);
      try {
        const [{ data: guides, error: guidesError }, { data: sessionData, error: sessionError }] = await Promise.all([
          supabase.from('roadmap_guides').select('*').order('phase_order', { ascending: true }),
          supabase.auth.getSession(),
        ]);
        if (cancelled) return;
        if (guidesError) throw guidesError;
        if (sessionError) throw sessionError;

        const normalized = (guides || []).map((row, index) => ({
          id: row.id ?? `row-${index}`,
          phase_order: row.phase_order ?? index + 1,
          title: String(row.title ?? ''),
          level_range: String(row.level_range ?? ''),
          description: String(row.description ?? ''),
        }));
        if (normalized.length > 0) {
          setRoadmapGuides(normalized);
          setGuideDrafts(normalized.map(toGuideDraft));
        }

        const uid = sessionData?.session?.user?.id;
        if (!uid) {
          setIsAdmin(false);
          return;
        }
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', uid)
          .maybeSingle();
        if (cancelled) return;
        if (profErr) throw profErr;
        setIsAdmin((prof?.role || '') === 'admin');
      } catch (e) {
        console.error('[AthleteStatus] roadmap load', e);
        toast.error('레벨 가이드를 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setIsRoadmapLoading(false);
      }
    };

    loadRoadmap();
    return () => {
      cancelled = true;
    };
  }, [isRoadmapOpen]);

  useEffect(() => {
    if (!isRoadmapOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isRoadmapOpen]);

  useEffect(() => {
    if (!isTitleModalOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isTitleModalOpen]);

  useEffect(() => {
    if (!isTitleModalOpen || !memberId) return;
    let cancelled = false;
    (async () => {
      setLoadingTitles(true);
      const { data, error } = await supabase
        .from('member_titles')
        .select('*')
        .eq('user_id', memberId)
        .order('granted_at', { ascending: false });
      console.log('Titles Found:', data);
      if (cancelled) return;
      setLoadingTitles(false);
      if (error) {
        console.error('[AthleteStatus] member_titles', error);
        setTitleRows([]);
        return;
      }
      setTitleRows(Array.isArray(data) ? data : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [isTitleModalOpen, memberId]);

  useEffect(() => {
    if (!isTitleModalOpen) return;
    let cancelled = false;
    (async () => {
      setLoadingTitleDefinitions(true);
      const { data, error } = await supabase
        .from('title_definitions')
        .select('*')
        .order('id', { ascending: true });
      console.log('Titles Found:', data);
      if (cancelled) return;
      setLoadingTitleDefinitions(false);
      if (error) {
        console.error('[AthleteStatus] title_definitions', error);
        setTitleDefinitions([]);
        return;
      }
      setTitleDefinitions(Array.isArray(data) ? data : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [isTitleModalOpen]);

  const equipTitle = async (titleName) => {
    const t = String(titleName || '').trim();
    if (!t) return;
    setEquippingTitle(t);
    try {
      const { error } = await supabase.rpc('equip_member_title', { p_title: t });
      if (error) throw error;
      setLocalCurrentTitle(t);
      toast.success('대표 칭호가 변경되었습니다.');
    } catch (e) {
      console.error('[AthleteStatus] equip_member_title', e);
      toast.error('칭호 장착에 실패했습니다.');
    } finally {
      setEquippingTitle('');
    }
  };

  const titleHierarchy = useMemo(() => {
    const defs = Array.isArray(titleDefinitions) ? titleDefinitions : [];
    const owned = new Set((titleRows || []).map((row) => String(row.title || '').trim()));
    const mainRows = defs.filter((row) => String(row.parent_title ?? '').trim() === '');
    const subRows = defs.filter((row) => String(row.parent_title ?? '').trim() !== '');
    const mainTitlesFromSubs = [...new Set(subRows.map((row) => String(row.parent_title || '').trim()).filter(Boolean))];
    const allMainTitles = [
      ...new Set([
        ...mainRows.map((row) => String(row.title || '').trim()).filter(Boolean),
        ...mainTitlesFromSubs,
      ]),
    ];

    return allMainTitles.map((mainTitle) => {
      const children = subRows.filter((sub) => String(sub.parent_title || '').trim() === mainTitle);
      const unlockedSubs = children.filter((sub) => owned.has(String(sub.title || '').trim())).length;
      const totalSubs = children.length;
      const mainUnlocked = owned.has(mainTitle);
      return { mainTitle, children, unlockedSubs, totalSubs, mainUnlocked };
    });
  }, [titleDefinitions, titleRows]);

  const onGuideDraftChange = (id, key, value) => {
    setGuideDrafts((prev) => prev.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
  };

  const saveRoadmapGuides = async () => {
    if (!isAdmin) return;
    setIsRoadmapSaving(true);
    try {
      for (const item of guideDrafts) {
        const payload = {
          title: item.title,
          level_range: item.level_range,
          description: item.description,
        };
        const { error } = await supabase.from('roadmap_guides').update(payload).eq('id', item.id);
        if (error) throw error;
      }

      const { data, error } = await supabase
        .from('roadmap_guides')
        .select('*')
        .order('phase_order', { ascending: true });
      if (error) throw error;

      const normalized = (data || []).map((row, index) => ({
        id: row.id ?? `row-${index}`,
        phase_order: row.phase_order ?? index + 1,
        title: String(row.title ?? ''),
        level_range: String(row.level_range ?? ''),
        description: String(row.description ?? ''),
      }));

      setRoadmapGuides(normalized.length > 0 ? normalized : DEFAULT_LEVEL_PHASES);
      setGuideDrafts((normalized.length > 0 ? normalized : DEFAULT_LEVEL_PHASES).map(toGuideDraft));
      setIsRoadmapEditMode(false);
      toast.success('가이드라인이 성공적으로 업데이트되었습니다.');
    } catch (e) {
      console.error('[AthleteStatus] roadmap save', e);
      toast.error('가이드라인 저장에 실패했습니다.');
    } finally {
      setIsRoadmapSaving(false);
    }
  };

  return (
    <div className="relative overflow-hidden bg-black text-white">
      <LevelUpEpicFX triggerKey={epicLevelUpKey} />

      <div
        className="pointer-events-none absolute left-1/2 top-[58%] h-[min(90%,380px)] w-[min(100%,360px)] -translate-x-1/2 -translate-y-1/2"
        style={{
          background: isMaxLevel
            ? 'radial-gradient(circle_at_center,rgba(250,204,21,0.36)_0%,rgba(255,255,255,0.14)_28%,#000000_66%,#000000_100%)'
            : phaseTheme.halo,
        }}
      />

      <div className="relative z-10 px-3 pt-5 text-center">
        <Motion.div
          key={epicLevelUpKey}
          initial={epicLevelUpKey > 0 ? { scale: 0.96, opacity: 0.85 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center justify-center gap-2">
            <span
              className={`block text-6xl font-black leading-none tracking-tight text-transparent bg-clip-text bg-gradient-to-b ${phaseTheme.lvGradient} tabular-nums ${
                isMaxLevel ? 'drop-shadow-[0_0_18px_rgba(250,204,21,0.75)]' : ''
              }`}
            >
              LV. {roadmapLevel}
            </span>
            {isMaxLevel ? (
              <span className="rounded-full border border-amber-300/55 bg-amber-200/15 px-2 py-1 text-[10px] font-bold tracking-[0.18em] text-amber-100 shadow-[0_0_14px_rgba(251,191,36,0.45)]">
                👑 MAX
              </span>
            ) : null}
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

        <p className={`mt-3 text-[10px] font-medium tracking-[0.22em] ${phaseTheme.accent}`}>{phaseTheme.phaseName}</p>
        {String(localCurrentTitle || '').trim() ? (
          <p className="mt-3 font-sans text-base font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 via-yellow-300 to-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.4)]">
            「{String(localCurrentTitle).trim()}」
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => setIsTitleModalOpen(true)}
          className="mt-2 text-[11px] tracking-[0.12em] text-white/55 transition hover:text-emerald-300"
        >
          [ ✦ 칭호 목록 ]
        </button>
        <p className="mt-3 text-sm font-light tracking-wide text-gray-500">{memberName || '회원'}</p>
        <p className="mt-2 text-[11px] font-medium tracking-[0.12em] text-white/35">
          {subtitle}
        </p>
      </div>

      {isRoadmapOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-xl"
          role="dialog"
          aria-modal="true"
          aria-label="레벨 가이드"
          onClick={closeRoadmap}
        >
          <div
            className="relative w-full max-w-[320px] rounded-2xl border border-white/10 bg-zinc-950/95 p-5 shadow-[0_20px_80px_-10px_rgba(0,0,0,0.7)]"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => {
              touchStartYRef.current = e.touches?.[0]?.clientY ?? null;
            }}
            onTouchEnd={(e) => {
              const startY = touchStartYRef.current;
              const endY = e.changedTouches?.[0]?.clientY ?? null;
              touchStartYRef.current = null;
              if (startY == null || endY == null) return;
              if (endY - startY > 50) closeRoadmap();
            }}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-600 opacity-50" />
            <button
              type="button"
              aria-label="가이드 닫기"
              onClick={closeRoadmap}
              className="absolute right-4 top-4 text-base font-medium leading-none text-white/55 transition hover:text-white"
            >
              X
            </button>
            <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-emerald-400/80">
              레벨 가이드
            </p>
            {isAdmin ? (
              <button
                type="button"
                onClick={() => {
                  if (isRoadmapEditMode) {
                    saveRoadmapGuides();
                    return;
                  }
                  setIsRoadmapEditMode(true);
                }}
                disabled={isRoadmapLoading || isRoadmapSaving}
                className={`absolute right-12 top-4 text-[11px] font-medium tracking-wide transition ${
                  isRoadmapEditMode
                    ? 'text-emerald-300 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)] hover:text-emerald-200'
                    : 'text-white/60 hover:text-white'
                } disabled:opacity-40`}
              >
                {isRoadmapEditMode ? '저장' : '수정'}
              </button>
            ) : null}
            <p className="mt-2 text-sm leading-7 text-white/70">
              현재 레벨의 의미를 단계별 로드맵으로 확인하세요.
            </p>

            <div className="mt-4 space-y-2.5">
              {isRoadmapLoading ? (
                <p className="py-8 text-center text-xs tracking-wide text-white/45">가이드 로딩 중...</p>
              ) : null}
              {(isRoadmapEditMode ? guideDrafts : roadmapGuides).map((phase) => {
                const isCurrent = phase.id === currentPhaseKey;
                return (
                  <div
                    key={phase.id}
                    className={`rounded-xl border px-3 py-3 transition-all ${
                      isCurrent
                        ? 'border-emerald-400/60 bg-emerald-900/20 opacity-100 shadow-[0_0_22px_rgba(16,185,129,0.35)]'
                        : 'border-white/10 bg-white/[0.02] opacity-40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      {isRoadmapEditMode && isAdmin ? (
                        <>
                          <input
                            value={phase.title}
                            onChange={(e) => onGuideDraftChange(phase.id, 'title', e.target.value)}
                            className="w-[62%] rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-xs text-white outline-none focus:border-emerald-400/60"
                          />
                          <input
                            value={phase.level_range}
                            onChange={(e) => onGuideDraftChange(phase.id, 'level_range', e.target.value)}
                            className="w-[34%] rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.16em] text-white/80 outline-none focus:border-emerald-400/60"
                          />
                        </>
                      ) : (
                        <>
                          <p className="text-xs font-semibold tracking-wide text-white">{phase.title}</p>
                          <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">{phase.level_range}</span>
                        </>
                      )}
                    </div>
                    {isRoadmapEditMode && isAdmin ? (
                      <textarea
                        rows={2}
                        value={phase.description}
                        onChange={(e) => onGuideDraftChange(phase.id, 'description', e.target.value)}
                        className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 text-xs leading-6 text-white/90 outline-none focus:border-emerald-400/60"
                      />
                    ) : (
                      <p className="mt-1.5 text-xs leading-6 text-white/75">{phase.description}</p>
                    )}
                    {isCurrent ? (
                      <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.22em] text-emerald-300">
                        현재 위치
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {isTitleModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-xl"
          role="dialog"
          aria-modal="true"
          aria-label="보유 칭호 아카이브"
          onClick={() => setIsTitleModalOpen(false)}
        >
          <div
            className="relative w-full max-w-[340px] rounded-2xl border border-white/10 bg-zinc-950/95 p-5 shadow-[0_20px_80px_-10px_rgba(0,0,0,0.7)]"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => {
              titleTouchStartYRef.current = e.touches?.[0]?.clientY ?? null;
            }}
            onTouchEnd={(e) => {
              const startY = titleTouchStartYRef.current;
              const endY = e.changedTouches?.[0]?.clientY ?? null;
              titleTouchStartYRef.current = null;
              if (startY == null || endY == null) return;
              if (endY - startY > 50) setIsTitleModalOpen(false);
            }}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-600 opacity-50" />
            <button
              type="button"
              aria-label="칭호 목록 닫기"
              onClick={() => setIsTitleModalOpen(false)}
              className="absolute right-4 top-4 text-base font-medium leading-none text-white/55 transition hover:text-white"
            >
              X
            </button>
            <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-emerald-400/80">
              보유 칭호 아카이브
            </p>
            <p className="mt-1 text-[11px] tracking-[0.08em] text-white/40">트로피 룸</p>

            <div className="mt-4 max-h-[52vh] space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
              {loadingTitles || loadingTitleDefinitions ? (
                <p className="py-8 text-center text-sm text-white/45">칭호 불러오는 중...</p>
              ) : titleHierarchy.length === 0 ? (
                <p className="py-8 text-center text-sm text-white/45">획득 가능한 칭호가 없습니다.</p>
              ) : (
                titleHierarchy.map((group) => (
                  <div
                    key={group.mainTitle}
                    className={`rounded-xl border px-3 py-3 ${
                      group.mainUnlocked
                        ? 'border-amber-300/45 bg-amber-900/10 shadow-[0_0_18px_rgba(251,191,36,0.24)]'
                        : 'border-white/10 bg-white/[0.02] grayscale'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`font-sans text-base font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 via-yellow-300 to-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.4)] ${
                          group.mainUnlocked ? '' : 'opacity-40'
                        }`}
                      >
                        {group.mainTitle || '메인 칭호'}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-white/45">
                          {group.totalSubs > 0 ? `${group.unlockedSubs}/${group.totalSubs}` : group.mainUnlocked ? '달성' : '잠금'}
                        </span>
                        {group.mainUnlocked ? (
                          <button
                            type="button"
                            disabled={equippingTitle !== '' && equippingTitle !== group.mainTitle}
                            onClick={() => equipTitle(group.mainTitle)}
                            className="rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-white/75 transition hover:border-emerald-400/40 hover:text-emerald-200 disabled:opacity-40"
                          >
                            {equippingTitle === group.mainTitle ? '장착 중…' : '장착'}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {group.children.map((sub) => {
                        const subTitle = getTitleName(sub);
                        const ownedRow = titleRows.find((r) => String(r.title || '').trim() === subTitle);
                        const unlocked = Boolean(ownedRow);
                        const grantedAt = ownedRow?.granted_at
                          ? `${new Date(ownedRow.granted_at).toLocaleDateString('ko-KR')} 수여됨`
                          : null;
                        return (
                          <div
                            key={sub.id}
                            className={`rounded-lg border px-2.5 py-2 ${
                              unlocked
                                ? 'border-emerald-300/70 bg-gradient-to-r from-emerald-500/30 to-yellow-400/20 shadow-[0_0_10px_rgba(16,185,129,0.35)]'
                                : 'border-zinc-700 bg-zinc-900'
                            }`}
                          >
                            <p className={`text-sm ${unlocked ? 'text-emerald-200' : 'text-zinc-300'}`}>{subTitle}</p>
                            {grantedAt ? <p className="mt-0.5 text-[11px] text-white/45">{grantedAt}</p> : null}
                          </div>
                        );
                      })}
                    </div>
                    {group.mainTitle === String(memberTitle || '').trim() ? (
                      <p className="mt-2 text-[10px] text-emerald-300">대표 칭호</p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
