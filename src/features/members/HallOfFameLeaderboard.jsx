import React, { useEffect, useState, useCallback } from 'react';
import { X, Trophy, Crown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

function tierLabel(level) {
  const lv = Number(level) || 1;
  if (lv <= 1) return '초심자';
  if (lv <= 4) return '수행자';
  if (lv <= 7) return '숙련자';
  if (lv <= 9) return '엘리트';
  return '챌린저';
}

function maskName(name) {
  const trimmed = String(name || '?').trim();
  if (!trimmed) return '?**';
  return trimmed.charAt(0) + '**';
}

const TIER_COLOR = {
  초심자: 'text-zinc-300',
  수행자: 'text-amber-400',
  숙련자: 'text-slate-300',
  엘리트: 'text-yellow-300',
  챌린저: 'text-red-400',
  MASTER: 'text-purple-400',
};

const RANK_BADGE = {
  1: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/40',
  2: 'bg-slate-400/20 text-slate-300 border-slate-400/40',
  3: 'bg-amber-600/20 text-amber-400 border-amber-600/40',
};

export default function HallOfFameLeaderboard({ isOpen, onClose }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profilesRes, mastersRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, name, member_level, current_title')
          .eq('is_athlete_system_enabled', true),
        supabase
          .from('master_exam_requests')
          .select('user_id')
          .eq('status', 'approved'),
      ]);

      if (profilesRes.error) throw profilesRes.error;

      const approvedMasterIds = new Set(
        (mastersRes.data || []).map((r) => r.user_id)
      );

      const sorted = (profilesRes.data || [])
        .map((p) => ({
          ...p,
          isMaster: approvedMasterIds.has(p.id),
          level: Number(p.member_level) || 1,
        }))
        .sort((a, b) => {
          if (a.isMaster !== b.isMaster) return a.isMaster ? -1 : 1;
          return b.level - a.level;
        });

      setEntries(sorted);
    } catch (e) {
      console.error('[HallOfFameLeaderboard]', e);
      setError('데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchLeaderboard();
  }, [isOpen, fetchLeaderboard]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#050505] font-sans text-white animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-label="명예의 전당"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#050505]/90 px-5 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <Trophy className="h-4 w-4 text-purple-400" strokeWidth={1.5} />
          <span className="text-sm font-bold tracking-[0.14em] text-white">명예의 전당</span>
          <span className="ml-1 text-[10px] uppercase tracking-widest text-zinc-500">Hall of Fame</span>
        </div>
        <button
          type="button"
          aria-label="닫기"
          onClick={onClose}
          className="rounded-full p-1.5 text-zinc-500 transition hover:text-white"
        >
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>

      {/* Notice */}
      <div className="px-5 pb-0 pt-4">
        <p className="text-center text-[10px] tracking-widest text-zinc-600 uppercase">
          이름은 익명으로 표시됩니다
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-12 pt-4">
        {loading && (
          <div className="flex items-center justify-center py-24">
            <p className="text-sm text-zinc-500 tracking-wide">불러오는 중...</p>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center gap-3 py-24">
            <p className="text-sm text-red-400">{error}</p>
            <button
              type="button"
              onClick={fetchLeaderboard}
              className="rounded-lg border border-white/10 px-4 py-2 text-xs text-zinc-300 transition hover:bg-white/5"
            >
              다시 시도
            </button>
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="flex items-center justify-center py-24">
            <p className="text-sm text-zinc-500">등록된 아틀리트가 없습니다.</p>
          </div>
        )}

        {!loading && !error && entries.length > 0 && (
          <ol className="space-y-2">
            {entries.map((entry, idx) => {
              const rank = idx + 1;
              const tier = entry.isMaster ? 'MASTER' : tierLabel(entry.level);
              const colorClass = TIER_COLOR[tier] ?? 'text-zinc-300';
              const badgeClass = RANK_BADGE[rank] ?? 'bg-white/5 text-zinc-500 border-white/10';

              return (
                <li
                  key={entry.id}
                  className={`flex items-center gap-4 rounded-2xl border px-4 py-3.5 transition ${
                    entry.isMaster
                      ? 'border-purple-500/25 bg-purple-900/10'
                      : rank <= 3
                        ? 'border-white/10 bg-white/[0.03]'
                        : 'border-white/5 bg-white/[0.015]'
                  }`}
                >
                  {/* Rank badge */}
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${badgeClass}`}
                  >
                    {rank <= 3 ? (
                      rank === 1 ? <Crown className="h-3.5 w-3.5" strokeWidth={2} /> : rank
                    ) : (
                      rank
                    )}
                  </span>

                  {/* Name + tier + title */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold tracking-wide text-white">
                        {maskName(entry.name)}
                      </span>
                      <span className={`text-[11px] font-bold tracking-widest uppercase ${colorClass}`}>
                        {entry.isMaster ? 'MASTER' : `LV.${entry.level}`}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="text-[11px] text-zinc-500">{tier}</span>
                      {String(entry.current_title || '').trim() ? (
                        <>
                          <span className="text-zinc-700">·</span>
                          <span className="truncate text-[11px] text-zinc-400">
                            「{String(entry.current_title).trim()}」
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {/* Master crown indicator */}
                  {entry.isMaster && (
                    <ChevronUp className="h-4 w-4 shrink-0 text-purple-400 opacity-70" strokeWidth={2} />
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
