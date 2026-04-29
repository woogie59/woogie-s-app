import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import {
  computeRemainingSessions,
  countCompletedAttendanceLogs,
  sumTotalPurchasedFromBatches,
} from '../../utils/sessionHelpers';

const DAY_NAMES_KO = ['일', '월', '화', '수', '목', '금', '토'];

const getMondayOfWeek = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const getWeekLabelKo = (weekIndex) => {
  if (weekIndex === 0) return '이번 주';
  if (weekIndex === 1) return '지난 주';
  return `${weekIndex}주 전`;
};

const formatSessionDate = (checkInAt) => {
  const d = new Date(checkInAt);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const dayName = DAY_NAMES_KO[d.getDay()];
  const time = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${y}.${m}.${day} (${dayName}) ${time}`;
};

const SessionHistoryModal = ({ user, onClose }) => {
  const [logs, setLogs] = useState([]);
  const [sessionBatches, setSessionBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const fetchData = async () => {
      setLoading(true);
      const [logsRes, batchesRes] = await Promise.all([
        supabase
          .from('attendance_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('check_in_at', { ascending: false }),
        supabase.from('session_batches').select('total_count').eq('user_id', user.id),
      ]);

      if (logsRes.error) {
        console.error('SessionHistoryModal fetch error:', logsRes.error);
        setLogs([]);
      } else {
        setLogs(logsRes.data || []);
      }
      setSessionBatches(batchesRes.error ? [] : batchesRes.data || []);
      setLoading(false);
    };

    fetchData();
  }, [user?.id]);

  const totalPurchased = sumTotalPurchasedFromBatches(sessionBatches);
  const sessionUsedCount = countCompletedAttendanceLogs(logs);
  const remainingCount = computeRemainingSessions(totalPurchased, sessionUsedCount);
  const totalCount = totalPurchased;
  const usedCount = sessionUsedCount;
  const progressPercentage = totalCount > 0 ? (usedCount / totalCount) * 100 : 0;

  const { weeklyData, maxCount } = useMemo(() => {
    const now = new Date();
    const weeks = [];
    for (let i = 0; i < 5; i++) {
      const monday = getMondayOfWeek(now);
      monday.setDate(monday.getDate() - i * 7);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const count = logs.filter((log) => {
        const t = new Date(log.check_in_at);
        return t >= monday && t <= sunday;
      }).length;

      weeks.push({
        label: getWeekLabelKo(i),
        count,
        isThisWeek: i === 0,
      });
    }
    const maxC = Math.max(1, ...weeks.map((w) => w.count));
    return { weeklyData: weeks, maxCount: maxC };
  }, [logs]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-8 bg-black/25"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="bg-white w-full max-w-md max-h-[88vh] flex flex-col sm:max-h-[85vh] sm:rounded-2xl shadow-2xl shadow-black/10"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 pt-8 pb-6 shrink-0">
            <h3 className="text-[18px] font-semibold tracking-tight text-neutral-950">멤버십 현황</h3>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-900 transition-colors"
              aria-label="닫기"
            >
              <X size={20} strokeWidth={1.5} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-10 space-y-10">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="h-px w-8 bg-neutral-900/20 animate-pulse" aria-hidden />
              </div>
            ) : (
              <>
                <section className="space-y-5">
                  <div>
                    <div className="mb-2 flex items-end justify-between">
                      <p className="text-[11px] tracking-[0.15em] text-neutral-500 font-medium">진행률</p>
                      <p className="text-sm font-medium text-neutral-600 tabular-nums">{Math.round(progressPercentage)}%</p>
                    </div>
                    <div className="h-2.5 bg-neutral-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercentage}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        className="h-full bg-[#064e3b]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-2xl border border-neutral-100 bg-neutral-50/70 px-3 py-4">
                      <p className="text-[10px] font-medium tracking-[0.14em] text-neutral-500 mb-2">총 횟수</p>
                      <p className="text-3xl font-semibold tabular-nums text-neutral-950 leading-none">{totalCount.toLocaleString()}</p>
                    </div>
                    <div className="rounded-2xl border border-neutral-100 bg-neutral-50/70 px-3 py-4">
                      <p className="text-[10px] font-medium tracking-[0.14em] text-neutral-500 mb-2">진행</p>
                      <p className="text-3xl font-semibold tabular-nums text-neutral-950 leading-none">{usedCount.toLocaleString()}</p>
                    </div>
                    <div className="rounded-2xl border border-[#064e3b]/20 bg-[#064e3b]/5 px-3 py-4">
                      <p className="text-[10px] font-medium tracking-[0.14em] text-[#064e3b]/80 mb-2">잔여</p>
                      <p className="text-3xl font-semibold tabular-nums text-[#064e3b] leading-none">{remainingCount.toLocaleString()}</p>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-neutral-100 bg-neutral-50/60 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-[11px] font-medium tracking-[0.16em] text-neutral-500">주간 출석</p>
                    <p className="text-xs text-neutral-400">최근 5주</p>
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    {weeklyData.map((week, i) => {
                      const barHeight = maxCount > 0 ? (week.count / maxCount) * 56 : 0;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-2.5 min-w-0">
                          <div className="w-full h-14 flex flex-col justify-end items-center">
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: barHeight }}
                              transition={{ delay: i * 0.04, duration: 0.35, ease: 'easeOut' }}
                              className={`w-full max-w-[34px] rounded-sm ${
                                week.isThisWeek ? 'bg-[#064e3b]' : 'bg-neutral-300'
                              }`}
                              style={{ minHeight: week.count > 0 ? 4 : 0 }}
                            />
                          </div>
                          <span className="text-[11px] tabular-nums text-neutral-700 font-medium">{week.count}</span>
                          <span
                            className={`text-[10px] text-center leading-tight w-full truncate ${
                              week.isThisWeek ? 'text-[#064e3b] font-medium' : 'text-neutral-500'
                            }`}
                          >
                            {week.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section>
                  <p className="text-[10px] font-medium tracking-[0.18em] text-neutral-500 mb-6">상세 기록</p>
                  {logs.length === 0 ? (
                    <p className="text-[13px] text-neutral-400 py-4">아직 진행된 수업이 없습니다.</p>
                  ) : (
                    <ul className="divide-y divide-neutral-100">
                      {logs.map((log) => (
                        <li key={log.id} className="flex items-center justify-between gap-6 py-3.5 first:pt-0">
                          <span className="text-[13px] text-neutral-900 leading-snug">
                            {formatSessionDate(log.check_in_at)}
                          </span>
                          <span className="text-neutral-300/90 text-[11px] font-extralight shrink-0" aria-hidden>
                            ✓
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SessionHistoryModal;
