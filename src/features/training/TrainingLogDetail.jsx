import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabaseClient';
import BackButton from '../../components/ui/BackButton';
import { deriveSessionFocus, formatKoreanDateFromYmd, parseWorkoutLineParts } from './trainingLogUtils';

export default function TrainingLogDetail({ user, reportId, onBack }) {
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.id || !reportId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from('client_session_reports')
        .select('id, report_date, session_focus, workout_lines, coach_comment')
        .eq('id', reportId)
        .eq('user_id', user.id)
        .single();
      if (cancelled) return;
      if (err) {
        setError(err.message);
        setRow(null);
      } else {
        setRow(data);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, reportId]);

  const lines = Array.isArray(row?.workout_lines) ? row.workout_lines.map((x) => String(x).trim()).filter(Boolean) : [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22 }}
      className="min-h-[100dvh] bg-gray-50 text-slate-900 flex flex-col font-sans pb-safe"
    >
      <header className="shrink-0 px-5 pt-5 pb-4 border-b border-gray-100/90 bg-gray-50">
        <BackButton onClick={onBack} label="목록" />
      </header>

      <div className="flex-1 overflow-y-auto min-h-0 px-5 py-6">
        {loading ? (
          <p className="text-sm text-gray-400 font-light py-12 text-center">불러오는 중…</p>
        ) : error || !row ? (
          <p className="text-sm text-gray-500 font-light py-12 text-center">{error || '기록을 찾을 수 없습니다.'}</p>
        ) : (
          <>
            <p className="text-[11px] text-gray-500 font-light tabular-nums mb-2">{formatKoreanDateFromYmd(row.report_date)}</p>
            <h1 className="text-[22px] sm:text-2xl font-semibold text-slate-900 tracking-tight leading-snug mb-8">
              {deriveSessionFocus(row)}
            </h1>

            <section className="mb-8" aria-label="운동 기록">
              <p className="text-[10px] tracking-[0.2em] uppercase text-gray-400 font-medium mb-3">Session Matrix</p>
              <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                {lines.length === 0 ? (
                  <p className="text-sm text-gray-400 font-light p-5">등록된 운동 항목이 없습니다.</p>
                ) : (
                  <table className="w-full text-left text-[13px] sm:text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/90 text-[10px] uppercase tracking-[0.15em] text-gray-400">
                        <th className="px-4 py-2.5 font-medium w-[38%]">운동</th>
                        <th className="px-4 py-2.5 font-medium">상세</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, idx) => {
                        const { label, detail } = parseWorkoutLineParts(line);
                        return (
                          <tr key={idx} className="border-b border-gray-100/80 last:border-0">
                            <td className="px-4 py-3 text-slate-800 font-medium align-top">{label}</td>
                            <td className="px-4 py-3 text-gray-600 font-light align-top tabular-nums">{detail || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            <section
              className="bg-gray-50 rounded-xl p-4 border-l-2 border-[#064e3b]"
              aria-label="코치 코멘트"
            >
              <p className="text-[10px] tracking-[0.18em] uppercase text-gray-400 font-medium mb-2">Coach&apos;s Comment</p>
              <p className="text-sm text-slate-700 leading-relaxed font-light tracking-wide whitespace-pre-line">
                {(row.coach_comment && row.coach_comment.trim()) || '코멘트가 아직 없습니다.'}
              </p>
            </section>
          </>
        )}
      </div>
    </motion.div>
  );
}
