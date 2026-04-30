import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useGlobalModal } from '../../context/GlobalModalContext';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const DAY_RENDER_ORDER = [1, 2, 3, 4, 5, 6, 0];
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
  return [...new Set(arr.map((x) => Number(x)).filter((h) => Number.isInteger(h) && h >= 0 && h <= 23))].sort(
    (a, b) => a - b
  );
}

/**
 * @param {object} props
 * @param {'page' | 'embed'} [props.variant='page'] — embed: compact card for admin schedule dashboard
 * @param {string} [props.className]
 */
const AdminBookingSettingsPanel = ({ variant = 'page', className = '' }) => {
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount: load trainer_settings / holidays
    void fetchData();
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

  if (loading) {
    return (
      <div className={`text-slate-600 text-sm ${className}`}>
        <p>예약 설정을 불러오는 중…</p>
      </div>
    );
  }

  const body = (
    <>
      {saveToast && (
        <div className="mb-3 px-3 py-2 bg-[#064e3b] text-white text-sm font-medium rounded-lg shadow-sm text-center">
          설정이 저장되었습니다
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-[#064e3b] font-bold mb-2 text-sm tracking-wide">주간 휴무 · 예약 가능 시간</h3>
        <p className="text-xs text-slate-500 mb-3">시간 칸을 켜면 해당 시간에 예약이 열립니다.</p>
        <div className="space-y-3">
          {DAY_RENDER_ORDER.map((dow) => settings.find((x) => x.day_of_week === dow)).filter(Boolean).map((s) => (
            <div
              key={s.day_of_week}
              className="p-3 rounded-xl border border-slate-200/90 bg-slate-50/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6)]"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                <span className="font-semibold text-slate-900 w-6 text-sm">{DAY_NAMES[s.day_of_week]}</span>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600">
                  <input type="checkbox" checked={s.off} onChange={() => toggleDayOff(s.day_of_week)} className="accent-[#064e3b]" />
                  <span>하루 종일 휴무</span>
                </label>
              </div>
              {!s.off && (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 mt-2">
                  {HOURS_0_23.map((h) => {
                    const active = (s.available_hours || []).includes(h);
                    return (
                      <button
                        key={h}
                        type="button"
                        onClick={() => toggleHour(s.day_of_week, h)}
                        className={`py-1.5 rounded-md text-[10px] font-medium tabular-nums transition-all active:scale-[0.98] ${
                          active
                            ? 'bg-[#064e3b] text-white shadow-sm'
                            : 'bg-white text-slate-400 border border-slate-200/80'
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
          type="button"
          onClick={saveSettings}
          disabled={saving}
          className="w-full mt-3 py-2.5 bg-[#064e3b] text-white text-sm font-semibold rounded-xl hover:bg-[#043d2d] disabled:opacity-50 transition-colors"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>

      <div>
        <h3 className="text-[#064e3b] font-bold mb-2 text-sm">특정 휴무일</h3>
        <div className="flex flex-wrap gap-2 mb-2">
          <input
            type="date"
            value={newHolidayDate}
            onChange={(e) => setNewHolidayDate(e.target.value)}
            className="flex-1 min-w-0 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-900"
          />
          <button type="button" onClick={addHoliday} className="shrink-0 bg-[#064e3b] text-white text-sm font-semibold px-3 py-1.5 rounded-lg">
            추가
          </button>
        </div>
        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
          {holidays.slice(0, 20).map((h) => (
            <div
              key={h.id}
              className="flex items-center justify-between px-2 py-1.5 bg-white rounded-lg border border-slate-100 text-xs"
            >
              <span className="font-mono text-slate-800">{h.date}</span>
              <button type="button" onClick={() => removeHoliday(h.id)} className="text-red-500 hover:underline">
                삭제
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  if (variant === 'embed') {
    return (
      <div className={`rounded-2xl border border-[#064e3b]/20 bg-white shadow-sm overflow-hidden ${className}`}>
        <div className="px-3 pb-4 pt-4 sm:px-4 max-h-[min(70vh,520px)] overflow-y-auto">{body}</div>
      </div>
    );
  }

  return <div className={className}>{body}</div>;
};

export default AdminBookingSettingsPanel;
