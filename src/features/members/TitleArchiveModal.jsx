import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Info } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

function normalizeTitleName(v) {
  return String(v || '').trim();
}

function resolveTitleType(defRow, ownedRow) {
  const explicit = String(
    defRow?.slot ?? defRow?.type ?? defRow?.title_type ?? ownedRow?.slot ?? ownedRow?.type ?? ownedRow?.title_type ?? ''
  )
    .toLowerCase()
    .trim();
  if (explicit.includes('main') || explicit === '대표' || explicit === '메인') return 'main';
  if (explicit.includes('sub') || explicit === '서브') return 'sub';
  const parent = normalizeTitleName(defRow?.parent_title);
  return parent ? 'sub' : 'main';
}

export default function TitleArchiveModal({
  isOpen,
  onClose,
  memberId,
  acquiredTitles = [],
  onRepresentativeChange,
}) {
  const [titleDefinitions, setTitleDefinitions] = useState([]);
  const [representativeTitleId, setRepresentativeTitleId] = useState(null);
  const [representativeTitleName, setRepresentativeTitleName] = useState('');
  const [loading, setLoading] = useState(false);
  const [settingId, setSettingId] = useState(null);
  const [expandedMainTitle, setExpandedMainTitle] = useState('');
  const [infoTitle, setInfoTitle] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !memberId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setExpandedMainTitle('');
      const [defsRes, profileRes] = await Promise.all([
        supabase.from('title_definitions').select('*').order('id', { ascending: true }),
        supabase.from('profiles').select('representative_title_id,current_title').eq('id', memberId).maybeSingle(),
      ]);
      if (cancelled) return;
      if (defsRes.error) {
        console.error('[TitleArchiveModal] title_definitions', defsRes.error);
        setTitleDefinitions([]);
      } else {
        setTitleDefinitions(Array.isArray(defsRes.data) ? defsRes.data : []);
      }
      if (profileRes.error) {
        console.error('[TitleArchiveModal] profile', profileRes.error);
        setRepresentativeTitleId(null);
        setRepresentativeTitleName('');
      } else {
        setRepresentativeTitleId(profileRes.data?.representative_title_id ?? null);
        setRepresentativeTitleName(normalizeTitleName(profileRes.data?.current_title));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, memberId]);

  const ownedTitleNames = useMemo(() => {
    const rows = Array.isArray(acquiredTitles) ? acquiredTitles : [];
    return new Set(rows.map((row) => normalizeTitleName(row?.title ?? row?.name)).filter(Boolean));
  }, [acquiredTitles]);

  const groupedMainTitles = useMemo(() => {
    const defsByName = new Map(
      (titleDefinitions || []).map((d) => [normalizeTitleName(d?.title ?? d?.name), d]).filter(([k]) => Boolean(k))
    );
    const mainDefs = (titleDefinitions || []).filter((d) => resolveTitleType(d, null) === 'main');
    const subDefs = (titleDefinitions || []).filter((d) => resolveTitleType(d, null) === 'sub');
    const mains = [];
    mainDefs.forEach((mainDef) => {
      const mainName = normalizeTitleName(mainDef?.title ?? mainDef?.name);
      if (!mainName) return;
      const subRows = subDefs
        .filter((sub) => normalizeTitleName(sub?.parent_title) === mainName)
        .filter((sub) => ownedTitleNames.has(normalizeTitleName(sub?.title ?? sub?.name)))
        .map((sub) => ({
          id: sub?.id ?? normalizeTitleName(sub?.title ?? sub?.name),
          name: normalizeTitleName(sub?.title ?? sub?.name),
        }));
      const hasMain = ownedTitleNames.has(mainName);
      if (!hasMain && subRows.length === 0) return;
      mains.push({
        id: mainDef?.id ?? mainName,
        name: mainName,
        description: String(mainDef?.description || '').trim(),
        subTitles: subRows,
      });
    });

    // fallback for titles without definition rows
    ownedTitleNames.forEach((ownedName) => {
      if (defsByName.has(ownedName)) return;
      if (mains.some((m) => m.name === ownedName)) return;
      mains.push({ id: ownedName, name: ownedName, description: '', subTitles: [] });
    });

    return mains;
  }, [acquiredTitles, ownedTitleNames, titleDefinitions]);

  const isRepresentative = (titleRow) => {
    if (representativeTitleId != null && titleRow.id != null) return String(titleRow.id) === String(representativeTitleId);
    return normalizeTitleName(titleRow.name) === normalizeTitleName(representativeTitleName);
  };

  const setRepresentative = async (titleRow) => {
    if (!memberId || !titleRow) return;
    setSettingId(titleRow.id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ representative_title_id: titleRow.id, current_title: titleRow.name })
        .eq('id', memberId);
      if (error) {
        const code = String(error.code || '');
        const msg = String(error.message || '').toLowerCase();
        if (code === '23505' || msg.includes('unique')) {
          toast.error('대표 칭호 설정이 충돌했습니다. 다시 시도해 주세요.');
          return;
        }
        if (code === '42703' || msg.includes('representative_title_id')) {
          const rpcRes = await supabase.rpc('equip_member_title', {
            p_target_user: memberId,
            p_title: titleRow.name,
          });
          if (rpcRes.error) throw rpcRes.error;
          setRepresentativeTitleName(titleRow.name);
          onRepresentativeChange?.({ id: titleRow.id, title: titleRow.name });
          toast.success('대표 칭호가 변경되었습니다.');
          return;
        }
        throw error;
      }
      setRepresentativeTitleId(titleRow.id);
      setRepresentativeTitleName(titleRow.name);
      onRepresentativeChange?.({ id: titleRow.id, title: titleRow.name });
      toast.success('대표 칭호가 변경되었습니다.');
    } catch (e) {
      console.error('[TitleArchiveModal] set representative', e);
      toast.error(`대표 칭호 설정 실패: ${e?.message || String(e)}`);
    } finally {
      setSettingId(null);
    }
  };

  if (!isOpen) return null;

  const renderMainList = () => (
    <section className="mt-6">
      {groupedMainTitles.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-black/50 p-3 text-xs text-zinc-500">획득한 칭호가 없습니다.</p>
      ) : (
        <div className="space-y-4">
          {groupedMainTitles.map((main) => {
            const active = isRepresentative(main);
            const pending = String(settingId) === String(main.id);
            const expanded = expandedMainTitle === main.name;
            return (
              <div key={main.id} className="rounded-xl border border-white/10 bg-black/45 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedMainTitle((prev) => (prev === main.name ? '' : main.name))}
                      className="rounded-lg border border-amethyst bg-purple-900/20 px-4 py-2 text-left text-sm font-semibold text-amethyst transition hover:bg-purple-800/25"
                    >
                      {main.name}
                    </button>
                    <button
                      type="button"
                      aria-label={`${main.name} 설명`}
                      onClick={() => setInfoTitle({ name: main.name, description: String(main.description || '').trim() })}
                      className="rounded-full p-1 transition hover:bg-white/5"
                    >
                      <Info size={14} className="ml-0 text-zinc-500" />
                    </button>
                  </div>
                  {active ? (
                    <div className="text-xs font-semibold text-amethyst">대표</div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRepresentative(main)}
                      disabled={pending || settingId !== null}
                      className="text-xs text-zinc-400 transition hover:text-white disabled:opacity-50"
                    >
                      {pending ? '설정 중...' : '[ 대표로 설정 ]'}
                    </button>
                  )}
                </div>
                {expanded ? (
                  <div className="mt-3 space-y-2">
                    {main.subTitles.length === 0 ? (
                      <p className="text-xs text-zinc-500">연결된 서브 칭호가 없습니다.</p>
                    ) : (
                      main.subTitles.map((sub) => (
                        <div key={sub.id} className="rounded-md bg-zinc-900 px-3 py-1 text-sm text-zinc-400">
                          {sub.name}
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="획득한 칭호 아카이브"
      onClick={onClose}
    >
      <div
        className="max-h-[min(88dvh,700px)] w-full max-w-[420px] overflow-y-auto rounded-2xl border border-white/10 bg-[#050505] p-6 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.85)]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.28em] text-white/40">획득한 칭호 - 아카이브</p>
        {loading ? (
          <p className="py-10 text-center text-sm text-zinc-500">칭호를 불러오는 중...</p>
        ) : renderMainList()}
        <button
          type="button"
          onClick={onClose}
          className="mt-8 w-full rounded-xl border border-white/15 bg-white/5 py-3 text-center text-sm font-semibold tracking-wide text-zinc-200 transition hover:border-white/25 hover:bg-white/10"
        >
          [ 닫기 ]
        </button>
      </div>
      {infoTitle ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="칭호 설명"
          onClick={() => setInfoTitle(null)}
        >
          <div
            className="w-full max-w-[320px] rounded-xl border border-white/10 bg-[#050505] p-4 shadow-[0_20px_60px_-12px_rgba(0,0,0,0.85)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-semibold tracking-wide text-amethyst">{infoTitle.name}</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              {String(infoTitle.description || '').trim() || '설명이 없습니다.'}
            </p>
            <button
              type="button"
              onClick={() => setInfoTitle(null)}
              className="mt-4 w-full rounded-lg border border-white/15 bg-white/5 py-2 text-sm font-semibold text-zinc-200 transition hover:border-white/25 hover:bg-white/10"
            >
              닫기
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
