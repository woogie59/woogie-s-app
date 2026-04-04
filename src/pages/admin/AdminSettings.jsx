import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useGlobalModal } from '../../context/GlobalModalContext';
import BackButton from '../../components/ui/BackButton';
import AdminPayrollExport from '../../features/admin/AdminPayrollExport';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const HOURS_0_23 = Array.from({ length: 24 }, (_, i) => i);

const emptyWeek = () =>
  Array.from({ length: 7 }, (_, d) => ({
    day_of_week: d,
    off: d === 0,
    available_hours: [],
  }));

function normalizeHours(raw) {
  if (raw == null) return [];
  let arr = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.map((x) => Number(x)).filter((h) => Number.isInteger(h) && h >= 0 && h <= 23))].sort((a, b) => a - b);
}

const AdminSettings = ({ setView, goBack }) => {
  const { showAlert } = useGlobalModal();
  const [settings, setSettings] = useState(emptyWeek);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [newHolidayDate, setNewHolidayDate] = useState('');

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
              available_hours: normalizeHours(row.available_hours),
            }
          : { day_of_week: d, off: d === 0, available_hours: [] };
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

  const toggleDayOff = (dow) => {
    updateDay(dow, (s) => {
      const nextOff = !s.off;
      if (nextOff) return { ...s, off: true, available_hours: [] };
      return { ...s, off: false };
    });
  };

  const toggleHour = (dow, h) => {
    updateDay(dow, (s) => {
      if (s.off) return s;
      const arr = [...(s.available_hours || [])];
      const i = arr.indexOf(h);
      if (i >= 0) arr.splice(i, 1);
      else arr.push(h);
      arr.sort((a, b) => a - b);
      return { ...s, available_hours: arr };
    });
  };

  const saveSettings = async () => {
    setSaving(true);
    const rows = settings.map((s) => ({
      day_of_week: s.day_of_week,
      off: s.off,
      available_hours: s.off ? [] : normalizeHours(s.available_hours),
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
      <BackButton onClick={goBack} />
      <h2 className="text-2xl font-bold text-emerald-600 mb-2">예약 설정</h2>
      <p className="text-sm text-gray-500 mb-6">시간 블록을 켜면 예약 가능합니다. (00:00–23:00)</p>

      <div className="mb-8">
        <h3 className="text-emerald-600 font-bold mb-3">주간 휴무 &amp; 예약 가능 시간</h3>
        <div className="space-y-4 mb-4">
          {settings.map((s) => (
            <div key={s.day_of_week} className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between gap-4 flex-wrap mb-2">
                <span className="font-semibold text-slate-900 w-8">{DAY_NAMES[s.day_of_week]}</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={s.off} onChange={() => toggleDayOff(s.day_of_week)} className="accent-emerald-500" />
                  <span className="text-sm text-gray-600">하루 종일 휴무</span>
                </label>
              </div>
              {!s.off && (
                <div className="grid grid-cols-6 gap-2 mt-3">
                  {HOURS_0_23.map((h) => {
                    const active = (s.available_hours || []).includes(h);
                    return (
                      <button
                        key={h}
                        type="button"
                        onClick={() => toggleHour(s.day_of_week, h)}
                        className={`py-2 rounded-lg text-[11px] font-medium tabular-nums transition-all active:scale-[0.98] ${
                          active ? 'bg-[#064e3b] text-white shadow-sm' : 'bg-gray-50 text-gray-400 border border-gray-100'
                        }`}
                      >
                        {String(h).padStart(2, '0')}:00
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
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

      <AdminPayrollExport />
    </div>
  );
};

export default AdminSettings;
