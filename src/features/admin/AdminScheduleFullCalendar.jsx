import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import koLocale from '@fullcalendar/core/locales/ko';
import { ClipboardCopy, Download } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useGlobalModal } from '../../context/GlobalModalContext';
import {
  buildWeeklyTimetableAoa,
  copyWeeklyScheduleAoaToClipboard,
  downloadWeeklyScheduleXlsx,
  getMonday,
  toYmd,
} from '../../utils/weeklyScheduleGridExport';
import AdminDayAgenda from './AdminDayAgenda';
import './adminScheduleCalendar.css';

const SLOT_MIN_HOUR = 7;
const SLOT_MAX_HOUR = 23;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function overlayRange(anchor) {
  const base = anchor instanceof Date && !Number.isNaN(anchor.getTime()) ? anchor : new Date();
  const start = new Date(base.getFullYear(), base.getMonth(), 1);
  start.setDate(start.getDate() - 7);
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  end.setDate(end.getDate() + 14);
  return { start, end };
}

function buildAvailabilityOverlayEvents(getSlotLaneState, anchor) {
  if (!getSlotLaneState) return [];
  const { start, end } = overlayRange(anchor);
  const events = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  while (cursor < end) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const d = cursor.getDate();
    const ymd = toYmd(cursor);
    for (let h = SLOT_MIN_HOUR; h < SLOT_MAX_HOUR; h++) {
      const slot = new Date(y, m, d, h, 0, 0, 0);
      const state = getSlotLaneState(slot);
      if (state !== 'date_off') continue;
      events.push({
        id: `lane-${ymd}-${h}-date_off`,
        title: 'OFF',
        start: slot,
        end: new Date(y, m, d, h + 1, 0, 0, 0),
        display: 'block',
        classNames: ['labdot-date-off-event'],
        editable: false,
        overlap: true,
        extendedProps: { isAvailability: true, laneState: state },
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return events;
}

const VIEW_TABS = [
  { key: 'agenda', label: '일' },
  { key: 'timeGridWeek', label: '주' },
  { key: 'dayGridMonth', label: '월' },
  { key: 'listWeek', label: '목록' },
];

/**
 * @param {object} props
 * @param {import('@fullcalendar/core').EventInput[]} props.events
 * @param {(info: import('@fullcalendar/core').EventClickArg) => void} props.onEventClick
 * @param {(info: import('@fullcalendar/interaction').DateClickArg) => void} [props.onSlotClick]
 * @param {(date: Date) => boolean} [props.isSlotAvailable]
 * @param {(date: Date) => 'available' | 'weekly_off' | 'date_off' | 'holiday'} [props.getSlotLaneState]
 * @param {string} [props.scheduleSettingsStamp] — changes remount lanes + OFF chips
 * @param {boolean} [props.loading]
 * @param {Date} [props.initialDate]
 */
const AdminScheduleFullCalendar = ({
  events,
  onEventClick,
  onSlotClick,
  isSlotAvailable,
  getSlotLaneState,
  scheduleSettingsStamp,
  loading,
  initialDate,
}) => {
  const calRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [copying, setCopying] = useState(false);
  const [viewDate, setViewDate] = useState(() =>
    initialDate instanceof Date && !Number.isNaN(initialDate.getTime()) ? initialDate : new Date()
  );
  const [viewType, setViewType] = useState('timeGridWeek');
  // 안 A: 모바일 기본 = 일 단위 아젠다
  const [viewMode, setViewMode] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 ? 'agenda' : 'calendar'
  );
  const [agendaDate, setAgendaDate] = useState(() =>
    initialDate instanceof Date && !Number.isNaN(initialDate.getTime()) ? initialDate : new Date()
  );
  const { showToast } = useGlobalModal();

  useEffect(() => {
    if (initialDate instanceof Date && !Number.isNaN(initialDate.getTime())) {
      setViewDate(initialDate);
      setAgendaDate(initialDate);
    }
  }, [initialDate]);

  // OFF 칩은 그리드에서 제거하고, 월 보기 "쉬는 날" 음영 계산에만 사용
  const overlayEvents = useMemo(
    () => buildAvailabilityOverlayEvents(getSlotLaneState, viewDate),
    [getSlotLaneState, viewDate, scheduleSettingsStamp]
  );

  // 주간/일간 그리드: 요일·날짜별 예약 가능/비활성 슬롯을 배경 이벤트로 칠한다.
  const availabilityBgEvents = useMemo(() => {
    if (!getSlotLaneState) return [];
    if (viewType !== 'timeGridWeek' && viewType !== 'timeGridDay') return [];
    const base = viewType === 'timeGridDay' ? viewDate : getMonday(viewDate);
    const dayCount = viewType === 'timeGridDay' ? 1 : 7;
    const out = [];
    for (let d = 0; d < dayCount; d += 1) {
      const day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + d);
      for (let hour = 7; hour <= 22; hour += 1) {
        const slotDate = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0);
        const state = getSlotLaneState(slotDate);
        let cls = null;
        if (state === 'available') cls = 'labdot-bg-available';
        else if (state === 'date_off' || state === 'holiday') cls = 'labdot-bg-off';
        else if (state && state !== 'out_of_range') cls = 'labdot-bg-closed';
        if (!cls) continue;
        out.push({
          id: `avbg-${toYmd(slotDate)}-${hour}`,
          start: slotDate,
          end: new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour + 1, 0, 0),
          display: 'background',
          classNames: [cls],
          extendedProps: { availabilityBg: true },
        });
      }
    }
    return out;
  }, [getSlotLaneState, viewType, viewDate, scheduleSettingsStamp]);

  const calendarEvents = useMemo(
    () => [...(events || []), ...availabilityBgEvents],
    [events, availabilityBgEvents]
  );

  const offDateSet = useMemo(() => {
    const off = new Set(overlayEvents.map((ev) => toYmd(ev.start)));
    const busy = new Set(
      (events || [])
        .map((ev) => (ev.start instanceof Date ? toYmd(ev.start) : null))
        .filter(Boolean)
    );
    off.forEach((k) => {
      if (busy.has(k)) off.delete(k);
    });
    return off;
  }, [overlayEvents, events]);

  // 안 C: 월 보기 날짜별 수업 수 + 처리 필요(예약처리 차단) 건수
  const monthCounts = useMemo(() => {
    const counts = {};
    (events || []).forEach((ev) => {
      const s = ev.start instanceof Date ? ev.start : new Date(ev.start);
      if (Number.isNaN(s.getTime())) return;
      const key = toYmd(s);
      if (!counts[key]) counts[key] = { total: 0, attention: 0 };
      counts[key].total += 1;
      if (ev.extendedProps?.isBlock && ev.extendedProps?.block?.kind !== 'hold') {
        counts[key].attention += 1;
      }
    });
    return counts;
  }, [events]);

  // 주간 총 수업 횟수 (보이는 주 기준, 차단/휴무 제외, 실시간 refetch와 함께 갱신)
  const weekStats = useMemo(() => {
    const monday = getMonday(viewDate);
    const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    let total = 0;
    let done = 0;
    (events || []).forEach((ev) => {
      if (ev.extendedProps?.isBlock) return;
      const st = ev.start instanceof Date ? ev.start : new Date(ev.start);
      if (Number.isNaN(st.getTime()) || st < start || st >= end) return;
      total += 1;
      if (ev.extendedProps?.item?.status === 'Completed') done += 1;
    });
    return { total, done, start, end };
  }, [events, viewDate]);

  // 월간 총 수업 횟수 (보이는 달 기준, 차단/휴무 제외, 실시간 refetch와 함께 갱신)
  const monthStats = useMemo(() => {
    const start = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const end = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
    let total = 0;
    let done = 0;
    (events || []).forEach((ev) => {
      if (ev.extendedProps?.isBlock) return;
      const st = ev.start instanceof Date ? ev.start : new Date(ev.start);
      if (Number.isNaN(st.getTime()) || st < start || st >= end) return;
      total += 1;
      if (ev.extendedProps?.item?.status === 'Completed') done += 1;
    });
    const nowD = new Date();
    const isCurrent = nowD.getFullYear() === start.getFullYear() && nowD.getMonth() === start.getMonth();
    return { total, done, label: isCurrent ? '이번 달' : `${start.getMonth() + 1}월` };
  }, [events, viewDate]);

  const handleDatesSet = useCallback((arg) => {
    if (arg?.view?.type) setViewType(arg.view.type);
    const d = arg?.view?.currentStart;
    if (d instanceof Date && !Number.isNaN(d.getTime())) setViewDate(d);
  }, []);

  const selectTab = useCallback(
    (key) => {
      if (key === 'agenda') {
        setViewMode('agenda');
        return;
      }
      setViewMode('calendar');
      const api = calRef.current?.getApi?.();
      if (api) {
        api.changeView(key, agendaDate);
        setTimeout(() => api.updateSize(), 50);
      }
    },
    [agendaDate]
  );

  const handleAgendaSelectDate = useCallback(
    (d) => {
      setAgendaDate(d);
      if (viewMode === 'calendar') {
        calRef.current?.getApi?.()?.gotoDate(d);
      }
    },
    [viewMode]
  );

  const validRange = useMemo(() => {
    const end = new Date();
    end.setFullYear(end.getFullYear() + 1);
    return { start: '2000-01-01', end: end.toISOString().slice(0, 10) };
  }, []);

  const fetchVisibleWeekBookings = useCallback(async () => {
    const api = calRef.current?.getApi?.() ?? null;
    const anchor = api ? api.getDate() : agendaDate;
    const monday = getMonday(anchor);
    const weekEndExcl = new Date(monday);
    weekEndExcl.setDate(weekEndExcl.getDate() + 7);
    const startKey = toYmd(monday);
    const endKey = toYmd(new Date(weekEndExcl.getTime() - 86400000));

    const { data, error } = await supabase
      .from('bookings')
      .select('date, time, status, user_id, profiles(name)')
      .gte('date', startKey)
      .lte('date', endKey)
      .order('date', { ascending: true })
      .order('time', { ascending: true });

    if (error) throw error;
    const rows = (data || []).filter((b) => b && b.status !== 'cancelled');
    return { monday, weekEndExcl, rows };
  }, [agendaDate]);

  const handleExportWeeklyXlsx = async () => {
    setExporting(true);
    try {
      const payload = await fetchVisibleWeekBookings();
      if (!payload) return;
      downloadWeeklyScheduleXlsx(payload.monday, payload.weekEndExcl, payload.rows);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[weekly export]', e);
      window.alert('엑셀을 만들 수 없습니다. ' + msg);
    } finally {
      setExporting(false);
    }
  };

  const handleCopyWeeklyTsv = async () => {
    setCopying(true);
    try {
      const payload = await fetchVisibleWeekBookings();
      if (!payload) return;

      const built = buildWeeklyTimetableAoa(payload.monday, payload.weekEndExcl, payload.rows);
      if (!built?.aoa?.length) {
        showToast('복사할 일정 데이터가 없습니다.');
        return;
      }

      const result = await copyWeeklyScheduleAoaToClipboard(built);
      showToast(
        result.mode === 'html'
          ? '주간 일정이 복사되었습니다. 붙여넣기(Cmd+V) 시 테두리·합계 수식이 적용됩니다.'
          : '주간 일정이 복사되었습니다. 스프레드시트에 붙여넣기(Cmd+V) 하세요.',
      );
    } catch (e) {
      console.error('[weekly copy]', e);
      showToast('클립보드 복사에 실패했습니다.');
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="space-y-3">
      {onSlotClick ? (
        <div className="rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-50/90 to-white px-4 py-3 space-y-2.5">
          <p className="text-xs text-slate-600 leading-relaxed">
            <span className="font-semibold text-[#064e3b]">빈 칸 탭</span>
            <span className="text-slate-400 mx-1">→</span>
            「이 날짜·이 시간만 켜기/끄기」로 평일 휴일 시간도 그날만 바꿀 수 있습니다.
            「매주 켜기/끄기」는 모든 주에 적용됩니다.
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] font-medium text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-5 rounded-sm bg-[#064e3b]" aria-hidden />
              수업
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-5 rounded-sm bg-white ring-2 ring-rose-300" aria-hidden />
              예약처리(차단)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-5 rounded-sm bg-slate-200" aria-hidden />
              휴무
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-5 rounded-sm bg-emerald-100 ring-1 ring-emerald-300/80" aria-hidden />
              예약 가능
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-5 rounded-sm ring-1 ring-rose-400/80 labdot-legend-date-off" aria-hidden />
              이 날짜만 꺼짐
            </span>
          </div>
        </div>
      ) : null}

      <div className="labdot-view-switch" role="tablist" aria-label="일정 보기 방식">
        {VIEW_TABS.map((t) => {
          const on = t.key === 'agenda' ? viewMode === 'agenda' : viewMode === 'calendar' && viewType === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              className={on ? 'on' : ''}
              onClick={() => selectTab(t.key)}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
        <button
          type="button"
          onClick={handleCopyWeeklyTsv}
          disabled={loading || copying || exporting}
          className="inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-[48px] px-5 rounded-xl font-semibold text-sm
            bg-white text-slate-900 border border-gray-200 shadow-sm
            hover:bg-gray-50 active:scale-[0.99] transition-all
            disabled:opacity-50 disabled:cursor-not-allowed
            focus:outline-none focus:ring-2 focus:ring-[#064e3b]/20 focus:ring-offset-2"
        >
          <ClipboardCopy className="h-4 w-4 shrink-0" strokeWidth={2.25} />
          {copying ? '복사 중…' : '주간 일정 복사하기'}
        </button>
        <button
          type="button"
          onClick={handleExportWeeklyXlsx}
          disabled={loading || exporting || copying}
          className="inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-[48px] px-5 rounded-xl font-semibold text-sm
            bg-[#064e3b] text-white border border-[#043d2d] shadow-sm shadow-emerald-900/20
            hover:bg-[#043d2d] active:scale-[0.99] transition-all
            disabled:opacity-50 disabled:cursor-not-allowed
            focus:outline-none focus:ring-2 focus:ring-[#064e3b]/30 focus:ring-offset-2"
        >
          <Download className="h-4 w-4 shrink-0" strokeWidth={2.25} />
          {exporting ? '파일 만드는 중…' : '주간 일정 엑셀 다운로드'}
        </button>
      </div>

      {viewMode === 'agenda' ? (
        <div className="labdot-fc-wrap relative rounded-2xl border border-[#064e3b]/15 bg-white shadow-sm overflow-hidden p-3">
          {loading && (
            <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
              <p className="text-sm font-medium text-[#064e3b]">일정 불러오는 중…</p>
            </div>
          )}
          <AdminDayAgenda
            date={agendaDate}
            onSelectDate={handleAgendaSelectDate}
            events={calendarEvents}
            onEventClick={onEventClick}
          />
        </div>
      ) : null}

      {viewMode === 'calendar' && viewType === 'timeGridWeek' ? (
        <div className="labdot-week-stat" role="status">
          이번 주 총 수업 <b>{weekStats.total}건</b>
          <span>완료 {weekStats.done} · 예약 {weekStats.total - weekStats.done}</span>
        </div>
      ) : null}

      {viewMode === 'calendar' && viewType === 'dayGridMonth' ? (
        <div className="labdot-week-stat" role="status">
          {monthStats.label} 총 수업 <b>{monthStats.total}건</b>
          <span>완료 {monthStats.done} · 예약 {monthStats.total - monthStats.done}</span>
        </div>
      ) : null}

      <div
        className={`labdot-fc-wrap relative rounded-2xl border border-[#064e3b]/15 bg-white shadow-sm overflow-hidden ${viewMode === 'agenda' ? 'labdot-cal-hidden' : ''}`}
      >
        {loading && (
          <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
            <p className="text-sm font-medium text-[#064e3b]">일정 불러오는 중…</p>
          </div>
        )}
        <FullCalendar
          key={scheduleSettingsStamp || 'cal'}
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView={viewType}
          initialDate={viewDate}
          datesSet={handleDatesSet}
          locale={koLocale}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: '',
          }}
          buttonText={{
            today: '오늘',
            month: '월',
            week: '주',
            day: '일',
            list: '목록',
          }}
          titleFormat={{ year: 'numeric', month: 'long' }}
          dayHeaderFormat={{ weekday: 'short', month: 'numeric', day: 'numeric' }}
          views={{ dayGridMonth: { dayHeaderFormat: { weekday: 'short' } } }}
          slotMinTime="07:00:00"
          slotMaxTime="23:00:00"
          allDaySlot={false}
          slotDuration="01:00:00"
          slotLabelInterval="01:00:00"
          snapDuration="01:00:00"
          slotMinHeight={52}
          firstDay={1}
          slotLaneClassNames={(arg) => {
            const d = arg?.date;
            if (!d) return [];
            // 슬롯 가용/비활성 색상은 요일별 배경 이벤트(availabilityBgEvents)가 그린다.
            // FullCalendar slotLane은 주 전체를 가로지르는 한 행이라 요일별 칠하기가 불가능하다.
            const classes = ['labdot-slot-hour'];
            if (onSlotClick) classes.push('labdot-slot-clickable');
            return classes;
          }}
          expandRows
          height="auto"
          contentHeight={typeof window !== 'undefined' && window.innerWidth < 640 ? 520 : 640}
          weekends
          events={calendarEvents}
          eventClick={(info) => {
            info.jsEvent.preventDefault();
            if (info?.event?.extendedProps?.isAvailability) {
              if (!onSlotClick) return;
              onSlotClick({ date: info.event.start, jsEvent: info.jsEvent });
              return;
            }
            if (onEventClick) onEventClick(info);
          }}
          dateClick={(info) => {
            if (info?.view?.type === 'dayGridMonth') {
              setAgendaDate(info.date);
              setViewMode('agenda');
              return;
            }
            if (!onSlotClick) return;
            info.jsEvent.preventDefault();
            onSlotClick(info);
          }}
          eventContent={(arg) => {
            if (arg.view.type === 'dayGridMonth' || arg.view.type.startsWith('list')) return true;
            // 슬롯 가용/비활성 배경 이벤트는 텍스트 없이 면 색만
            if (arg.event.extendedProps?.availabilityBg) return { html: '' };
            const s = arg.event.start;
            const hm = s ? `${pad2(s.getHours())}:${pad2(s.getMinutes())}` : arg.timeText;
            return {
              html: `<div class="labdot-ev"><span class="labdot-ev-t">${hm}</span><span class="labdot-ev-n">${escapeHtml(arg.event.title)}</span></div>`,
            };
          }}
          dayCellContent={(arg) => {
            if (arg.view.type !== 'dayGridMonth') return undefined;
            const c = monthCounts[toYmd(arg.date)];
            return {
              html:
                `<div class="labdot-month-cell"><span class="labdot-month-d">${escapeHtml(arg.dayNumberText)}</span>` +
                (c
                  ? `<span class="labdot-month-n">${c.total}${c.attention ? `<em>${c.attention}</em>` : ''}</span>`
                  : '') +
                `</div>`,
            };
          }}
          dayCellClassNames={(arg) =>
            arg.view?.type === 'dayGridMonth' && offDateSet.has(toYmd(arg.date))
              ? ['labdot-month-off']
              : []
          }
          eventDisplay="block"
          dayMaxEvents
          nowIndicator
          validRange={validRange}
        />
      </div>
    </div>
  );
};

export default AdminScheduleFullCalendar;
