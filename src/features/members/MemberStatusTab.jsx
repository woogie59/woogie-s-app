import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { motion as Motion } from 'framer-motion';
import { supabase } from '../../lib/supabaseClient';
import AthleteStatus from './AthleteStatus';
import MemberGrowthLedger from './MemberGrowthLedger';
import MemberPhoneMirror from './MemberPhoneMirror';

const PHYSICAL_AUTONOMY_MAX = 10;

function supabaseErrorMessage(error) {
  if (!error) return '';
  if (typeof error === 'object' && error !== null) {
    const bits = [error.message, error.details, error.hint].filter(Boolean);
    if (bits.length) return bits.join(' — ');
  }
  return String(error);
}

export default function MemberStatusTab({ userId, profile, stats, memberLevel, onRefresh, onMemberLevelSynced }) {
  const [saving, setSaving] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState('');
  const [customComment, setCustomComment] = useState('');
  const [selectedGuide, setSelectedGuide] = useState(null);
  const [loadingGuide, setLoadingGuide] = useState(false);
  const [titleDefinitions, setTitleDefinitions] = useState([]);
  const [loadingTitleDefinitions, setLoadingTitleDefinitions] = useState(false);
  const [newMainTitle, setNewMainTitle] = useState('');
  const [newSubTitlesRaw, setNewSubTitlesRaw] = useState('');
  const [creatingTitleSet, setCreatingTitleSet] = useState(false);
  const [togglingTitleName, setTogglingTitleName] = useState('');
  const [ownedTitles, setOwnedTitles] = useState([]);
  const [loadingOwnedTitles, setLoadingOwnedTitles] = useState(false);
  const [committedMemberLevel, setCommittedMemberLevel] = useState(() => {
    const n = Number(memberLevel);
    return Number.isFinite(n) ? Math.min(PHYSICAL_AUTONOMY_MAX, Math.max(1, n)) : 1;
  });
  const [committedTitle, setCommittedTitle] = useState(() => String(profile?.current_title ?? ''));
  const [ledgerRefreshKey, setLedgerRefreshKey] = useState(0);

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
    if (selectedLevelNumber == null) {
      setSelectedGuide(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingGuide(true);
      const { data, error } = await supabase
        .from('roadmap_guides')
        .select('level,title,description')
        .eq('level', selectedLevelNumber)
        .maybeSingle();
      if (cancelled) return;
      setLoadingGuide(false);
      if (error) {
        console.error('[MemberStatusTab] roadmap_guides by level', error);
        setSelectedGuide(null);
        return;
      }
      setSelectedGuide(data ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedLevelNumber]);

  const standardComment = selectedGuide?.description ? String(selectedGuide.description) : '';

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
      const main = mainRows.find((row) => String(row.title || '').trim() === mainTitle) ?? null;
      const subs = subRows.filter((row) => String(row.parent_title || '').trim() === mainTitle);
      return { mainTitle, main, subs };
    });
  }, [titleDefinitions]);

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
    const subArray = newSubTitlesRaw
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
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
      setNewMainTitle('');
      setNewSubTitlesRaw('');
      await fetchTitleDefinitions();
      toast.success('칭호 세트가 생성되었습니다.');
    } catch (e) {
      console.error('[MemberStatusTab] admin_create_title_set', e);
      toast.error(`칭호 세트 생성 실패: ${supabaseErrorMessage(e)}`);
    } finally {
      setCreatingTitleSet(false);
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

  return (
    <div className="flex flex-col gap-10 xl:flex-row xl:items-start xl:gap-10">
      <div className="min-w-0 flex-1 rounded-3xl bg-[#030303] p-4 ring-1 ring-emerald-500/15">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
          <div className="border-b border-white/10 pb-5">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.35em] text-emerald-400/80">조정 패널</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              이제 스탯 퍼센트는 사용하지 않습니다. 레벨과 코멘트만 저장합니다.
            </p>
          </div>

          <div className="mt-6 space-y-6">
            <div className="border-t border-white/10 pt-6">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500/70">레벨 부여</h3>
              <p className="mt-1 text-[11px] text-white/40">회원의 목표 레벨(1~10)을 선택하세요.</p>
              <div className="mt-3">
                <select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none ring-emerald-500/30 focus:ring-2"
                >
                  <option value="">레벨 선택</option>
                  {Array.from({ length: PHYSICAL_AUTONOMY_MAX }, (_, i) => i + 1).map((lv) => (
                    <option key={lv} value={String(lv)}>
                      LV. {lv}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="border-t border-white/10 pt-6">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500/70">해당 레벨 표준 기준</h3>
              <div className="mt-3 rounded-xl border border-white/10 bg-black/35 px-3 py-3 text-sm leading-relaxed text-white/75">
                {loadingGuide ? (
                  '기준 불러오는 중...'
                ) : selectedGuide ? (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold tracking-wide text-emerald-300">{selectedGuide.title || `LV. ${selectedLevelNumber}`}</p>
                    <p>{standardComment}</p>
                  </div>
                ) : (
                  '선택한 레벨의 기준이 없습니다. roadmap_guides를 확인하세요.'
                )}
              </div>
            </div>

            <div className="border-t border-white/10 pt-6">
              <label className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500/70">
                개별 코멘트 (선택 사항)
              </label>
              <textarea
                value={customComment}
                onChange={(e) => setCustomComment(e.target.value)}
                rows={4}
                placeholder="예: 지난 4주간 루틴 준수율이 높고 폼 안정성이 크게 향상되었습니다."
                className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-white/90 outline-none ring-emerald-500/25 placeholder:text-white/25 focus:ring-2"
              />
            </div>

            <div className="border-t border-white/10 pt-6">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500/70">칭호 보관함 관리</h3>
              <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-[11px] tracking-[0.14em] text-white/45">신규 칭호 세트 창조</p>
                <label className="mt-2 block text-[11px] text-white/55">메인 칭호 명 (예: 굿포머)</label>
                <input
                  type="text"
                  value={newMainTitle}
                  onChange={(e) => setNewMainTitle(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 text-sm text-white/90 outline-none ring-emerald-500/25 focus:ring-2"
                />
                <label className="mt-3 block text-[11px] text-white/55">
                  서브 칭호 목록 (쉼표로 구분. 예: 가슴, 등, 하체, 어깨)
                </label>
                <input
                  type="text"
                  value={newSubTitlesRaw}
                  onChange={(e) => setNewSubTitlesRaw(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 text-sm text-white/90 outline-none ring-emerald-500/25 focus:ring-2"
                />
                <button
                  type="button"
                  disabled={creatingTitleSet}
                  onClick={createTitleSet}
                  className="mt-3 w-full rounded-xl border border-emerald-500/45 bg-emerald-900/30 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-800/35 disabled:opacity-40"
                >
                  칭호 세트 생성
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-[11px] tracking-[0.14em] text-white/45">칭호 토글 보드</p>
                {loadingTitleDefinitions || loadingOwnedTitles ? (
                  <p className="mt-2 text-sm text-white/40">불러오는 중...</p>
                ) : titleHierarchy.length === 0 ? (
                  <p className="mt-2 text-sm text-white/40">칭호 정의가 없습니다.</p>
                ) : (
                  <div className="mt-2 space-y-3">
                    {titleHierarchy.map(({ mainTitle, subs }) => {
                      const mainOwned = ownedTitleSet.has(mainTitle);
                      return (
                        <div key={mainTitle} className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5">
                          <p
                            className={`text-sm font-semibold tracking-wide ${
                              mainOwned
                                ? 'text-amber-200 drop-shadow-[0_0_10px_rgba(251,191,36,0.45)]'
                                : 'text-white/45'
                            }`}
                          >
                            {mainTitle || '메인 칭호'}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {subs.map((sub) => {
                              const subTitle = String(sub.title || '');
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
                                      ? 'border-emerald-300/70 bg-emerald-500/35 text-emerald-100'
                                      : 'border-white/20 bg-black/25 text-white/60'
                                  } disabled:opacity-50`}
                                >
                                  {subTitle || '서브 칭호'}
                                </button>
                              );
                            })}
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
                className="apply-exp-cta relative w-full overflow-hidden rounded-2xl border border-emerald-400/40 bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 py-4 text-center text-sm font-black uppercase tracking-[0.2em] text-white shadow-[0_0_32px_rgba(16,185,129,0.25)] transition disabled:cursor-not-allowed disabled:opacity-35"
              >
                <span className="relative z-10">적용</span>
                <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_0%,rgba(255,255,255,0.12)_45%,transparent_90%)] opacity-60" />
              </Motion.button>
              <p className="mt-3 text-center text-[10px] text-white/30">
                {selectedLevelNumber == null ? '레벨을 먼저 선택하세요.' : '선택 레벨과 코멘트를 성장 기록에 저장합니다.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 xl:sticky xl:top-6 xl:self-start">
        <MemberPhoneMirror label="아틀리트 상태">
          <div className="space-y-6 px-1">
            <AthleteStatus
              memberId={userId}
              memberName={displayName}
              memberLevel={committedMemberLevel}
              memberTitle={committedTitle}
              subtitle="아틀리트 상태"
              epicLevelUpKey={0}
            />
            <div>
              <p className="mb-3 text-center text-[11px] font-medium tracking-[0.2em] text-white/40">
                성장 기록
              </p>
              <MemberGrowthLedger targetUserId={userId} refreshKey={ledgerRefreshKey} />
            </div>
          </div>
        </MemberPhoneMirror>
      </div>
    </div>
  );
}
