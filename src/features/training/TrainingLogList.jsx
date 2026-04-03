import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import BackButton from '../../components/ui/BackButton';
import { deriveSessionFocus, formatKoreanDateFromYmd } from './trainingLogUtils';

const ICON_STROKE = 1.5;

export default function TrainingLogList({ user, setView, goBack, onOpenDetail }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('client_session_reports')
        .select('id, report_date, session_focus, workout_lines')
        .eq('user_id', user.id)
        .order('report_date', { ascending: false });
      if (cancelled) return;
      if (error) {
        console.warn('[TrainingLogList]', error);
        setRows([]);
      } else {
        setRows(Array.isArray(data) ? data : []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22 }}
      className="min-h-[100dvh] bg-gray-50 text-slate-900 flex flex-col font-sans pb-safe"
    >
      <header className="shrink-0 px-5 pt-5 pb-4 border-b border-gray-100/90 bg-gray-50">
        <BackButton onClick={goBack} label="Home" />
        <p className="text-[10px] tracking-[0.24em] uppercase text-gray-400 font-medium mt-4">Archive</p>
        <h1 className="text-xl font-light text-slate-900 tracking-tight mt-1">트레이닝 일지</h1>
      </header>

      <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4">
        {loading ? (
          <p className="text-sm text-gray-400 font-light py-12 text-center">불러오는 중…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-400 font-light py-12 text-center leading-relaxed">
            등록된 세션 기록이 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100/90 border-t border-b border-gray-100/90 bg-white rounded-2xl overflow-hidden shadow-sm">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => onOpenDetail(row.id)}
                  className="w-full flex items-center justify-between gap-4 px-4 py-4 text-left hover:bg-gray-50/80 active:bg-gray-100/60 transition-colors"
                >
                  <span className="text-[13px] text-gray-500 font-light tabular-nums shrink-0 w-[5.5rem]">
                    {formatKoreanDateFromYmd(row.report_date)}
                  </span>
                  <span className="flex-1 text-[14px] font-medium text-slate-900 tracking-tight min-w-0">
                    {deriveSessionFocus(row)}
                  </span>
                  <ChevronRight size={18} strokeWidth={ICON_STROKE} className="text-gray-300 shrink-0" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  );
}
