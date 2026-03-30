import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useGlobalModal } from '../../context/GlobalModalContext';
import BackButton from '../../components/ui/BackButton';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const DEFAULT_START = '09:00';
const DEFAULT_END = '22:00';

const AdminSettings = ({ setView }) => {
  const { showAlert } = useGlobalModal();
  const [settings, setSettings] = useState(() =>
    Array.from({ length: 7 }, (_, d) => ({
      day_of_week: d,
      off: d === 0,
      start_time: DEFAULT_START,
      end_time: DEFAULT_END,
      break_times: [],
    }))
  );
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newOffDay, setNewOffDay] = useState(1);
  const [newOffStart, setNewOffStart] = useState('12:00');
  const [newOffEnd, setNewOffEnd] = useState('13:00');

  const fetchData = async () => {
    setLoading(true);
    const { data: sett, error: e1 } = await supabase.from('trainer_settings').select('*').order('day_of_week');
    const { data: hols, error: e2 } = await supabase.from('trainer_holidays').select('*').order('date', { ascending: false });
    if (!e1 && sett && sett.length) {
      const arr = Array.from({ length: 7 }, (_, d) => {
        const row = sett.find((s) => s.day_of_week === d);
        return row
          ? {
              day_of_week: d,
              off: !!row.off,
              start_time: (row.start_time || DEFAULT_START).toString().slice(0, 5),
              end_time: (row.end_time || DEFAULT_END).toString().slice(0, 5),
              break_times: Array.isArray(row.break_times) ? row.break_times : [],
            }
          : { day_of_week: d, off: d === 0, start_time: DEFAULT_START, end_time: DEFAULT_END, break_times: [] };
      });
      setSettings(arr);
    }
    setHolidays(e2 ? [] : hols || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);
  useEffect(() => {
    if (saveToast) {
      const t = setTimeout(() => setSaveToast(false), 2500);
      return () => clearTimeout(t);
    }
  }, [saveToast]);

  const updateDay = (dow, fn) => {
    setSettings((prev) => prev.map((s) => (s.day_of_week === dow ? fn(s) : s)));
  };

  const toggleDayOff = (dow) => updateDay(dow, (s) => ({ ...s, off: !s.off }));

  const setDayStartEnd = (dow, start, end) => updateDay(dow, (s) => ({ ...s, start_time: start, end_time: end }));

  const addBreakTime = (dow, start, end) => {
    updateDay(dow, (s) => ({ ...s, break_times: [...(s.break_times || []), { start, end }] }));
  };

  const removeBreakTime = (dow, idx) => {
    updateDay(dow, (s) => ({
      ...s,
      break_times: (s.break_times || []).filter((_, i) => i !== idx),
    }));
  };

  const saveSettings = async () => {
    setSaving(true);
    const rows = settings.map((s) => ({
      day_of_week: s.day_of_week,
      off: s.off,
      start_time: s.start_time,
      end_time: s.end_time,
      break_times: s.break_times || [],
    }));
    const { error } = await supabase.from('trainer_settings').upsert(rows, { onConflict: 'day_of_week' });
    setSaving(false);
    if (!error) {
      setSaveToast(true);
    } else {
      showAlert({ message: '저장 실패: ' + error.message });
    }
  };

  const addHoliday = async () => {
    if (!newHolidayDate) return;
    const { error } = await supabase.from('trainer_holidays').insert({ date: newHolidayDate, label: newHolidayDate });
    if (!error) {
      setNewHolidayDate('');
      fetchData();
    } else {
      showAlert({ message: '추가 실패: ' + error.message });
    }
  };

  const removeHoliday = async (id) => {
    await supabase.from('trainer_holidays').delete().eq('id', id);
    fetchData();
  };

  if (loading)
    return (
      <div className="min-h-[100dvh] bg-white p-6 text-slate-900">
        <p className="text-gray-500">Loading...</p>
      </div>
    );

  return (
    <div className="min-h-[100dvh] bg-white text-slate-900 p-6 pb-24 relative">
      {saveToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg animate-pulse">
          Settings Saved ✓
        </div>
      )}
      <BackButton onClick={() => setView('admin_home')} label="Admin Home" />
      <h2 className="text-2xl font-bold text-emerald-600 mb-6">Day Off Settings</h2>

      <div className="mb-8">
        <h3 className="text-emerald-600 font-bold mb-3">📅 주간 휴무 & 근무시간</h3>
        <div className="space-y-2 mb-4">
          {settings.map((s) => (
            <div key={s.day_of_week} className="p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <span className="font-medium w-8">{DAY_NAMES[s.day_of_week]}</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={s.off} onChange={() => toggleDayOff(s.day_of_week)} className="accent-emerald-500" />
                  <span className="text-sm text-gray-600">하루 종일 휴무</span>
                </label>
                {!s.off && (
                  <div className="flex items-center gap-2 text-sm">
                    <input
                      type="time"
                      value={s.start_time}
                      onChange={(e) => setDayStartEnd(s.day_of_week, e.target.value, s.end_time)}
                      className="bg-gray-50 border border-gray-200 rounded px-2 py-1 text-slate-900"
                    />
                    <span className="text-gray-500">~</span>
                    <input
                      type="time"
                      value={s.end_time}
                      onChange={(e) => setDayStartEnd(s.day_of_week, s.start_time, e.target.value)}
                      className="bg-gray-50 border border-gray-200 rounded px-2 py-1 text-slate-900"
                    />
                  </div>
                )}
              </div>
              {!s.off && (s.break_times || []).length > 0 && (
                <div className="mt-2 ml-10 flex flex-wrap gap-2">
                  {(s.break_times || []).map((bt, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs border border-gray-200">
                      {bt.start}-{bt.end}
                      <button onClick={() => removeBreakTime(s.day_of_week, idx)} className="text-red-500 hover:underline">
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 p-3 bg-white rounded-xl border border-gray-200 shadow-sm mb-3">
          <select
            value={newOffDay}
            onChange={(e) => setNewOffDay(Number(e.target.value))}
            className="bg-gray-50 border border-gray-200 rounded px-3 py-2 text-slate-900 text-sm"
          >
            {[0, 1, 2, 3, 4, 5, 6].map((d) => (
              <option key={d} value={d}>
                {DAY_NAMES[d]}
              </option>
            ))}
          </select>
          <input
            type="time"
            value={newOffStart}
            onChange={(e) => setNewOffStart(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded px-3 py-2 text-slate-900 text-sm"
          />
          <span className="text-gray-500">~</span>
          <input
            type="time"
            value={newOffEnd}
            onChange={(e) => setNewOffEnd(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded px-3 py-2 text-slate-900 text-sm"
          />
          <button
            onClick={() => {
              addBreakTime(newOffDay, newOffStart, newOffEnd);
            }}
            className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg text-sm"
          >
            추가
          </button>
        </div>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? '저장 중...' : '저장 (Save)'}
        </button>
      </div>

      <div>
        <h3 className="text-emerald-600 font-bold mb-3">📆 특정 휴무일</h3>
        <div className="flex gap-2 mb-4">
          <input
            type="date"
            value={newHolidayDate}
            onChange={(e) => setNewHolidayDate(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-slate-900"
          />
          <button onClick={addHoliday} className="bg-emerald-600 text-white font-bold px-4 py-2 rounded-lg">
            추가
          </button>
        </div>
        <div className="space-y-2">
          {holidays.slice(0, 20).map((h) => (
            <div key={h.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
              <span className="font-mono">{h.date}</span>
              <button onClick={() => removeHoliday(h.id)} className="text-red-500 text-sm hover:underline">
                삭제
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
