import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabaseClient';
import LevelUpEpicFX from './LevelUpEpicFX';
import MasterExamPendingSanctum from './MasterExamPendingSanctum';
import { getAthleteLevelDescription } from './athleteLevelDescriptions';

const ROADMAP_MAX = 10;
const DEFAULT_LEVEL_PHASES = [
  {
    id: 'tier-1',
    phase_order: 1,
    title: '[ 1계급 ] 초심자',
    level_range: 'Lv.1',
    description: '운동의 필요성을 체감하고 열정에 불을 붙이는 첫걸음.',
  },
  {
    id: 'tier-2',
    phase_order: 2,
    title: '[ 2계급 ] 수행자',
    level_range: 'Lv.2~4',
    description: '운동 동작의 목적과 관절의 궤적을 머리로 이해하고 몸으로 습득해나가는 상태.',
  },
  {
    id: 'tier-3',
    phase_order: 3,
    title: '[ 3계급 ] 숙련자',
    level_range: 'Lv.5~7',
    description: '정확한 타겟 근육에 자극을 넣을 수 있으며, 기본 체력과 절대 근력을 장착한 상태.',
  },
  {
    id: 'tier-4',
    phase_order: 4,
    title: '[ 4계급 ] 엘리트',
    level_range: 'Lv.8~9',
    description: '근력 운동의 원리를 타인에게 설명할 수 있고, 스스로 자세 교정이 가능한 상급자.',
  },
  {
    id: 'tier-5',
    phase_order: 5,
    title: '[ 5계급 ] 챌린저',
    level_range: 'Lv.10',
    description: '고중량을 능숙하게 다루며, 모든 신체 부위의 운동루틴을 스스로 구성하는데 어려움이 없는 최상위 상태.',
  },
  {
    id: 'tier-6',
    phase_order: 6,
    title: '[ 6계급 ] MASTER',
    level_range: 'MASTER',
    description: '어디서든 운동능력으로 인정 받을 수 있는 자립 가능한 자.',
  },
];

function parseLevelRange(levelRangeText) {
  const nums = String(levelRangeText || '')
    .match(/\d+/g)
    ?.map((n) => Number.parseInt(n, 10))
    .filter((n) => Number.isFinite(n));
  if (!nums || nums.length === 0) return null;
  if (nums.length === 1) return { min: nums[0], max: nums[0] };
  return { min: Math.min(nums[0], nums[1]), max: Math.max(nums[0], nums[1]) };
}

function renderLevelRangeText(min, max) {
  if (!Number.isFinite(min)) return 'LV.--';
  if (!Number.isFinite(max) || min === max) return `LV.${min}`;
  return `LV.${min}~${max}`;
}

function LevelFacetBadge({ text, className = '' }) {
  return (
    <span className={`text-[10px] font-semibold tabular-nums tracking-[0.32em] text-platinum/55 ${className}`}>{text}</span>
  );
}

function getTitleName(row) {
  return String(row?.name ?? row?.title ?? '').trim();
}

/** Strict tier → gradient (Korean labels per product spec) */
function tierLabelFromLevel(level) {
  const lv = Number(level) || 1;
  if (lv <= 1) return '초심자';
  if (lv <= 4) return '수행자';
  if (lv <= 7) return '숙련자';
  if (lv <= 9) return '엘리트';
  return '챌린저';
}

