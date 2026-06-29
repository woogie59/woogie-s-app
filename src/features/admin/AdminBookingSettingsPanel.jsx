import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useGlobalModal } from '../../context/GlobalModalContext';
import { ChevronDown, X } from 'lucide-react';
import {
  dayName,
  formatHourLabel,
  nextDateForDayOfWeek,
} from '../../utils/trainerBlockedSlots';
import {
  DEFAULT_SLOT_START_HOUR,
  detectPanelExpandNeeds,
  isDayOpen,
  isWeekendBulkActive,
  isWeekendDow,
  normalizeTrainerHours,
  visiblePanelHours,
  WEEKDAY_PANEL_END_HOUR,
  WEEKDAY_PRESET_14_22,
  WEEKEND_BULK_HOURS,
} from '../../utils/labdotWeekSchedulePolicy';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const WEEKDAY_ORDER = [1, 2, 3, 4, 5];
const WEEKEND_ORDER = [6, 0];
const HOLD_LABELS = ['OT', '내부', '기타'];

const PANEL_TABS = [
  { id: 'template', label: '주간 템플릿' },
  { id: 'blocks', label: '예약처리' },
  { id: 'holidays', label: '휴무일' },
];

const emptyWeek = () =>
  Array.from({ length: 7 }, (_, d) => ({
    day_of_week: d,
    off: d === 0,
    available_hours: [],
  }));

function todayKeyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatHourBtn(h) {
  return `${String(h).padStart(2, '0')}:00`;
}

/**
 * @param {object} props
 * @param {'page' | 'embed'} [props.variant='page']
 * @param {string} [props.className]
 * @param {() => void} [props.onBlocksChanged]
 * @param {() => void} [props.onSettingsChanged]
 */
