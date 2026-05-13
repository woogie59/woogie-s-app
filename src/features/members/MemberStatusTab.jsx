import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { motion as Motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import AthleteStatus from './AthleteStatus';
import MemberPhoneMirror from './MemberPhoneMirror';
import AthleteStatusBoard from './AthleteStatusBoard';
import { getAthleteLevelDescription } from './athleteLevelDescriptions';

const PHYSICAL_AUTONOMY_MAX = 10;

function tierLabelFromLevel(lv) {
  if (lv <= 1) return '초심자';
  if (lv <= 4) return '수행자';
  if (lv <= 7) return '숙련자';
  if (lv <= 9) return '엘리트';
  return '챌린저';
}

const LEVEL_OPTIONS = Array.from({ length: PHYSICAL_AUTONOMY_MAX }, (_, i) => {
  const lv = i + 1;
  return {
    value: String(lv),
    label: `LV. ${lv}`,
    className: tierLabelFromLevel(lv),
    description: getAthleteLevelDescription(lv),
  };
});

function supabaseErrorMessage(error) {
  if (!error) return '';
  if (typeof error === 'object' && error !== null) {
    const bits = [error.message, error.details, error.hint].filter(Boolean);
    if (bits.length) return bits.join(' — ');
  }
  return String(error);
}

function getTitleName(row) {
  return String(row?.name ?? row?.title ?? '').trim();
}

export default function MemberStatusTab({ userId, profile, memberLevel, onRefresh, onMemberLevelSynced, onExitAthlete }) {
  const [saving, setSaving] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState('');
  const [isLevelDropdownOpen, setIsLevelDropdownOpen] = useState(false);
  const levelDropdownRef = useRef(null);
  const [customComment, setCustomComment] = useState('');
  const [masterExamStatus, setMasterExamStatus] = useState('idle');
  const [titleDefinitions, setTitleDefinitions] = useState([]);
  const [loadingTitleDefinitions, setLoadingTitleDefinitions] = useState(false);
  const [newMainTitle, setNewMainTitle] = useState('');
  const [newMainTitleDescription, setNewMainTitleDescription] = useState('');
  const [newSubTitlesRaw, setNewSubTitlesRaw] = useState('');
  const [creatingTitleSet, setCreatingTitleSet] = useState(false);
  const [savingMainDescription, setSavingMainDescription] = useState('');
  const [mainTitleDescriptions, setMainTitleDescriptions] = useState({});
  const [togglingTitleName, setTogglingTitleName] = useState('');
  const [ownedTitles, setOwnedTitles] = useState([]);
  const [loadingOwnedTitles, setLoadingOwnedTitles] = useState(false);
  const [committedMemberLevel, setCommittedMemberLevel] = useState(() => {
    const n = Number(memberLevel);
    return Number.isFinite(n) ? Math.min(PHYSICAL_AUTONOMY_MAX, Math.max(1, n)) : 1;
  });
  const [committedTitle, setCommittedTitle] = useState(() => String(profile?.current_title ?? ''));
  const [ledgerRefreshKey, setLedgerRefreshKey] = useState(0);
  const [roadmapOpen, setRoadmapOpen] = useState(false);
  const [isAthleteEnabled, setIsAthleteEnabled] = useState(() => !!profile?.is_athlete_system_enabled);
  const [togglingAthleteSystem, setTogglingAthleteSystem] = useState(false);

  if (!profile || !userId) {
    return (
      <div className="min-h-[60vh] bg-[#050505] [font-family:Urbanist,sans-serif] px-6 py-10 text-center text-zinc-400">
        <p className="text-sm tracking-wide">회원 데이터가 유실되어 아틀리트 화면을 종료합니다.</p>
      </div>
    );
  }

  const fetchOwnedTitles = async () => {
    if (!userId) {
      setOwnedTitles([]);
      return;
    }
    setLoadingOwnedTitles(true);
    const { data, error } = await supabase
      .from('member_titles')
      .select('*')
      .eq('user_id', userId)
      .order('granted_at', { ascending: false });
    console.log('Titles Found:', data);
    setLoadingOwnedTitles(false);
    if (error) {
      console.error('[MemberStatusTab] member_titles', error);
      setOwnedTitles([]);
      return;
    }
    setOwnedTitles(Array.isArray(data) ? data : []);
  };

  const fetchTitleDefinitions = async () => {
    setLoadingTitleDefinitions(true);
    const { data, error } = await supabase
      .from('title_definitions')
      .select('*')
      .order('id', { ascending: true });
    console.log('Titles Found:', data);
    setLoadingTitleDefinitions(false);
    if (error) {
      console.error('[MemberStatusTab] title_definitions', error);
      setTitleDefinitions([]);
      return;
    }
    setTitleDefinitions(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    const n = Number(memberLevel);
    setCommittedMemberLevel(Number.isFinite(n) ? Math.min(PHYSICAL_AUTONOMY_MAX, Math.max(1, n)) : 1);
  }, [memberLevel, userId]);

  useEffect(() => {
    const nextTitle = String(profile?.current_title ?? '');
    setCommittedTitle(nextTitle);
  }, [profile?.current_title, userId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await fetchOwnedTitles();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, ledgerRefreshKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await fetchTitleDefinitions();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = profile?.name || '회원';

  const selectedLevelNumber = useMemo(() => {
    const n = Number.parseInt(selectedLevel, 10);
    if (!Number.isFinite(n)) return null;
    return Math.min(PHYSICAL_AUTONOMY_MAX, Math.max(1, n));
  }, [selectedLevel]);

  useEffect(() => {
    if (!userId) {
      setMasterExamStatus('idle');
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: rpcData, error } = await supabase.rpc('get_master_exam_status', {
        p_user_id: userId,
      });
      if (cancelled) return;
      if (!error && rpcData != null) {
        const status = String(typeof rpcData === 'string' ? rpcData : rpcData?.status ?? rpcData?.exam_status ?? '')
          .toLowerCase()
          .trim();
        setMasterExamStatus(status || 'idle');
        return;
      }

      const { data: rows, error: rowErr } = await supabase
        .from('master_exam_requests')
        .select('status')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (cancelled) return;
      if (rowErr) {
        console.error('[MemberStatusTab] master_exam_requests', rowErr);
        setMasterExamStatus('idle');
        return;
      }
      const latestStatus = String(Array.isArray(rows) ? rows[0]?.status ?? '' : '').toLowerCase().trim();
      setMasterExamStatus(latestStatus || 'idle');
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const standardComment = selectedLevelNumber == null
    ? ''
    : getAthleteLevelDescription(selectedLevelNumber, {
      isMaster: selectedLevelNumber === 10 && masterExamStatus === 'approved',
    });

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
      const main = mainRows.find((row) => getTitleName(row) === mainTitle) ?? null;
      const subs = subRows.filter((row) => String(row.parent_title || '').trim() === mainTitle);
      return { mainTitle, main, subs };
    });
  }, [titleDefinitions]);

  useEffect(() => {
    const draft = {};
    titleHierarchy.forEach(({ mainTitle, main }) => {
      draft[mainTitle] = String(main?.description || '').trim();
    });
    setMainTitleDescriptions(draft);
  }, [titleHierarchy]);

  const ownedTitleSet = useMemo(
    () => new Set((ownedTitles || []).map((row) => String(row.title || '').trim()).filter(Boolean)),
    [ownedTitles]
  );

  const saveGrowthRecord = async () => {
    if (!userId) {
      toast.error('회원 정보가 없습니다.');
      return;
    }
    if (selectedLevelNumber == null) {
      toast.error('레벨을 선택하세요.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc('admin_save_growth_record', {
        p_target_user: userId,
        p_new_level: selectedLevelNumber,
        p_standard_comment: standardComment || null,
        p_custom_comment: customComment.trim() || null,
      });
      if (error) throw error;

      setCommittedMemberLevel(selectedLevelNumber);
      setLedgerRefreshKey((k) => k + 1);
      setCustomComment('');
      await onRefresh?.();
      onMemberLevelSynced?.(selectedLevelNumber);
      toast.success('성장 기록이 저장되었습니다.');
    } catch (e) {
      console.error('[MemberStatusTab] admin_save_growth_record', e);
      toast.error(`저장 실패: ${supabaseErrorMessage(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const createTitleSet = async () => {
    const mainVal = newMainTitle.trim();
    const subArray = [
      ...new Set(
        newSubTitlesRaw
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean)
      ),
    ];
    if (!mainVal) {
      toast.error('메인 칭호 명을 입력하세요.');
      return;
    }
    if (subArray.length === 0) {
      toast.error('서브 칭호를 1개 이상 입력하세요.');
      return;
    }
    setCreatingTitleSet(true);
    try {
      const { error } = await supabase.rpc('admin_create_title_set', {
        p_main_title: mainVal,
        p_sub_titles: subArray,
      });
      if (error) throw error;
      const descVal = newMainTitleDescription.trim();
      if (descVal) {
        const { error: descErr } = await supabase.rpc('admin_upsert_title_description', {
          p_title_name: mainVal,
          p_description: descVal,
        });
        if (descErr) {
          console.error('[MemberStatusTab] description save after create:', descErr);
        }
      }
      setNewMainTitle('');
      setNewMainTitleDescription('');
      setNewSubTitlesRaw('');
      // 생성 직후 보드 즉시 동기화 (정의 + 보유 현황)
      await fetchTitleDefinitions();
      await fetchOwnedTitles();
      setLedgerRefreshKey((k) => k + 1);
      toast.success('칭호 세트가 생성되었습니다.');
    } catch (e) {
      console.error('[MemberStatusTab] admin_create_title_set', e);
      toast.error(`칭호 세트 생성 실패: ${supabaseErrorMessage(e)}`);
    } finally {
      setCreatingTitleSet(false);
    }
  };

  const deleteTitleSet = async (mainTitleName) => {
    const mainTitle = String(mainTitleName || '').trim();
    if (!mainTitle) return;
    const ok = window.confirm(
      '이 칭호 세트(메인 및 서브)를 완전히 삭제하시겠습니까? 회원들의 획득 기록도 사라집니다.'
    );
    if (!ok) return;
    try {
      const { error } = await supabase.rpc('admin_delete_title_set', { p_main_title: mainTitle });
      if (error) throw error;
      await fetchTitleDefinitions();
      await fetchOwnedTitles();
      setLedgerRefreshKey((k) => k + 1);
      await onRefresh?.();
      toast.success('칭호 세트를 삭제했습니다.');
    } catch (e) {
      console.error('[MemberStatusTab] admin_delete_title_set', e);
      toast.error(`칭호 세트 삭제 실패: ${supabaseErrorMessage(e)}`);
    }
  };

  const toggleSubTitle = async (titleName, currentlyActive) => {
    if (!userId) {
      toast.error('회원 정보가 없습니다.');
      return;
    }
    const title = String(titleName || '').trim();
    if (!title) return;
    setTogglingTitleName(title);
    try {
      const { data, error } = await supabase.rpc('admin_toggle_sub_title', {
        p_target_user: userId,
        p_title_name: title,
        p_is_active: !currentlyActive,
      });
      if (error) throw error;

      const unlockedMainTitle = typeof data === 'string'
        ? data.trim()
        : String(data?.unlocked_main_title || data?.main_title || '').trim();
      setLedgerRefreshKey((k) => k + 1);
      await onRefresh?.();
      if (unlockedMainTitle) {
        toast.success(`[${unlockedMainTitle}] 칭호 달성!`);
      }
      toast.success(currentlyActive ? '서브 칭호를 회수했습니다.' : '서브 칭호를 수여했습니다.');
    } catch (e) {
      console.error('[MemberStatusTab] admin_toggle_sub_title', e);
      toast.error(`칭호 토글 실패: ${supabaseErrorMessage(e)}`);
    } finally {
      setTogglingTitleName('');
    }
  };

  const toggleAthleteSystem = async () => {
    if (!userId) return;
    const next = !isAthleteEnabled;
    setTogglingAthleteSystem(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_athlete_system_enabled: next })
        .eq('id', userId);
      if (error) throw error;
      setIsAthleteEnabled(next);
      await onRefresh?.();
      toast.success(next ? '아틀리트 시스템이 활성화되었습니다.' : '아틀리트 시스템이 비활성화되었습니다.');
    } catch (e) {
      console.error('[MemberStatusTab] toggleAthleteSystem', e);
      toast.error(`변경 실패: ${supabaseErrorMessage(e)}`);
    } finally {
      setTogglingAthleteSystem(false);
    }
  };

  const saveMainTitleDescription = async (mainTitleName) => {
    const mainTitle = String(mainTitleName || '').trim();
    if (!mainTitle) return;
    const descVal = String(mainTitleDescriptions[mainTitle] ?? '').trim();
    setSavingMainDescription(mainTitle);
    try {
      const { error } = await supabase.rpc('admin_upsert_title_description', {
        p_title_name: mainTitle,
        p_description: descVal,
      });
      if (error) throw error;
      await fetchTitleDefinitions();
      toast.success('칭호 설명이 저장되었습니다.');
    } catch (e) {
      console.error('[MemberStatusTab] saveMainTitleDescription', e);
      toast.error(`칭호 설명 저장 실패: ${supabaseErrorMessage(e)}`);
    } finally {
      setSavingMainDescription('');
    }
  };

  return (
    <div className="animate-in fade-in zoom-in-95 duration-1000 ease-out fill-mode-forwards [font-family:Urbanist,sans-serif]">

      <div className="flex flex-col gap-12 xl:flex-row xl:items-start xl:gap-12">
      <div className="min-w-0 flex-1 rounded-3xl bg-[#050505] p-4">
        <div className="rounded-2xl border border-white/5 bg-zinc-900/40 p-6 shadow-2xl backdrop-blur-xl">
          <div className="border-b border-white/10 pb-5">
            <h2 className="text-zinc-400 text-xs font-bold uppercase tracking-widest">조정 패널</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              이제 스탯 퍼센트는 사용하지 않습니다. 레벨과 코멘트만 저장합니다.
            </p>
          </div>

          <div className="mt-8 space-y-10">
            <div className="border-t border-white/10 pt-6">
              <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-widest">아틀리트 시스템 접근</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                활성화 시 회원 앱에 "나의 상태" 화면이 표시됩니다. 비활성화하면 카드 자체가 숨겨집니다.
              </p>
              <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                <span className="text-sm font-medium text-zinc-200">
                  {isAthleteEnabled ? '활성화됨' : '비활성화됨'}
                </span>
                <button
                  type="button"
                  disabled={togglingAthleteSystem}
                  onClick={toggleAthleteSystem}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                    isAthleteEnabled ? 'bg-purple-600' : 'bg-zinc-700'
                  }`}
                  aria-checked={isAthleteEnabled}
                  role="switch"
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      isAthleteEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="border-t border-white/10 pt-6">
              <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-widest">레벨 부여</h3>
              <p className="mt-2 text-sm text-zinc-500">회원의 목표 레벨(1~10)을 선택하세요.</p>
              <div className="relative mt-3" ref={levelDropdownRef}>
                {/* Trigger button */}
                <button
                  type="button"
                  onClick={() => setIsLevelDropdownOpen((o) => !o)}
                  className="w-full flex items-center justify-between rounded-lg border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white outline-none transition-all hover:border-zinc-600 focus:ring-1 focus:ring-zinc-500"
                >
                  <span className={selectedLevel ? 'text-white' : 'text-zinc-500'}>
                    {selectedLevel
                      ? `LV. ${selectedLevel} — ${tierLabelFromLevel(Number(selectedLevel))}`
                      : '레벨 선택'}
                  </span>
                  <svg
                    className={`h-4 w-4 text-zinc-500 transition-transform duration-200 ${isLevelDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown panel */}
                {isLevelDropdownOpen && (
                  <>
                    {/* Outside-click overlay */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsLevelDropdownOpen(false)}
                    />
                    <div className="absolute left-0 right-0 z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border border-zinc-800 bg-[#111] shadow-2xl">
                      {LEVEL_OPTIONS.map((opt) => {
                        const isSelected = selectedLevel === opt.value;
                        return (
                          <div
                            key={opt.value}
                            onClick={() => {
                              setSelectedLevel(opt.value);
                              setIsLevelDropdownOpen(false);
                            }}
                            className={`cursor-pointer border-b border-zinc-800/50 p-3 transition-colors last:border-b-0 ${
                              isSelected
                                ? 'bg-zinc-700/60'
                                : 'hover:bg-zinc-800'
                            }`}
                          >
                            <div className="font-bold text-zinc-200">
                              {opt.label}
                              <span className="ml-2 text-xs font-semibold text-zinc-400">
                                — {opt.className}
                              </span>
                            </div>
                            <div className="mt-1 text-xs leading-relaxed text-zinc-500 line-clamp-2">
                              {opt.description}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="border-t border-white/10 pt-6">
              <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-widest">해당 레벨 표준 기준</h3>
              <div className="mt-3 rounded-lg border border-white/10 bg-black/50 px-3 py-3 text-sm leading-relaxed text-zinc-300">
                {selectedLevelNumber == null ? '레벨을 선택하면 기준이 표시됩니다.' : standardComment}
              </div>
            </div>

            <div className="border-t border-white/10 pt-6">
              <label className="text-zinc-400 text-xs font-bold uppercase tracking-widest">
                개별 코멘트 (선택 사항)
              </label>
              <textarea
                value={customComment}
                onChange={(e) => setCustomComment(e.target.value)}
                rows={4}
                placeholder="예: 지난 4주간 루틴 준수율이 높고 폼 안정성이 크게 향상되었습니다."
                className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white outline-none transition-all placeholder:text-zinc-500 focus:ring-1 focus:ring-zinc-500"
              />
            </div>

            <div className="border-t border-white/10 pt-6">
              <h3 className="text-zinc-400 text-xs font-bold uppercase tracking-widest">칭호 보관함 관리</h3>
              <div className="mt-3 rounded-2xl border border-white/5 bg-zinc-900/40 p-4 shadow-2xl backdrop-blur-xl">
                <p className="text-sm tracking-wide text-zinc-500">신규 칭호 세트 창조</p>
                <label className="mt-3 block text-sm text-zinc-500">메인 칭호 명 (예: 굿포머)</label>
                <input
                  type="text"
                  value={newMainTitle}
                  onChange={(e) => setNewMainTitle(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white outline-none transition-all focus:ring-1 focus:ring-zinc-500"
                />
                <label className="mt-3 block text-sm text-zinc-500">메인 칭호 설명</label>
                <textarea
                  value={newMainTitleDescription}
                  onChange={(e) => setNewMainTitleDescription(e.target.value)}
                  rows={3}
                  placeholder="예: 어떤 환경에서도 자세 교정과 운동 수행을 이끄는 상급 칭호."
                  className="mt-1.5 w-full resize-none rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white outline-none transition-all placeholder:text-zinc-500 focus:ring-1 focus:ring-zinc-500"
                />
                <label className="mt-3 block text-sm text-zinc-500">
                  서브 칭호 목록 (쉼표로 구분. 예: 가슴, 등, 하체, 어깨)
                </label>
                <input
                  type="text"
                  value={newSubTitlesRaw}
                  onChange={(e) => setNewSubTitlesRaw(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white outline-none transition-all focus:ring-1 focus:ring-zinc-500"
                />
                <button
                  type="button"
                  disabled={creatingTitleSet}
                  onClick={createTitleSet}
                  className="mt-4 w-full rounded-lg border border-white/10 bg-black/50 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition-all hover:border-zinc-500 disabled:opacity-40"
                >
                  칭호 세트 생성
                </button>
              </div>

              <div className="mt-4 rounded-2xl border border-white/5 bg-zinc-900/40 p-4 shadow-2xl backdrop-blur-xl">
                <p className="text-sm tracking-wide text-zinc-500">칭호 토글 보드</p>
                {loadingTitleDefinitions || loadingOwnedTitles ? (
                  <p className="mt-2 text-sm text-zinc-500">불러오는 중...</p>
                ) : titleHierarchy.length === 0 ? (
                  <p className="mt-2 text-sm text-zinc-500">칭호 정의가 없습니다.</p>
                ) : (
                  <div className="mt-2 space-y-3">
                    {titleHierarchy.map(({ mainTitle, subs }) => {
                      const mainOwned = ownedTitleSet.has(mainTitle);
                      return (
                        <div key={mainTitle} className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <p
                              className={`text-sm font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 via-yellow-300 to-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.4)] ${
                                mainOwned ? '' : 'opacity-60'
                              }`}
                            >
                              {mainTitle || '메인 칭호'}
                            </p>
                            <button
                              type="button"
                              onClick={() => deleteTitleSet(mainTitle)}
                              className="rounded-md border border-white/10 bg-zinc-900 p-1.5 text-white/55 transition hover:border-red-400/40 hover:text-red-300"
                              aria-label="칭호 세트 삭제"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {subs.map((sub) => {
                              const subTitle = getTitleName(sub);
                              const active = ownedTitleSet.has(subTitle);
                              const pending = togglingTitleName === subTitle;
                              return (
                                <button
                                  key={sub.id}
                                  type="button"
                                  disabled={pending || togglingTitleName !== ''}
                                  onClick={() => toggleSubTitle(subTitle, active)}
                                  className={`rounded-full border px-2.5 py-1 text-xs transition ${
                                    active
                                      ? 'border-zinc-400/70 bg-gradient-to-r from-zinc-700/80 to-zinc-500/60 text-zinc-100 shadow-[0_0_12px_rgba(161,161,170,0.38)]'
                                      : 'border-zinc-700 bg-zinc-900 text-zinc-300'
                                  } disabled:opacity-50`}
                                >
                                  {subTitle}
                                </button>
                              );
                            })}
                          </div>
                          <div className="mt-3">
                            <label className="block text-[11px] text-zinc-500">메인 칭호 설명</label>
                            <textarea
                              rows={2}
                              value={mainTitleDescriptions[mainTitle] ?? ''}
                              onChange={(e) =>
                                setMainTitleDescriptions((prev) => ({
                                  ...prev,
                                  [mainTitle]: e.target.value,
                                }))
                              }
                              className="mt-1.5 w-full resize-none rounded-lg border border-white/10 bg-black/50 px-2.5 py-2 text-xs text-white outline-none transition-all placeholder:text-zinc-500 focus:ring-1 focus:ring-zinc-500"
                              placeholder="메인 칭호 설명을 입력하세요"
                            />
                            <button
                              type="button"
                              onClick={() => saveMainTitleDescription(mainTitle)}
                              disabled={savingMainDescription !== '' && savingMainDescription !== mainTitle}
                              className="mt-2 rounded-md border border-white/10 bg-black/50 px-2.5 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-zinc-500 disabled:opacity-40"
                            >
                              {savingMainDescription === mainTitle ? '저장 중…' : '설명 저장'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-white/10 pt-6">
              <Motion.button
                type="button"
                disabled={saving || selectedLevelNumber == null}
                onClick={saveGrowthRecord}
                whileHover={!saving && selectedLevelNumber != null ? { scale: 1.02 } : {}}
                whileTap={!saving && selectedLevelNumber != null ? { scale: 0.98 } : {}}
                className="apply-exp-cta relative w-full overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/60 py-4 text-center text-sm font-black uppercase tracking-[0.2em] text-white shadow-2xl transition-all hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <span className="relative z-10">적용</span>
                <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_0%,rgba(255,255,255,0.12)_45%,transparent_90%)] opacity-60" />
              </Motion.button>
              <p className="mt-3 text-center text-sm text-zinc-500">
                {selectedLevelNumber == null ? '레벨을 먼저 선택하세요.' : '선택 레벨과 코멘트를 성장 기록에 저장합니다.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 xl:sticky xl:top-6 xl:self-start">
        <MemberPhoneMirror label="멤버 상태">
          <div className="flex min-h-[min(72vh,640px)] flex-col gap-6 px-1">
            <AthleteStatus
              memberId={userId}
              memberName={displayName}
              memberLevel={committedMemberLevel}
              memberTitle={committedTitle}
              subtitle=""
              epicLevelUpKey={0}
              suppressRoadmapButton
              hideTitleArchive
              compactMemberHero
              roadmapOpen={roadmapOpen}
              onRoadmapOpenChange={setRoadmapOpen}
            />

            <div className="space-y-6">
              <AthleteStatusBoard
                targetUserId={userId}
                ownedTitles={ownedTitles}
                loadingData={loadingOwnedTitles}
                ledgerRefreshKey={ledgerRefreshKey}
              />
            </div>

            <div className="mt-auto flex justify-center pb-2 pt-1">
              <button
                type="button"
                aria-label="레벨 가이드 열기"
                onClick={() => setRoadmapOpen(true)}
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-xs tracking-[0.16em] text-white/85 backdrop-blur-md transition-all hover:bg-white/10"
              >
                [ ✦ 아틀리트 계급 로드맵 ]
              </button>
            </div>
          </div>
        </MemberPhoneMirror>
      </div>
      </div>
    </div>
  );
}
