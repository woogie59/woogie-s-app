import React, { useState, useCallback, useMemo } from 'react';
import { X, Plus, Trash2, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useGlobalModal } from '../../context/GlobalModalContext';
import { FOCUS_CHIPS, exercisesForFocus } from '../training/workoutPresets';

const ICON_STROKE = 1.5;

const newRowId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `r-${Date.now()}-${Math.random()}`);

const emptyRow = () => ({
  id: newRowId(),
  exercise: '',
  weight_kg: '',
  reps: '',
  sets: '',
});

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function reportMatchesFocus(row, focus) {
  if (!row || !focus) return false;
  const sf = row.session_focus?.toString() || '';
  if (sf.includes(focus)) return true;
  const lines = row.workout_lines;
  if (!Array.isArray(lines)) return false;
  return lines.some((l) => typeof l === 'object' && l !== null && (l.focus === focus || l.body_part === focus));
}

function workoutLinesFromRows(rows, focus) {
  return rows
    .filter((r) => r.exercise)
    .map((r) => ({
      focus,
      exercise: r.exercise.trim(),
      weight_kg: r.weight_kg === '' ? null : Number(r.weight_kg),
      reps: r.reps === '' ? null : Number(r.reps),
      sets: r.sets === '' ? null : Number(r.sets),
    }));
}

/**
 * @param {{ userId: string; memberName?: string; onClose: () => void; onSaved?: () => void }} props
 */
