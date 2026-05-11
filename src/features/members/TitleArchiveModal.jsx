import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
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

export default function TitleArchiveModal({ isOpen, onClose, memberId, acquiredTitles = [] }) {
  const [titleDefinitions, setTitleDefinitions] = useState([]);
  const [representativeTitleId, setRepresentativeTitleId] = useState(null);
  const [representativeTitleName, setRepresentativeTitleName] = useState('');
  const [loading, setLoading] = useState(false);
  const [settingId, setSettingId] = useState(null);

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

  const normalizedTitles = useMemo(() => {
    const defsByName = new Map(
      (titleDefinitions || []).map((d) => [normalizeTitleName(d?.title ?? d?.name), d]).filter(([k]) => Boolean(k))
    );
    const rows = Array.isArray(acquiredTitles) ? acquiredTitles : [];
    const dedup = new Map();
    rows.forEach((row) => {
      const name = normalizeTitleName(row?.title ?? row?.name);
      if (!name) return;
      if (!dedup.has(name)) dedup.set(name, row);
    });
    return [...dedup.entries()].map(([name, ownedRow]) => {
      const def = defsByName.get(name);
      return {
        id: def?.id ?? ownedRow?.id ?? name,
        name,
        type: resolveTitleType(def, ownedRow),
      };
    });
  }, [acquiredTitles, titleDefinitions]);

  const mainTitles = normalizedTitles.filter((t) => t.type === 'main');
  const subTitles = normalizedTitles.filter((t) => t.type === 'sub');

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
          toast.success('대표 칭호가 변경되었습니다.');
          return;
        }
        throw error;
      }
      setRepresentativeTitleId(titleRow.id);
      setRepresentativeTitleName(titleRow.name);
      toast.success('대표 칭호가 변경되었습니다.');
    } catch (e) {
      console.error('[TitleArchiveModal] set representative', e);
      toast.error(`대표 칭호 설정 실패: ${e?.message || String(e)}`);
    } finally {
      setSettingId(null);
    }
  };

  if (!isOpen) return null;

  const renderSection = (label, rows) => (
    <section className="mt-6">
      <p className="mb-3 mt-6 text-sm font-semibold tracking-[0.2em] text-purple-400/70">{label}</p>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-black/50 p-3 text-xs text-zinc-500">획득한 칭호가 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((titleRow) => {
            const active = isRepresentative(titleRow);
            const pending = String(settingId) === String(titleRow.id);
            return (
              <div key={titleRow.id} className="flex items-center justify-between rounded-xl bg-black/50 p-3">
                <span className="rounded-full border border-zinc-400/70 bg-gradient-to-r from-zinc-700/80 to-zinc-500/60 px-3 py-1.5 text-xs font-semibold text-zinc-100">
                  {titleRow.name}
                </span>
                {active ? (
                  <div className="text-xs font-semibold text-amethyst">대표</div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRepresentative(titleRow)}
                    disabled={pending || settingId !== null}
                    className="text-xs text-zinc-400 transition hover:text-white disabled:opacity-50"
                  >
                    {pending ? '설정 중...' : '[ 대표로 설정 ]'}
                  </button>
                )}
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
        ) : (
          <>
            {renderSection('메인 칭호', mainTitles)}
            {renderSection('서브 칭호', subTitles)}
          </>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-8 w-full rounded-xl border border-white/15 bg-white/5 py-3 text-center text-sm font-semibold tracking-wide text-zinc-200 transition hover:border-white/25 hover:bg-white/10"
        >
          [ 닫기 ]
        </button>
      </div>
    </div>
  );
}
