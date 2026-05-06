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
  const [selectedSubTitle, setSelectedSubTitle] = useState('');
  const [equipImmediately, setEquipImmediately] = useState(true);
  const [grantingTitle, setGrantingTitle] = useState(false);
  const [ownedTitles, setOwnedTitles] = useState([]);
  const [loadingOwnedTitles, setLoadingOwnedTitles] = useState(false);
  const [committedMemberLevel, setCommittedMemberLevel] = useState(() => {
    const n = Number(memberLevel);
    return Number.isFinite(n) ? Math.min(PHYSICAL_AUTONOMY_MAX, Math.max(1, n)) : 1;
  });
  const [committedTitle, setCommittedTitle] = useState(() => String(profile?.current_title ?? ''));
  const [ledgerRefreshKey, setLedgerRefreshKey] = useState(0);

  useEffect(() => {
    const n = Number(memberLevel);
    setCommittedMemberLevel(Number.isFinite(n) ? Math.min(PHYSICAL_AUTONOMY_MAX, Math.max(1, n)) : 1);
  }, [memberLevel, userId]);

  useEffect(() => {
    const nextTitle = String(profile?.current_title ?? '');
    setCommittedTitle(nextTitle);
  }, [profile?.current_title, userId]);

  useEffect(() => {
    if (!userId) {
      setOwnedTitles([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingOwnedTitles(true);
      const { data, error } = await supabase
        .from('member_titles')
        .select('*')
        .eq('user_id', userId)
        .order('granted_at', { ascending: false });
      if (cancelled) return;
      setLoadingOwnedTitles(false);
      if (error) {
        console.error('[MemberStatusTab] member_titles', error);
        setOwnedTitles([]);
        return;
      }
      setOwnedTitles(Array.isArray(data) ? data : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, ledgerRefreshKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingTitleDefinitions(true);
      const { data, error } = await supabase
        .from('title_definitions')
        .select('*')
        .order('id', { ascending: true });
      if (cancelled) return;
      setLoadingTitleDefinitions(false);
      if (error) {
        console.error('[MemberStatusTab] title_definitions', error);
        setTitleDefinitions([]);
        return;
      }
      setTitleDefinitions(Array.isArray(data) ? data : []);
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
    const mainRows = defs.filter((row) => {
      const t = String(row.type ?? row.title_type ?? '').toLowerCase();
      return t === 'main' || row.is_main === true || row.parent_title == null;
    });
    const subRows = defs.filter((row) => {
      const t = String(row.type ?? row.title_type ?? '').toLowerCase();
      return t === 'sub' || row.is_sub === true || row.parent_title != null;
    });
    return mainRows.map((main) => {
      const mainTitle = String(main.title ?? '');
      const subs = subRows.filter((sub) => {
        const parent = String(sub.parent_title ?? sub.main_title ?? '');
        if (!parent) return false;
        return parent === mainTitle;
      });
      return { main, subs };
    });
  }, [titleDefinitions]);

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

  const grantTitle = async () => {
    if (!userId) {
      toast.error('회원 정보가 없습니다.');
      return;
    }
    const title = selectedSubTitle.trim();
    if (!title) {
      toast.error('수여할 서브 칭호를 선택하세요.');
      return;
    }
    setGrantingTitle(true);
    try {
      const { data, error } = await supabase.rpc('admin_grant_title', {
        p_target_user: userId,
        p_title: title,
        p_equip: equipImmediately,
      });
      if (error) throw error;
      if (equipImmediately) {
        setCommittedTitle(title);
      }
      const unlockedMainTitle =
        String(data?.unlocked_main_title || data?.main_title || data?.unlocked_title || '').trim();
      setSelectedSubTitle('');
      setLedgerRefreshKey((k) => k + 1);
      await onRefresh?.();
      toast.success('칭호가 수여되었습니다.');
      if (unlockedMainTitle) {
        window.alert(`[${unlockedMainTitle}] 칭호가 자동으로 해금되었습니다!`);
        toast.success(`[${unlockedMainTitle}] 칭호가 자동으로 해금되었습니다!`);
      }
    } catch (e) {
      console.error('[MemberStatusTab] admin_grant_title', e);
      toast.error(`칭호 수여 실패: ${supabaseErrorMessage(e)}`);
    } finally {
      setGrantingTitle(false);
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
              <label className="mt-3 block text-[11px] text-white/55">서브 칭호 수여</label>
              <select
                value={selectedSubTitle}
                onChange={(e) => setSelectedSubTitle(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 text-sm text-white/90 outline-none ring-emerald-500/25 focus:ring-2"
              >
                <option value="">
                  {loadingTitleDefinitions ? '칭호 목록 불러오는 중...' : '수여할 서브 칭호 선택'}
                </option>
                {titleHierarchy.map(({ main, subs }) => (
                  <optgroup key={main.id} label={String(main.title || '메인 칭호')}>
                    {subs.map((sub) => (
                      <option key={sub.id} value={String(sub.title || '')}>
                        {String(sub.title || '')}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <label className="mt-3 inline-flex items-center gap-2 text-sm text-white/75">
                <input
                  type="checkbox"
                  checked={equipImmediately}
                  onChange={(e) => setEquipImmediately(e.target.checked)}
                  className="h-4 w-4 accent-emerald-500"
                />
                수여와 동시에 대표 칭호로 장착
              </label>
              <button
                type="button"
                disabled={grantingTitle || !selectedSubTitle.trim()}
                onClick={grantTitle}
                className="mt-3 w-full rounded-xl border border-emerald-500/45 bg-emerald-900/30 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-800/35 disabled:opacity-40"
              >
                수여하기
              </button>

              <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-[11px] tracking-[0.14em] text-white/45">보유 칭호 목록</p>
                {loadingOwnedTitles ? (
                  <p className="mt-2 text-sm text-white/40">불러오는 중...</p>
                ) : ownedTitles.length === 0 ? (
                  <p className="mt-2 text-sm text-white/40">보유한 칭호가 없습니다.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {ownedTitles.map((row) => {
                      const title = String(row.title || '');
                      const isEquipped = title !== '' && title === String(committedTitle || '');
                      return (
                        <li key={row.id} className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2 text-sm text-white/80">
                          <span className={isEquipped ? 'text-emerald-300' : ''}>{title || '무제 칭호'}</span>
                          {isEquipped ? <span className="ml-2 text-[10px] text-emerald-300">대표 칭호</span> : null}
                        </li>
                      );
                    })}
                  </ul>
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