const AdminBookingSettingsPanel = ({ variant = 'page', className = '', onBlocksChanged, onSettingsChanged }) => {
  const { showAlert } = useGlobalModal();
  const [settings, setSettings] = useState(emptyWeek);
  const [holidays, setHolidays] = useState([]);
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(variant === 'page');
  const [activeTab, setActiveTab] = useState('template');
  const [hourModal, setHourModal] = useState(null);
  const [holdDate, setHoldDate] = useState('');
  const [holdLabel, setHoldLabel] = useState('OT');
  const [holdSaving, setHoldSaving] = useState(false);
  const [weekdayExpandEarly, setWeekdayExpandEarly] = useState(false);
  const [weekdayExpandLate, setWeekdayExpandLate] = useState(false);
  const [weekendExpandEarly, setWeekendExpandEarly] = useState(false);
  const [weekendExpandLate, setWeekendExpandLate] = useState(false);
  const [expandInitialized, setExpandInitialized] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const today = todayKeyLocal();
    const { data: sett, error: e1 } = await supabase.from('trainer_settings').select('*').order('day_of_week');
    const { data: hols, error: e2 } = await supabase.from('trainer_holidays').select('*').order('date', { ascending: false });
    const { data: blocks, error: e3 } = await supabase
      .from('trainer_blocked_slots')
      .select('*')
      .gte('block_date', today)
      .order('block_date', { ascending: true })
      .order('block_time', { ascending: true });

    if (!e1 && sett && sett.length) {
      const arr = Array.from({ length: 7 }, (_, d) => {
        const row = sett.find((s) => s.day_of_week === d);
        return row
          ? {
              day_of_week: d,
              off: !!row.off,
              available_hours: normalizeTrainerHours(row.available_hours),
            }
          : { day_of_week: d, off: d === 0, available_hours: [] };
      });
      setSettings(arr);
      if (!expandInitialized) {
        const needs = detectPanelExpandNeeds(arr);
        setWeekdayExpandEarly(needs.weekdayEarly);
        setWeekdayExpandLate(needs.weekdayLate);
        setWeekendExpandEarly(needs.weekendEarly);
        setWeekendExpandLate(needs.weekendLate);
        setExpandInitialized(true);
      }
    }
    setHolidays(e2 ? [] : hols || []);
    setBlockedSlots(e3 ? [] : blocks || []);
    setLoading(false);
  };

  useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
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

  const withHourChange = (list, dow, h, mode) => {
    const day = list.find((s) => s.day_of_week === dow);
    if (!day || day.off) return list;
    const arr = [...(day.available_hours || [])];
    const i = arr.indexOf(h);
    if (mode === 'off' && i >= 0) arr.splice(i, 1);
    else if (mode === 'on' && i < 0) arr.push(h);
    arr.sort((a, b) => a - b);
    return list.map((s) => (s.day_of_week === dow ? { ...s, available_hours: arr } : s));
  };

  const persistSettings = async (nextSettings, toast = true) => {
    setSaving(true);
    const rows = nextSettings.map((s) => ({
      day_of_week: s.day_of_week,
      off: s.off,
      available_hours: s.off ? [] : normalizeTrainerHours(s.available_hours),
    }));
    const { error } = await supabase.from('trainer_settings').upsert(rows, { onConflict: 'day_of_week' });
    setSaving(false);
    if (!error) {
      setSettings(nextSettings);
      if (toast) setSaveToast(true);
      onSettingsChanged?.();
    } else {
      showAlert({ message: '저장 실패: ' + error.message });
    }
    return !error;
  };

  const saveSettings = async () => {
    await persistSettings(settings, true);
  };

  const toggleDayOff = (dow) => {
    updateDay(dow, (s) => {
      const nextOff = !s.off;
      if (nextOff) return { ...s, off: true, available_hours: [] };
      return { ...s, off: false };
    });
  };

  const applyWeekendBulk = (dow, on) => {
    updateDay(dow, (s) => ({
      ...s,
      off: !on,
      available_hours: on ? [...WEEKEND_BULK_HOURS] : [],
    }));
  };

  const applyWeekendBulkBoth = (on) => {
    setSettings((prev) =>
      prev.map((s) =>
        isWeekendDow(s.day_of_week)
          ? { ...s, off: !on, available_hours: on ? [...WEEKEND_BULK_HOURS] : [] }
          : s
      )
    );
  };

  const applyWeekdayPreset1422All = () => {
    setSettings((prev) =>
      prev.map((s) =>
        s.day_of_week >= 1 && s.day_of_week <= 5
          ? { ...s, off: false, available_hours: [...WEEKDAY_PRESET_14_22] }
          : s
      )
    );
  };

  const clearWeekdays = () => {
    setSettings((prev) =>
      prev.map((s) =>
        s.day_of_week >= 1 && s.day_of_week <= 5 ? { ...s, off: true, available_hours: [] } : s
      )
    );
  };

  const handleHourClick = async (dow, h, active) => {
    if (active) {
      setHoldDate(nextDateForDayOfWeek(dow));
      setHoldLabel('OT');
      setHourModal({ dow, hour: h, active: true });
      return;
    }
    const next = withHourChange(settings, dow, h, 'on');
    await persistSettings(next, true);
  };

  const closeHourModal = () => {
    if (holdSaving) return;
    setHourModal(null);
  };

  const handleWeeklyDeactivate = async () => {
    if (!hourModal) return;
    const next = withHourChange(settings, hourModal.dow, hourModal.hour, 'off');
    setHourModal(null);
    await persistSettings(next, true);
  };

  const handleWeeklyActivate = async () => {
    if (!hourModal) return;
    const next = withHourChange(settings, hourModal.dow, hourModal.hour, 'on');
    setHourModal(null);
    await persistSettings(next, true);
  };

  const handleHoldSlot = async () => {
    if (!hourModal || !holdDate) return;
    setHoldSaving(true);
    const time = formatHourLabel(hourModal.hour);
    const { error } = await supabase.from('trainer_blocked_slots').insert({
      block_date: holdDate,
      block_time: time,
      label: holdLabel || 'OT',
      kind: holdLabel === '내부' ? 'internal' : holdLabel === '기타' ? 'hold' : 'ot',
    });
    setHoldSaving(false);
    if (error) {
      showAlert({
        message: error.message.includes('unique') ? '이미 차단된 시간입니다.' : '예약처리 실패: ' + error.message,
      });
      return;
    }
    setHourModal(null);
    await fetchData();
    onBlocksChanged?.();
  };

  const removeBlockedSlot = async (id) => {
    const { error } = await supabase.from('trainer_blocked_slots').delete().eq('id', id);
    if (error) {
      showAlert({ message: '삭제 실패: ' + error.message });
      return;
    }
    await fetchData();
    onBlocksChanged?.();
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

  const bothWeekendBulkOn = useMemo(() => {
    const sat = settings.find((s) => s.day_of_week === 6);
    const sun = settings.find((s) => s.day_of_week === 0);
    return isWeekendBulkActive(sat) && isWeekendBulkActive(sun);
  }, [settings]);

  const renderDayCard = (s, expandEarly, expandLate) => {
    const open = isDayOpen(settings, s.day_of_week);
    const hours = visiblePanelHours(s.day_of_week, expandEarly, expandLate);

    return (
      <div
        key={s.day_of_week}
        className="p-3 rounded-xl border border-slate-200/90 bg-slate-50/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6)]"
      >
        <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900 w-6 text-sm">{DAY_NAMES[s.day_of_week]}</span>
            {isWeekendDow(s.day_of_week) && (
              <span
                className={`rounded px-1 py-0.5 text-[9px] font-bold leading-none ${
                  open ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-600'
                }`}
              >
                {open ? 'OPEN' : 'CLOSED'}
              </span>
            )}
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600">
            <input
              type="checkbox"
              checked={s.off}
              onChange={() => toggleDayOff(s.day_of_week)}
              className="accent-[#064e3b]"
            />
            <span>하루 종일 휴무</span>
          </label>
        </div>
        {!s.off && (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 mt-2">
            {hours.map((h) => {
              const active = (s.available_hours || []).includes(h);
              return (
                <button
                  key={h}
                  type="button"
                  onClick={() => handleHourClick(s.day_of_week, h, active)}
                  className={`py-1.5 rounded-md text-[10px] font-medium tabular-nums transition-all active:scale-[0.98] ${
                    active
                      ? 'bg-[#064e3b] text-white shadow-sm'
                      : 'bg-white text-slate-400 border border-slate-200/80'
                  }`}
                >
                  {formatHourBtn(h)}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`text-slate-600 text-sm ${className}`}>
        <p>예약 설정을 불러오는 중…</p>
      </div>
    );
  }

  const modalDayLabel = hourModal ? `${dayName(hourModal.dow)}요일 ${formatHourLabel(hourModal.hour)}` : '';

  const templateBody = (
    <div className="space-y-5">
      <p className="text-xs text-slate-500 leading-relaxed">
        기본 표시: 평일 {DEFAULT_SLOT_START_HOUR}:00~{WEEKDAY_PANEL_END_HOUR}:00 · 주말 {DEFAULT_SLOT_START_HOUR}:00~18:00.
        비활성 칸 탭 → 즉시 ON · 활성 칸 탭 → 비활성화/예약처리(OT).
      </p>

      {/* Weekdays */}
      <div>
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
          <h3 className="text-[#064e3b] font-bold text-sm">평일 (월~금)</h3>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={applyWeekdayPreset1422All}
              className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-[#064e3b]/10 text-[#064e3b] border border-[#064e3b]/20"
            >
              14~22 일괄 ON
            </button>
            <button
              type="button"
              onClick={clearWeekdays}
              className="px-2.5 py-1 rounded-lg text-[10px] font-semibold text-slate-600 border border-slate-200"
            >
              평일 전체 OFF
            </button>
          </div>
        </div>
        {!weekdayExpandEarly && (
          <button
            type="button"
            onClick={() => setWeekdayExpandEarly(true)}
            className="w-full mb-2 py-1.5 text-[10px] font-medium text-slate-500 border border-dashed border-slate-200 rounded-lg hover:bg-slate-50"
          >
            + 00시~09시 보기
          </button>
        )}
        <div className="space-y-2">
          {WEEKDAY_ORDER.map((dow) => settings.find((x) => x.day_of_week === dow)).filter(Boolean).map((s) =>
            renderDayCard(s, weekdayExpandEarly, weekdayExpandLate)
          )}
        </div>
        {!weekdayExpandLate && (
          <button
            type="button"
            onClick={() => setWeekdayExpandLate(true)}
            className="w-full mt-2 py-1.5 text-[10px] font-medium text-slate-500 border border-dashed border-slate-200 rounded-lg hover:bg-slate-50"
          >
            + 23시 보기
          </button>
        )}
      </div>

      {/* Weekend */}
      <div>
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
          <h3 className="text-[#064e3b] font-bold text-sm">주말 (토·일)</h3>
          <button
            type="button"
            onClick={() => applyWeekendBulkBoth(!bothWeekendBulkOn)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-colors ${
              bothWeekendBulkOn
                ? 'bg-emerald-600 text-white border-emerald-700'
                : 'bg-white text-[#064e3b] border-[#064e3b]/30'
            }`}
          >
            {bothWeekendBulkOn ? '토·일 10~18 OFF' : '토·일 10~18 수업 오픈'}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {WEEKEND_ORDER.map((dow) => {
            const day = settings.find((s) => s.day_of_week === dow);
            const on = isWeekendBulkActive(day);
            return (
              <button
                key={dow}
                type="button"
                onClick={() => applyWeekendBulk(dow, !on)}
                className={`px-2 py-1 rounded-lg text-[10px] font-semibold border ${
                  on ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {DAY_NAMES[dow]} {on ? 'OFF' : '10~18 ON'}
              </button>
            );
          })}
        </div>
        {!weekendExpandEarly && (
          <button
            type="button"
            onClick={() => setWeekendExpandEarly(true)}
            className="w-full mb-2 py-1.5 text-[10px] font-medium text-slate-500 border border-dashed border-slate-200 rounded-lg hover:bg-slate-50"
          >
            + 00시~09시 보기
          </button>
        )}
        <div className="space-y-2">
          {WEEKEND_ORDER.map((dow) => settings.find((x) => x.day_of_week === dow)).filter(Boolean).map((s) =>
            renderDayCard(s, weekendExpandEarly, weekendExpandLate)
          )}
        </div>
        {!weekendExpandLate && (
          <button
            type="button"
            onClick={() => setWeekendExpandLate(true)}
            className="w-full mt-2 py-1.5 text-[10px] font-medium text-slate-500 border border-dashed border-slate-200 rounded-lg hover:bg-slate-50"
          >
            + 19시~23시 보기
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={saveSettings}
        disabled={saving}
        className="w-full py-2.5 bg-[#064e3b] text-white text-sm font-semibold rounded-xl hover:bg-[#043d2d] disabled:opacity-50 transition-colors"
      >
        {saving ? '저장 중…' : '저장'}
      </button>
    </div>
  );

  const blocksBody = (
    <div>
      <h3 className="text-[#064e3b] font-bold mb-2 text-sm">예약처리 (날짜별 차단 · OT)</h3>
      <p className="text-xs text-slate-500 mb-3">주간 템플릿은 유지하고, 특정 날짜·시간만 회원 예약을 막습니다.</p>
      {blockedSlots.length === 0 ? (
        <p className="text-sm text-slate-400 py-6 text-center">등록된 예약처리가 없습니다.</p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
          {blockedSlots.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-2 px-2 py-1.5 bg-amber-50/80 rounded-lg border border-amber-200/60 text-xs"
            >
              <span className="font-mono text-slate-800">
                {row.block_date} {row.block_time}{' '}
                <span className="text-amber-800 font-semibold">{row.label || 'OT'}</span>
              </span>
              <button type="button" onClick={() => removeBlockedSlot(row.id)} className="text-red-500 hover:underline shrink-0">
                삭제
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-slate-400 mt-3">새 OT 등록: 주간 템플릿 탭에서 활성(녹색) 시간 칸을 누르세요.</p>
    </div>
  );

  const holidaysBody = (
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
      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
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
  );

  const body = (
    <>
      {saveToast && (
        <div className="mb-3 px-3 py-2 bg-[#064e3b] text-white text-sm font-medium rounded-lg shadow-sm text-center">
          설정이 저장되었습니다
        </div>
      )}

      <div className="flex gap-1 p-1 mb-4 rounded-xl bg-slate-100/80 border border-slate-200/60">
        {PANEL_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 rounded-lg text-[11px] font-semibold transition-colors ${
              activeTab === tab.id ? 'bg-white text-[#064e3b] shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
            {tab.id === 'blocks' && blockedSlots.length > 0 ? (
              <span className="ml-1 text-[9px] text-amber-600">({blockedSlots.length})</span>
            ) : null}
          </button>
        ))}
      </div>

      {activeTab === 'template' && templateBody}
      {activeTab === 'blocks' && blocksBody}
      {activeTab === 'holidays' && holidaysBody}

      {hourModal && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="시간 슬롯 작업"
          onClick={closeHourModal}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white shadow-xl border border-slate-200/90 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#064e3b]/70">시간 슬롯</p>
                <p className="text-base font-semibold text-slate-900 mt-0.5">{modalDayLabel}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {hourModal.active ? '현재 예약 가능' : '현재 비활성(주간)'}
                </p>
              </div>
              <button type="button" onClick={closeHourModal} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="닫기">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-4 pb-4 space-y-3">
              {hourModal.active ? (
                <>
                  <button
                    type="button"
                    onClick={handleWeeklyDeactivate}
                    disabled={saving}
                    className="w-full py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    비활성화
                    <span className="block text-[10px] font-normal text-slate-400 mt-0.5">매주 이 요일·시간 예약 끄기</span>
                  </button>

                  <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-3 space-y-2">
                    <p className="text-xs font-semibold text-amber-900">예약처리</p>
                    <p className="text-[10px] text-amber-800/80">주간 설정은 유지하고, 선택한 날짜만 회원 예약을 막습니다.</p>
                    <input
                      type="date"
                      value={holdDate}
                      onChange={(e) => setHoldDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {HOLD_LABELS.map((lbl) => (
                        <button
                          key={lbl}
                          type="button"
                          onClick={() => setHoldLabel(lbl)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                            holdLabel === lbl ? 'bg-amber-600 text-white' : 'bg-white border border-slate-200 text-slate-600'
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={handleHoldSlot}
                      disabled={holdSaving || !holdDate}
                      className="w-full py-2.5 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
                    >
                      {holdSaving ? '처리 중…' : '예약처리 적용'}
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleWeeklyActivate}
                  disabled={saving}
                  className="w-full py-3 rounded-xl bg-[#064e3b] text-white text-sm font-semibold hover:bg-[#043d2d] disabled:opacity-50"
                >
                  활성화
                  <span className="block text-[10px] font-normal text-emerald-100/80 mt-0.5">매주 이 요일·시간 예약 켜기</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (variant === 'embed') {
    return (
      <div className={`rounded-2xl border border-[#064e3b]/20 bg-white shadow-sm overflow-hidden ${className}`}>
        <button
          type="button"
          onClick={() => setSettingsOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-left bg-gradient-to-r from-white to-emerald-50/30"
        >
          <span className="text-sm font-semibold text-[#064e3b]">예약 설정</span>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
        </button>
        {settingsOpen && <div className="px-3 pb-4 pt-1 sm:px-4 max-h-[min(75vh,640px)] overflow-y-auto">{body}</div>}
      </div>
    );
  }

  return <div className={className}>{body}</div>;
};

export default AdminBookingSettingsPanel;