export default function AdminTrainingReportForm({ userId, memberName, onClose, onSaved }) {
  const { showToast, showAlert } = useGlobalModal();
  const [focus, setFocus] = useState('가슴');
  const [reportDate, setReportDate] = useState(todayYmd);
  const [rows, setRows] = useState(() => [emptyRow()]);
  const [coachComment, setCoachComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingGhost, setLoadingGhost] = useState(false);

  const exerciseOptions = useMemo(() => exercisesForFocus(focus), [focus]);

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (id) => setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));

  const updateRow = (id, patch) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handleFocusChange = (next) => {
    setFocus(next);
    setRows((prev) =>
      prev.map((r) => {
        if (!r.exercise) return r;
        const opts = exercisesForFocus(next);
        return opts.includes(r.exercise) ? r : { ...r, exercise: '' };
      })
    );
  };

  const loadLastRoutine = useCallback(async () => {
    if (!userId) return;
    setLoadingGhost(true);
    try {
      const { data, error } = await supabase
        .from('client_session_reports')
        .select('workout_lines, session_focus, report_date')
        .eq('user_id', userId)
        .order('report_date', { ascending: false })
        .limit(40);

      if (error) throw error;
      const list = Array.isArray(data) ? data : [];
      const hit = list.find((row) => reportMatchesFocus(row, focus));
      if (!hit || !Array.isArray(hit.workout_lines) || hit.workout_lines.length === 0) {
        showToast('해당 부위의 최근 기록이 없습니다');
        return;
      }
      const mapped = hit.workout_lines
        .map((l) => {
          if (typeof l === 'object' && l !== null) {
            return {
              id: newRowId(),
              exercise: (l.exercise || l.name || '').toString(),
              weight_kg: l.weight_kg ?? l.weight ?? '',
              reps: l.reps ?? '',
              sets: l.sets ?? '',
            };
          }
          return null;
        })
        .filter(Boolean);
      if (mapped.length === 0) {
        showToast('불러올 구조화된 루틴이 없습니다');
        return;
      }
      setRows(mapped);
      showToast('루틴을 불러왔습니다');
    } catch (e) {
      console.error('[loadLastRoutine]', e);
      showAlert({ message: '불러오기 실패: ' + (e?.message || '') });
    } finally {
      setLoadingGhost(false);
    }
  }, [userId, focus, showToast, showAlert]);

  const handleSave = async () => {
    const built = workoutLinesFromRows(rows, focus);
    if (built.length === 0) {
      showAlert({ message: '운동을 한 가지 이상 선택해 주세요.' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        user_id: userId,
        report_date: reportDate,
        session_focus: `${focus} 세션`,
        workout_lines: built,
        coach_comment: coachComment.trim(),
      };
      const { error } = await supabase.from('client_session_reports').upsert(payload, {
        onConflict: 'user_id,report_date',
      });
      if (error) throw error;
      showToast('리포트가 저장되었습니다.');
      onSaved?.();
      onClose();
    } catch (e) {
      console.error('[AdminTrainingReportForm save]', e);
      showAlert({ message: '저장 실패: ' + (e?.message || '') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/25 backdrop-blur-[2px]">
      <div
        className="w-full max-w-lg max-h-[min(92dvh,720px)] bg-white rounded-t-3xl sm:rounded-2xl shadow-xl border border-gray-100 flex flex-col font-sans text-slate-900"
        role="dialog"
        aria-labelledby="training-report-title"
      >
        <div className="shrink-0 flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100/90">
          <div>
            <p className="text-[10px] text-gray-400 tracking-[0.22em] uppercase">SESSION_REPORT</p>
            <h2 id="training-report-title" className="text-lg font-semibold text-slate-900 tracking-tight mt-0.5">
              일지 작성
              {memberName ? <span className="font-normal text-gray-500"> · {memberName}</span> : null}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-slate-800 hover:bg-gray-50 transition-colors"
            aria-label="닫기"
          >
            <X size={22} strokeWidth={ICON_STROKE} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-5">
          <div>
            <label className="text-[10px] text-gray-400 tracking-widest uppercase block mb-2">기록일</label>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-[#064e3b]/20"
            />
          </div>

          <div>
            <label className="text-[10px] text-gray-400 tracking-widest uppercase block mb-2">Target Focus</label>
            <div className="flex flex-wrap gap-2">
              {FOCUS_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleFocusChange(chip)}
                  className={`px-3.5 py-2 rounded-full text-xs font-medium tracking-wide transition-all ${
                    focus === chip
                      ? 'bg-[#064e3b] text-white shadow-sm'
                      : 'bg-gray-50 text-gray-600 border border-gray-100 hover:border-gray-200'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={loadLastRoutine}
            disabled={loadingGhost}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border border-[#064e3b]/20 bg-[#064e3b]/[0.04] text-[#064e3b] text-sm font-medium tracking-wide hover:bg-[#064e3b]/10 disabled:opacity-50 transition-colors"
          >
            <Sparkles size={18} strokeWidth={ICON_STROKE} className="shrink-0 opacity-90" aria-hidden />
            {loadingGhost ? '불러오는 중…' : `최근 ${focus} 루틴 불러오기`}
          </button>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] text-gray-400 tracking-widest uppercase">Exercise Matrix</label>
              <button
                type="button"
                onClick={addRow}
                className="text-[11px] text-[#064e3b] font-medium flex items-center gap-1 hover:underline"
              >
                <Plus size={14} strokeWidth={ICON_STROKE} />
                행 추가
              </button>
            </div>
            <div className="space-y-3">
              {rows.map((row, idx) => (
                <div
                  key={row.id}
                  className="rounded-xl border border-gray-100 bg-gray-50/50 p-3 grid grid-cols-1 gap-2 sm:grid-cols-12 sm:gap-2 sm:items-end"
                >
                  <div className="sm:col-span-5">
                    {idx === 0 && (
                      <span className="text-[9px] text-gray-400 uppercase tracking-wider block mb-1">운동</span>
                    )}
                    <select
                      value={row.exercise}
                      onChange={(e) => updateRow(row.id, { exercise: e.target.value })}
                      className="w-full bg-white border border-gray-100 rounded-lg px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-[#064e3b]/20"
                    >
                      <option value="">선택</option>
                      {exerciseOptions.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:col-span-7">
                    <div>
                      {idx === 0 && (
                        <span className="text-[9px] text-gray-400 uppercase tracking-wider block mb-1">kg</span>
                      )}
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.5}
                        placeholder="0"
                        value={row.weight_kg}
                        onChange={(e) => updateRow(row.id, { weight_kg: e.target.value })}
                        className="w-full bg-white border border-gray-100 rounded-lg px-2 py-2.5 text-sm tabular-nums outline-none focus:ring-1 focus:ring-[#064e3b]/20"
                      />
                    </div>
                    <div>
                      {idx === 0 && (
                        <span className="text-[9px] text-gray-400 uppercase tracking-wider block mb-1">reps</span>
                      )}
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        placeholder="0"
                        value={row.reps}
                        onChange={(e) => updateRow(row.id, { reps: e.target.value })}
                        className="w-full bg-white border border-gray-100 rounded-lg px-2 py-2.5 text-sm tabular-nums outline-none focus:ring-1 focus:ring-[#064e3b]/20"
                      />
                    </div>
                    <div className="flex gap-1">
                      <div className="flex-1 min-w-0">
                        {idx === 0 && (
                          <span className="text-[9px] text-gray-400 uppercase tracking-wider block mb-1">sets</span>
                        )}
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          placeholder="0"
                          value={row.sets}
                          onChange={(e) => updateRow(row.id, { sets: e.target.value })}
                          className="w-full bg-white border border-gray-100 rounded-lg px-2 py-2.5 text-sm tabular-nums outline-none focus:ring-1 focus:ring-[#064e3b]/20"
                        />
                      </div>
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          className="self-end p-2 text-gray-300 hover:text-red-500 rounded-lg shrink-0"
                          aria-label="행 삭제"
                        >
                          <Trash2 size={18} strokeWidth={ICON_STROKE} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-gray-400 tracking-widest uppercase block mb-2">Coach Note</label>
            <textarea
              value={coachComment}
              onChange={(e) => setCoachComment(e.target.value)}
              rows={4}
              placeholder="오늘 세션에 대한 코멘트를 남겨주세요."
              className="w-full bg-gray-50 border-0 p-4 rounded-xl text-sm text-slate-800 placeholder:text-gray-400 outline-none focus:ring-1 focus:ring-[#064e3b]/15 resize-none"
            />
          </div>
        </div>

        <div className="shrink-0 px-5 py-4 border-t border-gray-100 flex gap-3 pb-safe">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-[1.4] py-3.5 rounded-xl text-sm font-semibold bg-[#064e3b] text-white hover:bg-[#053d2f] disabled:opacity-50 transition-colors"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
