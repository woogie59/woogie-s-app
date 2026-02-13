import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const DAY_NAMES_KO = ['일', '월', '화', '수', '목', '금', '토'];

const getMondayOfWeek = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const getWeekLabel = (weekIndex) => {
  if (weekIndex === 0) return 'This Week';
  if (weekIndex === 1) return 'Last Week';
  return `${weekIndex} Weeks Ago`;
};

const formatSessionDate = (checkInAt) => {
  const d = new Date(checkInAt);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const dayName = DAY_NAMES_KO[d.getDay()];
  const time = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${y}.${m}.${day} (${dayName}) - ${time}`;
};

const SessionHistoryModal = ({ user, onClose }) => {
  const [logs, setLogs] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const fetchData = async () => {
      setLoading(true);
      const [logsRes, profileRes] = await Promise.all([
        supabase
          .from('attendance_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('check_in_at', { ascending: false }),
        supabase.from('profiles').select('remaining_sessions').eq('id', user.id).single(),
      ]);

      if (logsRes.error) {
        console.error('SessionHistoryModal fetch error:', logsRes.error);
        setLogs([]);
      } else {
        setLogs(logsRes.data || []);
      }
      setProfile(profileRes.data ?? null);
      setLoading(false);
    };

    fetchData();
  }, [user?.id]);

  const usedCount = logs.length;
  const remainingCount = profile?.remaining_sessions ?? user?.remaining_sessions ?? 0;
  const totalCount = usedCount + remainingCount;
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
        label: getWeekLabel(i),
        count,
        isThisWeek: i === 0,
      });
    }
    const maxCount = Math.max(1, ...weeks.map((w) => w.count));
    return { weeklyData: weeks, maxCount };
  }, [logs]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6 bg-black/90"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="bg-zinc-900 border-t sm:border border-zinc-700 sm:rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-700/50 shrink-0">
            <h3 className="text-lg font-serif tracking-wide text-yellow-500">MY JOURNEY</h3>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
              aria-label="Close"
            >
              <X size={22} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Session Summary Card */}
                <div className="bg-zinc-800/50 rounded-2xl p-6 mb-6">
                  <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercentage}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className="h-full bg-yellow-500 rounded-full"
                    />
                  </div>
                  <div className="flex justify-between mt-4">
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wider">TOTAL</p>
                      <p className="text-xl text-white font-medium">{totalCount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wider">DONE</p>
                      <p className="text-xl text-white font-medium">{usedCount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-yellow-500/80 uppercase tracking-wider">LEFT</p>
                      <p className="text-xl text-yellow-500 font-bold">{remainingCount.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Weekly Bar Chart */}
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">Weekly Rhythm</p>
                  <div className="flex items-end justify-between gap-3">
                    {weeklyData.map((week, i) => {
                      const barHeight = maxCount > 0 ? (week.count / maxCount) * 72 : 0;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-2 min-w-0">
                          <div className="w-full h-20 flex flex-col justify-end items-center">
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: barHeight }}
                              transition={{ delay: i * 0.05, duration: 0.4, ease: 'easeOut' }}
                              className={`w-full max-w-[44px] rounded-t ${
                                week.isThisWeek ? 'bg-yellow-500' : 'bg-zinc-600'
                              }`}
                              style={{ minHeight: week.count > 0 ? 4 : 0 }}
                            />
                          </div>
                          <span className="text-[10px] font-medium text-zinc-500">{week.count}</span>
                          <span
                            className={`text-[10px] truncate w-full text-center ${
                              week.isThisWeek ? 'text-yellow-500 font-bold' : 'text-zinc-500'
                            }`}
                          >
                            {week.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* History List */}
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">Session History</p>
                  <div className="bg-zinc-950/80 rounded-xl border border-zinc-800 overflow-hidden font-mono text-sm">
                    {logs.length === 0 ? (
                      <div className="px-4 py-8 text-center text-zinc-500 text-xs">
                        No sessions yet
                      </div>
                    ) : (
                      <div className="divide-y divide-zinc-800">
                        {logs.map((log) => (
                          <div
                            key={log.id}
                            className="px-4 py-3 flex items-center justify-between text-zinc-300 hover:bg-zinc-800/50 transition-colors"
                          >
                            <span>{formatSessionDate(log.check_in_at)}</span>
                            <span className="text-yellow-500/80 text-xs">✓</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SessionHistoryModal;