const TIER_VISUAL = {
  초심자: {
    levelClassName:
      'block font-black tracking-tighter tabular-nums bg-gradient-to-br from-white to-gray-300 bg-clip-text text-transparent drop-shadow-[0_0_24px_rgba(255,255,255,0.2)]',
    halo: 'radial-gradient(circle_at_center,rgba(255,255,255,0.16)_0%,#050505_58%,#050505_100%)',
  },
  수행자: {
    levelClassName:
      'block font-black tracking-tighter tabular-nums bg-gradient-to-br from-orange-400 to-amber-700 bg-clip-text text-transparent drop-shadow-[0_0_26px_rgba(245,158,11,0.35)]',
    halo: 'radial-gradient(circle_at_center,rgba(251,146,60,0.2)_0%,#050505_60%,#050505_100%)',
  },
  숙련자: {
    levelClassName:
      'block font-black tracking-tighter tabular-nums bg-gradient-to-br from-gray-300 to-gray-500 bg-clip-text text-transparent drop-shadow-[0_0_24px_rgba(209,213,219,0.28)]',
    halo: 'radial-gradient(circle_at_center,rgba(209,213,219,0.16)_0%,#050505_62%,#050505_100%)',
  },
  엘리트: {
    levelClassName:
      'block font-black tracking-tighter tabular-nums bg-gradient-to-br from-yellow-300 to-yellow-600 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(234,179,8,0.32)]',
    halo: 'radial-gradient(circle_at_center,rgba(253,224,71,0.15)_0%,#050505_66%,#050505_100%)',
  },
  챌린저: {
    levelClassName:
      'block font-black tracking-tighter tabular-nums bg-gradient-to-br from-red-500 to-red-800 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(220,38,38,0.5)]',
    halo: 'radial-gradient(circle_at_center,rgba(220,38,38,0.22)_0%,#050505_65%,#050505_100%)',
  },
};

