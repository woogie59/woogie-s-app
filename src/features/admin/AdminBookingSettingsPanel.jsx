import React, { useEffect, useMemo, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useGlobalModal } from '../../context/GlobalModalContext';
import { ChevronDown, X } from 'lucide-react';
import {
  dayName,
  formatHourLabel,
  nextDateForDayOfWeek,
  blockedSlotDisplayTitle,
  blockedSlotUsesGoogleCalendar,
  normalizeBlockTime,
} from '../../utils/trainerBlockedSlots';
import {
  DEFAULT_SLOT_START_HOUR,
  defaultHoursForOpenDate,
  detectPanelExpandNeeds,
  hoursEqual,
  isDayOpen,
  isWeekendBulkActive,
  isWeekendDow,
  normalizeTrainerHours,
  resolveDateAvailability,
  seedHoursForDateOverride,
  visiblePanelHours,
  weeklyHoursForYmd,
  WEEKDAY_PANEL_END_HOUR,
  WEEKDAY_PRESET_14_22,
  WEEKEND_BULK_HOURS,
  ymdKey,
} from '../../utils/labdotWeekSchedulePolicy';
import { invokeOtBlockGoogleSync } from '../../utils/googleCalendarOtSync';
import { invokeNotifyMemberEvents } from '../../utils/notifications';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const WEEKDAY_ORDER = [1, 2, 3, 4, 5];
const WEEKEND_ORDER = [6, 0];