export default function AthleteStatus({
  memberId,
  memberName,
  memberLevel,
  memberTitle = '',
  subtitle = '',
  epicLevelUpKey = 0,
  viewMode = 'admin',
  masterExamPendingFullBleed = false,
  roadmapOpen: roadmapOpenProp,
  onRoadmapOpenChange,
  suppressRoadmapButton = false,
  hideTitleArchive = false,
  compactMemberHero = false,
  onRepresentativeTitleClick,
  representativeTitleDescription = '',
}) {
  const [roadmapInternalOpen, setRoadmapInternalOpen] = useState(false);
  const roadmapControlled = roadmapOpenProp !== undefined && typeof onRoadmapOpenChange === 'function';
  const isRoadmapOpen = roadmapControlled ? roadmapOpenProp : roadmapInternalOpen;
  const openRoadmap = () => {
    if (roadmapControlled) onRoadmapOpenChange(true);
    else setRoadmapInternalOpen(true);
  };
  const closeRoadmap = () => {
    if (roadmapControlled) onRoadmapOpenChange(false);
    else setRoadmapInternalOpen(false);
  };
  // Title modal (member autonomy)
  const [isTitleModalOpen, setIsTitleModalOpen] = useState(false);
  const [titleRows, setTitleRows] = useState([]);
  const [loadingTitles, setLoadingTitles] = useState(false);
  const [titleDefinitions, setTitleDefinitions] = useState([]);
  const [loadingTitleDefinitions, setLoadingTitleDefinitions] = useState(false);
  const [localCurrentTitle, setLocalCurrentTitle] = useState(() => String(memberTitle || '').trim());
  const [equippingTitle, setEquippingTitle] = useState('');
  const [masterExamSubmitting, setMasterExamSubmitting] = useState(false);
  const [examStatus, setExamStatus] = useState('idle');
  const [masterAchieved, setMasterAchieved] = useState(false);
  const [isTitleInfoOpen, setIsTitleInfoOpen] = useState(false);
  const [titleInfoDescription, setTitleInfoDescription] = useState('');
  const [loadingTitleInfo, setLoadingTitleInfo] = useState(false);
  const touchStartYRef = useRef(null);
  const titleTouchStartYRef = useRef(null);
  const rawLv = Number(memberLevel) || 1;
  const roadmapLevel = Math.min(ROADMAP_MAX, Math.max(1, rawLv));
  const isMemberIsolatedView = viewMode === 'member';
  const isMasterExamPending = roadmapLevel === 10 && !masterAchieved && examStatus === 'pending';

  /** Tier gradients mapped to Korean tier strings; Lv.10 pre-master = 챌린저 (red); master = amethyst singularity */
  const prestige = useMemo(() => {
    if (roadmapLevel === 10 && masterAchieved) {
      return {
        halo: 'radial-gradient(circle_at_center,rgba(147,51,234,0.32)_0%,rgba(76,29,149,0.14)_42%,#050505_74%,#050505_100%)',
        mode: 'master',
      };
    }
    const tierKey = roadmapLevel === 10 && !masterAchieved ? '챌린저' : tierLabelFromLevel(roadmapLevel);
    const visual = TIER_VISUAL[tierKey];
    return {
      halo: visual.halo,
      mode: 'tier',
      levelText: `LV. ${roadmapLevel}`,
      levelClassName: visual.levelClassName,
      classLine: `CLASS : ${tierKey}`,
    };
  }, [roadmapLevel, masterAchieved]);
  const currentPhaseKey = useMemo(() => {
    if (masterAchieved) return 'tier-6';
    const found = DEFAULT_LEVEL_PHASES.find((phase) => {
      const parsed = parseLevelRange(phase.level_range);
      if (!parsed) return false;
      return roadmapLevel >= parsed.min && roadmapLevel <= parsed.max;
    });
    return found?.id ?? null;
  }, [roadmapLevel, masterAchieved]);


  const normalizeMasterExamError = (error) => {
    const raw = String(error?.message || error || '');
    const message = raw.toLowerCase();
    if (message.includes('duplicate key') || message.includes('unique constraint')) {
      return '이미 신청되었습니다.';
    }
    if (message.includes('칭호')) {
      return '칭호가 부족합니다.';
    }
    if (message.includes('pending') || message.includes('대기')) {
      return '이미 심사 대기 중입니다.';
    }
    if (raw.trim()) {
      return raw.trim();
    }
    return '심사 요청 처리 중 오류가 발생했습니다.';
  };

  /** Coerce profile level for exam gate (string "10", numeric 10, etc.) */
  const coerceMemberLevel = (raw) => {
    const n = Number(raw);
    if (Number.isFinite(n)) {
      return Math.floor(n);
    }
    const parsed = Number.parseInt(String(raw ?? '').replace(/[^\d.-]/g, ''), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  useEffect(() => {
    setLocalCurrentTitle(String(memberTitle || '').trim());
  }, [memberTitle]);

  const applyExamStatusFromString = (raw) => {
    const status = String(raw ?? '').toLowerCase();
    if (status === 'pending') {
      setExamStatus('pending');
      setMasterAchieved(false);
      return 'pending';
    }
    if (status === 'approved') {
      setExamStatus('approved');
      setMasterAchieved(roadmapLevel === 10);
      return 'approved';
    }
    if (status === 'rejected') {
      setExamStatus('idle');
      setMasterAchieved(false);
      return 'idle';
    }
    setExamStatus('idle');
    setMasterAchieved(false);
    return 'idle';
  };

  const syncMasterExamStatus = async () => {
    if (!memberId) {
      setExamStatus('idle');
      setMasterAchieved(false);
      return 'idle';
    }
    const { data, error } = await supabase.rpc('get_master_exam_status', {
      p_user_id: memberId,
    });
    if (!error && data != null) {
      const status = String(
        typeof data === 'string' ? data : data?.status ?? data?.exam_status ?? 'none'
      ).toLowerCase();
      if (status !== 'none' && status !== '') {
        return applyExamStatusFromString(status);
      }
    } else if (error) {
      console.error('[AthleteStatus] get_master_exam_status', error);
    }

    const { data: rows, error: rowErr } = await supabase
      .from('master_exam_requests')
      .select('status')
      .eq('user_id', memberId)
      .order('created_at', { ascending: false })
      .limit(1);
    if (rowErr) {
      console.error('[AthleteStatus] master_exam_requests read', rowErr);
      setExamStatus('idle');
      setMasterAchieved(false);
      return 'idle';
    }
    const row = Array.isArray(rows) ? rows[0] : null;
    return applyExamStatusFromString(row?.status);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = await syncMasterExamStatus();
      if (cancelled) return;
      return next;
    })();
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  const submitMasterExamRequest = async () => {
    if (!memberId) {
      toast.error('회원 식별자가 없어 심사 요청을 진행할 수 없습니다.');
      return;
    }
    setMasterExamSubmitting(true);
    try {
      const { data: profRow, error: profErr } = await supabase
        .from('profiles')
        .select('member_level')
        .eq('id', memberId)
        .maybeSingle();
      if (profErr) {
        console.error('[submitMasterExamRequest] profiles', profErr);
        toast.error(`프로필을 불러오지 못했습니다: ${profErr.message || String(profErr)}`);
        return;
      }
      const rawLevel = profRow?.member_level;
      const examLevel = coerceMemberLevel(rawLevel);
      console.log(
        'Exam Apply Check - Member Level:',
        examLevel,
        'Type:',
        typeof rawLevel,
        'raw:',
        rawLevel,
        'prop memberLevel:',
        memberLevel,
        'typeof prop:',
        typeof memberLevel
      );

      if (examLevel < 10) {
        toast.error(`레벨을 충족하지 못했습니다. (Lv.10 이상 필요, 현재 Lv.${examLevel})`);
        return;
      }

      const latestStatus = await syncMasterExamStatus();
      if (latestStatus === 'pending') {
        toast('이미 심사 대기 중입니다.');
        return;
      }
      if (latestStatus === 'approved') {
        toast('이미 심사가 완료된 상태입니다.');
        return;
      }

      const rpcRes = await supabase.rpc('apply_for_master_exam', {
        p_target_user: memberId,
      });
      if (!rpcRes.error) {
        setExamStatus('pending');
        toast.success('심사 요청이 완료되었습니다.');
        return;
      }

      const rpcMsg = String(rpcRes.error.message || '');
      const rpcCode = String(rpcRes.error.code || '');
      const rpcMissing =
        rpcCode === '42883' ||
        /does not exist|could not find.*function|function.*not found/i.test(rpcMsg);

      if (!rpcMissing) {
        toast.error(normalizeMasterExamError(rpcRes.error));
        return;
      }

      console.warn('[submitMasterExamRequest] apply_for_master_exam RPC unavailable, falling back to direct insert', rpcRes.error);

      const { error: insErr } = await supabase.from('master_exam_requests').insert({
        user_id: memberId,
        status: 'pending',
      });
      if (insErr) {
        const code = String(insErr.code || '');
        const msg = String(insErr.message || '').toLowerCase();
        if (code === '23505' || msg.includes('duplicate') || msg.includes('unique')) {
          setExamStatus('pending');
          toast('이미 심사 대기 중입니다.');
          return;
        }
        toast.error(normalizeMasterExamError(insErr));
        return;
      }
      setExamStatus('pending');
      toast.success('심사 요청이 완료되었습니다.');
    } catch (e) {
      console.error('[submitMasterExamRequest]', e);
      toast.error(normalizeMasterExamError(e));
    } finally {
      setMasterExamSubmitting(false);
    }
  };

  useEffect(() => {
    if (!isRoadmapOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isRoadmapOpen]);

  useEffect(() => {
    if (hideTitleArchive || !isTitleModalOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [hideTitleArchive, isTitleModalOpen]);

  useEffect(() => {
    if (!isTitleInfoOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isTitleInfoOpen]);

  useEffect(() => {
    if (hideTitleArchive || !isTitleModalOpen || !memberId) return;
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
  }, [hideTitleArchive, isTitleModalOpen, memberId]);

  useEffect(() => {
    if (hideTitleArchive || !isTitleModalOpen) return;
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
  }, [hideTitleArchive, isTitleModalOpen]);

  const equipTitle = async (titleName) => {
    const t = String(titleName || '').trim();
    if (!t) return;
    if (!memberId) {
      toast.error('회원 식별자가 없어 칭호를 장착할 수 없습니다.');
      return;
    }
    setEquippingTitle(t);
    try {
      const { error } = await supabase.rpc('equip_member_title', {
        p_target_user: memberId,
        p_title: t,
      });
      if (error) throw error;
      setLocalCurrentTitle(t);
      toast.success('대표 칭호가 변경되었습니다.');
    } catch (e) {
      console.error('Equip Error:', e);
      toast.error(`칭호 장착 실패: ${e?.message || String(e)}`);
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

  if (isMasterExamPending) {
    return <MasterExamPendingSanctum fullScreen={Boolean(masterExamPendingFullBleed)} />;
  }

  const roadmapPill = (
    <button
      type="button"
      aria-label="레벨 가이드 열기"
      onClick={openRoadmap}
      className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 backdrop-blur-md transition-all text-xs tracking-[0.16em] text-white/85"
    >
      [ ✦ 아틀리트 계급 로드맵 ]
    </button>
  );

  const masterExamCtaClass =
    'w-full max-w-sm rounded-2xl border border-amethyst/40 bg-amethyst/10 px-4 py-3 text-sm font-semibold tracking-wide text-purple-200 shadow-[0_0_28px_rgba(147,51,234,0.2)] transition-all duration-300 hover:border-amethyst/55 hover:bg-amethyst/15 disabled:opacity-50';

  const heroBlock = (
    <Motion.div
      key={epicLevelUpKey}
      className="flex flex-col items-center gap-4"
      initial={epicLevelUpKey > 0 ? { scale: 0.96, opacity: 0.85 } : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {prestige.mode === 'master' ? (
        <span
          className="text-center font-black leading-none bg-gradient-to-br from-purple-400 to-purple-700 bg-clip-text text-transparent drop-shadow-[0_0_40px_rgba(147,51,234,0.5)]"
          style={{ fontSize: 'clamp(2.5rem,15vw,7rem)', letterSpacing: '0.22em', paddingLeft: '0.22em', whiteSpace: 'nowrap', display: 'block' }}
        >
          MASTER
        </span>
      ) : (
        <span
          className={prestige.levelClassName}
          style={{ fontSize: 'clamp(4rem, 22vw, 8rem)', lineHeight: '1.15', padding: '0.3em 0', overflow: 'visible' }}
        >
          {prestige.levelText}
        </span>
      )}
      {prestige.mode !== 'master' && prestige.classLine ? (
        <p className="max-w-[95vw] text-xs font-semibold tracking-[0.4em] text-zinc-500">{prestige.classLine}</p>
      ) : null}
    </Motion.div>
  );

  const currentGuideDescription = getAthleteLevelDescription(roadmapLevel, {
    isMaster: masterAchieved,
  });
  const guideBlock = <p className="text-xs leading-relaxed text-white/45">{currentGuideDescription}</p>;
  const representativeClickable = typeof onRepresentativeTitleClick === 'function';
  const hasRepresentativeDescription = true;
  const openTitleInfoModal = async () => {
    setIsTitleInfoOpen(true);
    const currentTitle = String(localCurrentTitle || memberTitle || '').trim();
    if (!currentTitle) {
      setTitleInfoDescription('');
      return;
    }
    setLoadingTitleInfo(true);
    try {
      const readFrom = async (tableName) => {
        const byTitle = await supabase
          .from(tableName)
          .select('*')
          .or(`title.eq.${currentTitle},name.eq.${currentTitle}`)
          .limit(1);
        if (byTitle.error) {
          const msg = String(byTitle.error.message || '').toLowerCase();
          if (msg.includes('relation') || msg.includes('does not exist')) return { row: null, missing: true };
          throw byTitle.error;
        }
        return { row: Array.isArray(byTitle.data) ? byTitle.data[0] || null : null, missing: false };
      };

      const sources = ['title_definitions', 'titles', 'title_sets'];
      let matchedRow = null;
      for (const src of sources) {
        const { row } = await readFrom(src);
        if (row) {
          matchedRow = row;
          break;
        }
      }

      const exactDesc = String(matchedRow?.description || '').trim();
      if (exactDesc) {
        setTitleInfoDescription(exactDesc);
        return;
      }

      const parentTitle = String(matchedRow?.parent_title || '').trim();
      if (parentTitle) {
        const parentByTitle = await supabase
          .from('title_definitions')
          .select('*')
          .or(`title.eq.${parentTitle},name.eq.${parentTitle}`)
          .limit(1);
        if (!parentByTitle.error) {
          const parentDesc = String(
            (Array.isArray(parentByTitle.data) ? parentByTitle.data[0]?.description : '') || ''
          ).trim();
          if (parentDesc) {
            setTitleInfoDescription(parentDesc);
            return;
          }
        }
      }
      setTitleInfoDescription('');
    } catch (e) {
      console.error('[AthleteStatus] title info', e);
      setTitleInfoDescription('');
    } finally {
      setLoadingTitleInfo(false);
    }
  };

  const masterExamBlock =
    roadmapLevel === 10 && !masterAchieved ? (
      <button
        type="button"
        disabled={examStatus === 'pending' || masterExamSubmitting}
        onClick={submitMasterExamRequest}
        className={`${masterExamCtaClass} ${!isMemberIsolatedView ? 'mt-2' : ''}`}
      >
        {examStatus === 'pending'
          ? '심사 대기 중'
          : isMemberIsolatedView
            ? '마스터 심사 신청'
            : '[ 👑 마스터(졸업) 심사 요청 ]'}
      </button>
    ) : null;

  return (
    <div className="relative w-full min-h-min bg-obsidian font-sans text-white">
      <LevelUpEpicFX triggerKey={epicLevelUpKey} />

      <div
        className="pointer-events-none absolute left-1/2 top-[58%] h-[min(90%,380px)] w-[min(100%,360px)] -translate-x-1/2 -translate-y-1/2"
        style={{ background: prestige.halo }}
      />

      <div className={`relative z-10 w-full px-3 text-center ${compactMemberHero ? 'pb-2' : 'pb-32'}`}>
        <div
          className={`flex w-full flex-col items-center ${compactMemberHero ? 'gap-5 pb-6 pt-3' : 'gap-16 py-32'}`}
        >
          {heroBlock}

          {compactMemberHero && isMemberIsolatedView ? (
            <>
              <p className="text-base font-semibold tracking-wide text-zinc-100">{memberName || '회원'}</p>
              {String(subtitle || '').trim() ? (
                <p className="text-sm font-medium tracking-[0.12em] text-zinc-500">{subtitle}</p>
              ) : null}
              {String(localCurrentTitle || '').trim() ? (
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onRepresentativeTitleClick?.()}
                      className={`text-lg font-bold tracking-tight text-transparent bg-gradient-to-r from-platinum via-white to-platinum bg-clip-text transition-transform ${
                        representativeClickable ? 'cursor-pointer hover:scale-105' : ''
                      }`}
                    >
                      「{String(localCurrentTitle).trim()}」
                    </button>
                    {hasRepresentativeDescription ? (
                      <button
                        type="button"
                        aria-label="칭호 설명 보기"
                        onClick={openTitleInfoModal}
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-zinc-600 text-[10px] font-semibold text-zinc-500 transition hover:border-zinc-400 hover:text-zinc-300"
                      >
                        i
                      </button>
                    ) : null}
                  </div>
                  {representativeClickable ? <span className="text-[10px] text-zinc-600">칭호 변경</span> : null}
                </div>
              ) : null}
              {guideBlock}
              {masterExamBlock}
            </>
          ) : (
            <>
              {String(localCurrentTitle || '').trim() ? (
                <p className="text-2xl font-bold tracking-tight text-transparent bg-gradient-to-r from-platinum via-white to-platinum bg-clip-text">
                  「{String(localCurrentTitle).trim()}」
                </p>
              ) : null}

              {!isMemberIsolatedView && !hideTitleArchive ? (
                <button
                  type="button"
                  onClick={() => setIsTitleModalOpen(true)}
                  className="text-[11px] tracking-[0.12em] text-zinc-500 transition hover:text-zinc-300"
                >
                  [ ✦ 칭호 아카이브 ]
                </button>
              ) : null}

              {!isMemberIsolatedView || !compactMemberHero ? (
                <>
                  <p className="text-sm font-light tracking-wide text-zinc-500">{memberName || '회원'}</p>
                  {String(subtitle || '').trim() ? (
                    <p className="text-sm font-medium tracking-[0.12em] text-zinc-500">{subtitle}</p>
                  ) : null}
                </>
              ) : null}

              {guideBlock}

              {masterExamBlock}

              {!isMemberIsolatedView && !suppressRoadmapButton ? (
                <div className="mt-4 w-full flex justify-center">{roadmapPill}</div>
              ) : null}

              {isMemberIsolatedView && !compactMemberHero && !suppressRoadmapButton ? (
                <div className="mt-auto flex w-full justify-center pt-8">{roadmapPill}</div>
              ) : null}
            </>
          )}
        </div>
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
            <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-zinc-400">
              레벨 가이드
            </p>
            <p className="mt-2 text-sm leading-7 text-white/70">
              현재 레벨의 계급 위치를 확인하세요.
            </p>

            <div className="mt-4 rounded-2xl bg-black/40 p-2.5 backdrop-blur-2xl">
              <div className="divide-y divide-white/5">
              {DEFAULT_LEVEL_PHASES.map((phase) => {
                const isCurrent = phase.id === currentPhaseKey;
                const parsed = parseLevelRange(phase.level_range);
                const tierMin = parsed?.min ?? null;
                const tierMax = parsed?.max ?? null;
                const isMasterTier = phase.id === 'tier-6';
                const rankColorClass = isMasterTier
                  ? 'text-purple-500 drop-shadow-[0_0_24px_rgba(147,51,234,0.45)]'
                  : phase.id === 'tier-5'
                    ? 'text-red-500'
                    : phase.id === 'tier-4'
                      ? 'text-yellow-400'
                      : phase.id === 'tier-3'
                        ? 'text-slate-400'
                        : phase.id === 'tier-2'
                          ? 'text-amber-600'
                          : 'text-zinc-200';
                return (
                  <div
                    key={phase.id}
                    className={`px-3 py-3 transition-all ${
                      isCurrent
                        ? 'bg-zinc-700/15 opacity-100'
                        : 'opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 py-0.5">
                      <p
                        className={`text-xs font-semibold tracking-widest ${rankColorClass}`}
                      >
                        {phase.title}
                      </p>
                      <LevelFacetBadge text={isMasterTier ? 'MASTER' : renderLevelRangeText(tierMin, tierMax)} />
                    </div>
                    <p className="mt-1.5 text-xs font-light leading-6 text-zinc-400">{phase.description}</p>
                    {isCurrent ? (
                      <p className="mt-2 text-[10px] font-medium uppercase tracking-widest text-zinc-300">
                        현재 위치
                      </p>
                    ) : null}
                  </div>
                );
              })}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {!hideTitleArchive && isTitleModalOpen ? (
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
            <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-zinc-400">
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
                            className="rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-white/75 transition hover:border-zinc-400/40 hover:text-zinc-200 disabled:opacity-40"
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
                                ? 'border-zinc-300/70 bg-gradient-to-r from-zinc-700/80 to-zinc-500/50 shadow-[0_0_10px_rgba(161,161,170,0.35)]'
                                : 'border-zinc-700 bg-zinc-900'
                            }`}
                          >
                            <p className={`text-sm ${unlocked ? 'text-zinc-100' : 'text-zinc-300'}`}>{subTitle}</p>
                            {grantedAt ? <p className="mt-0.5 text-[11px] text-white/45">{grantedAt}</p> : null}
                          </div>
                        );
                      })}
                    </div>
                    {group.mainTitle === String(memberTitle || '').trim() ? (
                      <p className="mt-2 text-[10px] text-zinc-300">대표 칭호</p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {isTitleInfoOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="칭호 설명"
          onClick={() => setIsTitleInfoOpen(false)}
        >
          <div
            className="w-full max-w-[320px] rounded-2xl border border-white/10 bg-[#050505] p-5 shadow-[0_20px_60px_-12px_rgba(0,0,0,0.8)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">칭호 설명</p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-200">
              {loadingTitleInfo
                ? '설명을 불러오는 중...'
                : String(titleInfoDescription || representativeTitleDescription || '').trim() || '아직 등록된 칭호 설명이 없습니다.'}
            </p>
            <button
              type="button"
              onClick={() => setIsTitleInfoOpen(false)}
              className="mt-6 w-full rounded-lg border border-white/15 bg-white/5 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-white/25 hover:bg-white/10"
            >
              닫기
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