const PANEL_TABS = [
  { id: 'template', label: '주간 템플릿' },
  { id: 'blocks', label: '예약처리' },
  { id: 'holidays', label: '날짜 예외' },
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
 * @param {(payload: { holidays: object[], openDates: object[] }) => void} [props.onOverridesLoaded]
 */
const AdminBookingSettingsPanel = forwardRef(function AdminBookingSettingsPanel(
  { variant = 'page', className = '', onBlocksChanged, onSettingsChanged, onSettingsLoaded, onOverridesLoaded },
  ref
) {
  const { showAlert } = useGlobalModal();
  const [settings, setSettings] = useState(emptyWeek);
  const [holidays, setHolidays] = useState([]);
  const [openDates, setOpenDates] = useState([]);
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newOpenDate, setNewOpenDate] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(variant === 'page');
  const [activeTab, setActiveTab] = useState('template');
  const [hourModal, setHourModal] = useState(null);
  const [holdDate, setHoldDate] = useState('');
  const [holdMemberName, setHoldMemberName] = useState('');
  const [holdSaving, setHoldSaving] = useState(false);
  const [members, setMembers] = useState([]);
  const [addBookingMemberId, setAddBookingMemberId] = useState('');
  const [addBookingSaving, setAddBookingSaving] = useState(false);
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
    const { data: opens, error: eOpen } = await supabase
      .from('trainer_open_dates')
      .select('*')
      .order('date', { ascending: false });
    const { data: blocks, error: e3 } = await supabase
      .from('trainer_blocked_slots')
      .select('*')
      .gte('block_date', today)
      .order('block_date', { ascending: true })
      .order('block_time', { ascending: true });
    const holidayRows = e2 ? [] : hols || [];
    const openRows = eOpen ? [] : (opens || []).map((row) => ({
      ...row,
      date: ymdKey(row.date),
      available_hours: normalizeTrainerHours(row.available_hours),
    }));
    setHolidays(holidayRows);
    setOpenDates(openRows);
    onOverridesLoaded?.({ holidays: holidayRows, openDates: openRows });
    if (eOpen) {
      console.warn('[AdminBookingSettingsPanel] trainer_open_dates:', eOpen.message);
    }
    const { data: mems, error: e4 } = await supabase
      .from('profiles')
      .select('id, name, email')
      .neq('role', 'admin')
      .eq('status', 'active')
      .order('name');

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
      onSettingsLoaded?.(arr);
      if (!expandInitialized) {
        const needs = detectPanelExpandNeeds(arr);
        setWeekdayExpandEarly(needs.weekdayEarly);
        setWeekdayExpandLate(needs.weekdayLate);
        setWeekendExpandEarly(needs.weekendEarly);
        setWeekendExpandLate(needs.weekendLate);
        setExpandInitialized(true);
      }
    }
    setBlockedSlots(e3 ? [] : blocks || []);
    setMembers(e4 ? [] : mems || []);
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
    if (!day) return list;
    if (day.off && mode === 'on') {
      return list.map((s) =>
        s.day_of_week === dow ? { ...s, off: false, available_hours: [h] } : s
      );
    }
    if (day.off) return list;
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
      onSettingsLoaded?.(nextSettings);
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

  const handleHourClick = (dow, h, active, dateKey = null) => {
    setHoldDate(dateKey || nextDateForDayOfWeek(dow));
    setHoldMemberName('');
    setAddBookingMemberId('');
    setHourModal({ dow, hour: h, active, dateKey });
  };

  const openSlotModal = useCallback(
    ({ dow, hour, dateKey }) => {
      const day = settings.find((s) => s.day_of_week === dow);
      const active = !!day && !day.off && (day.available_hours || []).includes(hour);
      handleHourClick(dow, hour, active, dateKey);
    },
    [settings]
  );

  useImperativeHandle(
    ref,
    () => ({
      openSlotModal,
      refresh: fetchData,
    }),
    [openSlotModal]
  );

  const closeHourModal = () => {
    if (holdSaving || addBookingSaving) return;
    setHourModal(null);
  };

  const handleAdminAddBooking = async () => {
    if (!hourModal || !holdDate || !addBookingMemberId) return;
    const time = formatHourLabel(hourModal.hour);
    const slotBlocked = blockedSlots.some(
      (row) => row.block_date === holdDate && normalizeBlockTime(row.block_time) === time
    );
    if (slotBlocked) {
      showAlert({ message: '휴무·OT로 차단된 시간입니다. 예약처리를 먼저 해제해 주세요.' });
      return;
    }

    setAddBookingSaving(true);
    try {
      const { data: existing, error: existingErr } = await supabase
        .from('bookings')
        .select('id, status')
        .eq('date', holdDate)
        .eq('time', time)
        .maybeSingle();
      if (existingErr) {
        showAlert({ message: '예약 확인 실패: ' + existingErr.message });
        return;
      }
      if (existing && existing.status !== 'cancelled') {
        showAlert({ message: '이미 예약된 시간입니다.' });
        return;
      }

      const { data, error } = await supabase.rpc('admin_create_booking', {
        p_user_id: addBookingMemberId,
        p_date: holdDate,
        p_time: time,
      });
      if (error) {
        showAlert({ message: '수업 추가 실패: ' + error.message });
        return;
      }
      const payload = data && typeof data === 'object' ? data : {};
      if (!payload.ok) {
        const errCode = String(payload.error || '');
        const msg =
          errCode === 'slot_taken'
            ? '이미 예약된 시간입니다.'
            : errCode === 'forbidden'
              ? '관리자 권한이 필요합니다.'
              : errCode === 'member_not_found'
                ? '회원을 찾을 수 없습니다.'
                : `수업 추가 실패: ${errCode || 'unknown'}`;
        showAlert({ message: msg });
        return;
      }

      const member = members.find((m) => m.id === addBookingMemberId);
      const memberLabel = member?.name || member?.email || '회원';
      try {
        await invokeNotifyMemberEvents(
          addBookingMemberId,
          'LAB DOT · 수업 예약',
          `${holdDate} ${time} 수업이 등록되었습니다.`,
          'booking'
        );
      } catch (notifyErr) {
        console.warn('[handleAdminAddBooking] member push:', notifyErr);
      }

      showAlert({ message: `${memberLabel}님 · ${holdDate} ${time} 수업이 추가되었습니다.` });
      setHourModal(null);
      setAddBookingMemberId('');
      onBlocksChanged?.();
    } finally {
      setAddBookingSaving(false);
    }
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

  const handleDayOffSlot = async () => {
    if (!hourModal || !holdDate) return;
    setHoldSaving(true);
    const time = formatHourLabel(hourModal.hour);
    const { error } = await supabase.from('trainer_blocked_slots').insert({
      block_date: holdDate,
      block_time: time,
      label: '휴무',
      kind: 'hold',
    });
    setHoldSaving(false);
    if (error) {
      showAlert({
        message: error.message.includes('unique') ? '이미 차단된 시간입니다.' : '휴무 설정 실패: ' + error.message,
      });
      return;
    }
    setHourModal(null);
    await fetchData();
    onBlocksChanged?.();
  };

  const handleHoldSlot = async () => {
    if (!hourModal || !holdDate) return;
    const memberName = holdMemberName.trim();
    if (!memberName) {
      showAlert({ message: 'OT 대상 이름을 입력해 주세요.' });
      return;
    }
    setHoldSaving(true);
    const time = formatHourLabel(hourModal.hour);
    const { data, error } = await supabase
      .from('trainer_blocked_slots')
      .insert({
        block_date: holdDate,
        block_time: time,
        label: 'OT',
        kind: 'ot',
        member_name: memberName,
      })
      .select()
      .single();
    if (error) {
      setHoldSaving(false);
      showAlert({
        message: error.message.includes('unique') ? '이미 차단된 시간입니다.' : '예약처리 실패: ' + error.message,
      });
      return;
    }
    const sync = await invokeOtBlockGoogleSync('INSERT', data);
    setHoldSaving(false);
    if (!sync.ok) {
      showAlert({
        message: '예약처리는 등록됐지만 Google Calendar 연동에 실패했습니다. 설정을 확인해 주세요.',
      });
    }
    setHourModal(null);
    await fetchData();
    onBlocksChanged?.();
  };

  const removeBlockedSlot = async (row) => {
    if (!row?.id) return;
    let gcalFailed = false;
    if (blockedSlotUsesGoogleCalendar(row)) {
      const sync = await invokeOtBlockGoogleSync('DELETE', null, row);
      gcalFailed = !sync.ok;
      if (gcalFailed) {
        console.warn('[removeBlockedSlot] Google Calendar unlink failed; opening slot anyway');
      }
    }
    const { error } = await supabase.from('trainer_blocked_slots').delete().eq('id', row.id);
    if (error) {
      showAlert({ message: '삭제 실패: ' + error.message });
      return;
    }
    await fetchData();
    onBlocksChanged?.();
    if (gcalFailed) {
      showAlert({
        message: '수업 차단은 해제되었습니다. Google Calendar 일정은 캘린더에서 직접 확인해 주세요.',
      });
    }
  };

  const addHoliday = async () => {
    if (!newHolidayDate) return;
    const { error } = await supabase.from('trainer_holidays').insert({ date: newHolidayDate, label: newHolidayDate });
    if (error) {
      showAlert({
        message: error.message.includes('unique') ? '이미 등록된 휴무일입니다.' : '추가 실패: ' + error.message,
      });
      return;
    }
    await supabase.from('trainer_open_dates').delete().eq('date', newHolidayDate);
    setNewHolidayDate('');
    await fetchData();
    onSettingsChanged?.();
  };

  const removeHoliday = async (id) => {
    const { error } = await supabase.from('trainer_holidays').delete().eq('id', id);
    if (error) {
      showAlert({ message: '삭제 실패: ' + error.message });
      return;
    }
    await fetchData();
    onSettingsChanged?.();
  };

  const persistDateHours = async (dateStr, hours, label = '이 날짜만') => {
    const ymd = ymdKey(dateStr);
    if (!ymd) return false;
    const next = normalizeTrainerHours(hours);
    const weekly = weeklyHoursForYmd(settings, ymd);
    if (hoursEqual(next, weekly)) {
      const { error: delOpenErr } = await supabase.from('trainer_open_dates').delete().eq('date', ymd);
      if (delOpenErr) {
        showAlert({ message: '예외 해제 실패: ' + delOpenErr.message });
        return false;
      }
      const { error: delHolErr } = await supabase.from('trainer_holidays').delete().eq('date', ymd);
      if (delHolErr) {
        showAlert({ message: '휴무 해제 실패: ' + delHolErr.message });
        return false;
      }
      return true;
    }
    const { error } = await supabase.from('trainer_open_dates').upsert(
      { date: ymd, available_hours: next, label },
      { onConflict: 'date' }
    );
    if (error) {
      showAlert({ message: '날짜 예외 저장 실패: ' + error.message });
      return false;
    }
    await supabase.from('trainer_holidays').delete().eq('date', ymd);
    return true;
  };

  const addOpenDateOverride = async (dateStr) => persistDateHours(dateStr, defaultHoursForOpenDate(settings, dateStr), '이 날짜만 10~18');

  const handleDateHourOn = async () => {
    if (!hourModal || !holdDate) return;
    setHoldSaving(true);
    try {
      const base = seedHoursForDateOverride(settings, holdDate, { holidays, openDates });
      const next = [...new Set([...base, hourModal.hour])].sort((a, b) => a - b);
      const ok = await persistDateHours(holdDate, next, '이 날짜만');
      if (!ok) return;
      setHourModal(null);
      await fetchData();
      onSettingsChanged?.();
    } finally {
      setHoldSaving(false);
    }
  };

  const handleDateHourOff = async () => {
    if (!hourModal || !holdDate) return;
    setHoldSaving(true);
    try {
      const base = seedHoursForDateOverride(settings, holdDate, { holidays, openDates });
      const next = base.filter((h) => h !== hourModal.hour);
      const ok = await persistDateHours(holdDate, next, '이 날짜만');
      if (!ok) return;
      setHourModal(null);
      await fetchData();
      onSettingsChanged?.();
    } finally {
      setHoldSaving(false);
    }
  };

  const addOpenDateFromTab = async () => {
    if (!newOpenDate) return;
    const ok = await addOpenDateOverride(newOpenDate);
    if (!ok) return;
    setNewOpenDate('');
    await fetchData();
    onSettingsChanged?.();
  };

  const removeOpenDate = async (idOrDate) => {
    const query = typeof idOrDate === 'string' && idOrDate.length === 10
      ? supabase.from('trainer_open_dates').delete().eq('date', idOrDate)
      : supabase.from('trainer_open_dates').delete().eq('id', idOrDate);
    const { error } = await query;
    if (error) {
      showAlert({ message: '삭제 실패: ' + error.message });
      return;
    }
    await fetchData();
    onSettingsChanged?.();
  };

  const handleDateOnlyHoliday = async () => {
    if (!holdDate) return;
    setHoldSaving(true);
    try {
      const { error } = await supabase.from('trainer_holidays').insert({ date: holdDate, label: '하루 휴무' });
      if (error) {
        showAlert({
          message: error.message.includes('unique') ? '이미 이 날짜는 하루 휴무입니다.' : '휴무 설정 실패: ' + error.message,
        });
        return;
      }
      await supabase.from('trainer_open_dates').delete().eq('date', holdDate);
      setHourModal(null);
      await fetchData();
      onSettingsChanged?.();
    } finally {
      setHoldSaving(false);
    }
  };

  const handleClearDateHoliday = async () => {
    if (!holdDate) return;
    setHoldSaving(true);
    try {
      const { error } = await supabase.from('trainer_holidays').delete().eq('date', holdDate);
      if (error) {
        showAlert({ message: '휴무 해제 실패: ' + error.message });
        return;
      }
      setHourModal(null);
      await fetchData();
      onSettingsChanged?.();
    } finally {
      setHoldSaving(false);
    }
  };

  const handleDateOnlyOpen = async () => {
    if (!holdDate) return;
    setHoldSaving(true);
    try {
      const ok = await addOpenDateOverride(holdDate);
      if (!ok) return;
      setHourModal(null);
      await fetchData();
      onSettingsChanged?.();
    } finally {
      setHoldSaving(false);
    }
  };

  const handleClearDateOpen = async () => {
    if (!holdDate) return;
    setHoldSaving(true);
    try {
      const { error } = await supabase.from('trainer_open_dates').delete().eq('date', holdDate);
      if (error) {
        showAlert({ message: '오픈 해제 실패: ' + error.message });
        return;
      }
      setHourModal(null);
      await fetchData();
      onSettingsChanged?.();
    } finally {
      setHoldSaving(false);
    }
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

  const modalDayLabel = hourModal
    ? hourModal.dateKey
      ? `${hourModal.dateKey.replace(/-/g, '. ')} · ${formatHourLabel(hourModal.hour)}`
      : `${dayName(hourModal.dow)}요일 ${formatHourLabel(hourModal.hour)}`
    : '';

  const holdResolved = holdDate
    ? resolveDateAvailability(settings, holdDate, { holidays, openDates })
    : null;
  const holdIsHoliday = holdResolved?.source === 'holiday';
  const holdIsOpenOverride = holdResolved?.source === 'open_date';
  const dateHourOn = Boolean(
    hourModal &&
      holdResolved &&
      !holdResolved.off &&
      (holdResolved.available_hours || []).includes(hourModal.hour)
  );
  const dateHoursAreWeekendBulk = Boolean(
    holdResolved && !holdResolved.off && hoursEqual(holdResolved.available_hours, WEEKEND_BULK_HOURS)
  );
  const dateBadge = holdIsHoliday
    ? { text: '이 날짜 · 하루 휴무', className: 'bg-red-100 text-red-800 ring-1 ring-red-200' }
    : holdIsOpenOverride && dateHourOn
      ? { text: '이 날짜만 · 이 시간 오픈', className: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200' }
      : holdIsOpenOverride
        ? { text: '이 날짜만 · 이 시간 꺼짐', className: 'bg-slate-200 text-slate-600 ring-1 ring-slate-300' }
        : hourModal?.active
          ? { text: '주간 · 예약 가능', className: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200' }
          : { text: '주간 · 비활성', className: 'bg-slate-200 text-slate-600 ring-1 ring-slate-300' };

  const hourModalLayer = hourModal ? (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="시간 슬롯 작업"
      onClick={closeHourModal}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-xl border border-slate-200/90 overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#064e3b]/70">시간 슬롯</p>
            <p className="text-base font-semibold text-slate-900 mt-0.5">{modalDayLabel}</p>
            <div className="mt-1.5">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${dateBadge.className}`}>
                {dateBadge.text}
              </span>
            </div>
          </div>
          <button type="button" onClick={closeHourModal} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="닫기">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 pb-4 space-y-3">
          <div className="rounded-xl border border-[#064e3b]/25 bg-[#064e3b]/5 p-3 space-y-2">
            <p className="text-xs font-semibold text-[#064e3b]">이 날짜만 (주간과 별개)</p>
            <p className="text-[10px] text-slate-600 leading-relaxed">
              평일 휴일처럼 그날만 운영시간이 다를 때 사용합니다. 매주 같은 요일은 그대로 둡니다.
            </p>
            <input
              type="date"
              value={holdDate}
              onChange={(e) => setHoldDate(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm"
            />
            {holdIsHoliday ? (
              <button
                type="button"
                onClick={handleClearDateHoliday}
                disabled={holdSaving || addBookingSaving || !holdDate}
                className="w-full py-2.5 rounded-xl border border-red-200 bg-white text-red-800 text-sm font-semibold hover:bg-red-50 disabled:opacity-50"
              >
                {holdSaving ? '처리 중…' : '이 날짜 휴무 해제'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDateOnlyHoliday}
                disabled={holdSaving || addBookingSaving || !holdDate}
                className="w-full py-2.5 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900 disabled:opacity-50"
              >
                {holdSaving ? '처리 중…' : '이 날짜만 하루 휴무'}
              </button>
            )}
            {dateHourOn ? (
              <button
                type="button"
                onClick={handleDateHourOff}
                disabled={holdSaving || addBookingSaving || !holdDate}
                className="w-full py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
              >
                {holdSaving ? '처리 중…' : '이 날짜·이 시간만 끄기'}
                <span className="block text-[10px] font-normal text-slate-500 mt-0.5">
                  {formatHourLabel(hourModal.hour)}만 닫습니다
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDateHourOn}
                disabled={holdSaving || addBookingSaving || !holdDate}
                className="w-full py-2.5 rounded-xl bg-[#064e3b] text-white text-sm font-semibold hover:bg-[#043d2d] disabled:opacity-50"
              >
                {holdSaving ? '처리 중…' : '이 날짜·이 시간만 켜기'}
                <span className="block text-[10px] font-normal text-emerald-100/80 mt-0.5">
                  {formatHourLabel(hourModal.hour)}만 엽니다. 다른 요일은 그대로입니다
                </span>
              </button>
            )}
            {dateHoursAreWeekendBulk ? null : (
              <button
                type="button"
                onClick={handleDateOnlyOpen}
                disabled={holdSaving || addBookingSaving || !holdDate}
                className="w-full py-2.5 rounded-xl border border-[#064e3b]/30 bg-white text-[#064e3b] text-sm font-semibold hover:bg-emerald-50 disabled:opacity-50"
              >
                {holdSaving ? '처리 중…' : '이 날짜만 10~18 오픈'}
                <span className="block text-[10px] font-normal text-slate-500 mt-0.5">
                  휴일 운영시간으로 바꿉니다
                </span>
              </button>
            )}
            {holdIsOpenOverride ? (
              <button
                type="button"
                onClick={handleClearDateOpen}
                disabled={holdSaving || addBookingSaving || !holdDate}
                className="w-full py-2.5 rounded-xl border border-emerald-200 bg-white text-emerald-900 text-sm font-semibold hover:bg-emerald-50 disabled:opacity-50"
              >
                {holdSaving ? '처리 중…' : '이 날짜 예외 해제'}
                <span className="block text-[10px] font-normal text-slate-500 mt-0.5">
                  주간 템플릿으로 돌아갑니다
                </span>
              </button>
            ) : null}
          </div>

          <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3 space-y-2">
            <p className="text-xs font-semibold text-emerald-900">수업 추가</p>
            <p className="text-[10px] text-emerald-800/80 leading-relaxed">
              관리자는 1시간 이내 슬롯도 회원 수업을 등록할 수 있습니다.
            </p>
            <select
              value={addBookingMemberId}
              onChange={(e) => setAddBookingMemberId(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm text-slate-900"
            >
              <option value="">회원 선택</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.email || m.id}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAdminAddBooking}
              disabled={addBookingSaving || !holdDate || !addBookingMemberId}
              className="w-full py-2.5 rounded-xl bg-[#064e3b] text-white text-sm font-semibold hover:bg-[#043d2d] disabled:opacity-50"
            >
              {addBookingSaving ? '등록 중…' : '수업 추가'}
            </button>
          </div>

          {hourModal.active ? (
            <button
              type="button"
              onClick={handleWeeklyDeactivate}
              disabled={saving || addBookingSaving}
              className="w-full py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              매주 이 시간 끄기
              <span className="block text-[10px] font-normal text-slate-400 mt-0.5">모든 주의 같은 요일·시간에 적용됩니다</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleWeeklyActivate}
              disabled={saving}
              className="w-full py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              매주 이 시간 켜기
              <span className="block text-[10px] font-normal text-slate-400 mt-0.5">모든 주의 같은 요일·시간에 적용됩니다</span>
            </button>
          )}

          {dateHourOn ? (
            <>
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-3 space-y-2">
                <p className="text-xs font-semibold text-slate-800">이 시간만 휴무</p>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  하루 전체가 아니라 선택한 날짜·시간 한 칸만 막습니다. (Google Calendar 미연동)
                </p>
                <button
                  type="button"
                  onClick={handleDayOffSlot}
                  disabled={holdSaving || addBookingSaving || !holdDate}
                  className="w-full py-2.5 rounded-xl bg-slate-700 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
                >
                  {holdSaving ? '처리 중…' : '이 시간만 휴무 (OFF)'}
                </button>
              </div>

              <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-3 space-y-2">
                <p className="text-xs font-semibold text-amber-900">OT 예약처리</p>
                <p className="text-[10px] text-amber-800/80">OT 수업 — Google Calendar에 자동 등록됩니다.</p>
                <input
                  type="text"
                  value={holdMemberName}
                  onChange={(e) => setHoldMemberName(e.target.value)}
                  placeholder="OT 대상 이름 (예: 홍길동)"
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={handleHoldSlot}
                  disabled={holdSaving || addBookingSaving || !holdDate || !holdMemberName.trim()}
                  className="w-full py-2.5 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
                >
                  {holdSaving ? '처리 중…' : 'OT 적용'}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  ) : null;

  const templateBody = (
    <div className="space-y-5">
      <p className="text-xs text-slate-500 leading-relaxed">
        주간 템플릿은 <span className="font-semibold text-slate-700">매주 같은 요일</span>에 적용됩니다.
        평일 휴일처럼 그날만 시간이 다르면 캘린더에서 「이 날짜·이 시간만 켜기/끄기」 또는 「이 날짜만 10~18 오픈」을 쓰세요.
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
      <h3 className="text-[#064e3b] font-bold mb-2 text-sm">예약처리 (휴무 · OT)</h3>
      <p className="text-xs text-slate-500 mb-3">주간 템플릿은 유지하고, 특정 날짜·시간만 회원 예약을 막습니다.</p>
      {blockedSlots.length === 0 ? (
        <p className="text-sm text-slate-400 py-6 text-center">등록된 예약처리가 없습니다.</p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
          {blockedSlots.map((row) => (
            <div
              key={row.id}
              className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg border text-xs ${
                row.kind === 'hold'
                  ? 'bg-slate-100/90 border-slate-200/80'
                  : 'bg-amber-50/80 border-amber-200/60'
              }`}
            >
              <span className="font-mono text-slate-800">
                {row.block_date} {row.block_time}{' '}
                <span
                  className={`font-semibold ${row.kind === 'hold' ? 'text-slate-700' : 'text-amber-800'}`}
                >
                  {blockedSlotDisplayTitle(row)}
                </span>
              </span>
              <button type="button" onClick={() => removeBlockedSlot(row)} className="text-red-500 hover:underline shrink-0">
                삭제
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-slate-400 mt-3">캘린더 또는 주간 템플릿에서 활성(녹색) 시간 칸을 눌러 휴무·OT를 설정하세요.</p>
    </div>
  );

  const holidaysBody = (
    <div className="space-y-6">
      <p className="text-xs text-slate-500 leading-relaxed">
        주간 템플릿과 별개로 <span className="font-semibold text-slate-700">특정 날짜만</span> 닫거나 엽니다.
        평일 휴일은 캘린더에서 그 시간만 켜거나, 「이 날짜만 10~18 오픈」으로 바꿀 수 있습니다.
      </p>
      <div>
        <h3 className="text-[#064e3b] font-bold mb-2 text-sm">이 날짜만 하루 휴무</h3>
        <div className="flex flex-wrap gap-2 mb-2">
          <input
            type="date"
            value={newHolidayDate}
            onChange={(e) => setNewHolidayDate(e.target.value)}
            className="flex-1 min-w-0 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-900"
          />
          <button type="button" onClick={addHoliday} className="shrink-0 bg-slate-800 text-white text-sm font-semibold px-3 py-1.5 rounded-lg">
            휴무 추가
          </button>
        </div>
        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
          {holidays.slice(0, 20).map((h) => (
            <div
              key={h.id}
              className="flex items-center justify-between px-2 py-1.5 bg-white rounded-lg border border-slate-100 text-xs"
            >
              <span className="font-mono text-slate-800">{ymdKey(h.date)}</span>
              <button type="button" onClick={() => removeHoliday(h.id)} className="text-red-500 hover:underline">
                삭제
              </button>
            </div>
          ))}
          {holidays.length === 0 ? (
            <p className="text-xs text-slate-400 py-2 text-center">등록된 하루 휴무가 없습니다.</p>
          ) : null}
        </div>
      </div>
      <div>
        <h3 className="text-[#064e3b] font-bold mb-2 text-sm">이 날짜만 10~18 오픈</h3>
        <p className="text-[10px] text-slate-500 mb-2 leading-relaxed">
          평일 휴일처럼 그날만 주말 시간(10~18)으로 엽니다. 주간 템플릿은 그대로입니다.
        </p>
        <div className="flex flex-wrap gap-2 mb-2">
          <input
            type="date"
            value={newOpenDate}
            onChange={(e) => setNewOpenDate(e.target.value)}
            className="flex-1 min-w-0 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-900"
          />
          <button type="button" onClick={addOpenDateFromTab} className="shrink-0 bg-[#064e3b] text-white text-sm font-semibold px-3 py-1.5 rounded-lg">
            오픈 추가
          </button>
        </div>
        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
          {openDates.slice(0, 20).map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between px-2 py-1.5 bg-emerald-50/70 rounded-lg border border-emerald-100 text-xs"
            >
              <span className="font-mono text-slate-800">{ymdKey(row.date)}</span>
              <button type="button" onClick={() => removeOpenDate(row.id)} className="text-red-500 hover:underline">
                삭제
              </button>
            </div>
          ))}
          {openDates.length === 0 ? (
            <p className="text-xs text-slate-400 py-2 text-center">날짜만 연 예외가 없습니다.</p>
          ) : null}
        </div>
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

      {loading ? (
        <p className="text-sm text-slate-500 py-6 text-center">예약 설정을 불러오는 중…</p>
      ) : (
        <>
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
                {tab.id === 'holidays' && holidays.length + openDates.length > 0 ? (
                  <span className="ml-1 text-[9px] text-[#064e3b]">({holidays.length + openDates.length})</span>
                ) : null}
              </button>
            ))}
          </div>

          {activeTab === 'template' && templateBody}
          {activeTab === 'blocks' && blocksBody}
          {activeTab === 'holidays' && holidaysBody}
        </>
      )}
    </>
  );

  if (variant === 'embed') {
    return (
      <>
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
        {hourModalLayer}
      </>
    );
  }

  return (
    <>
      <div className={className}>{body}</div>
      {hourModalLayer}
    </>
  );
});

export default AdminBookingSettingsPanel;
