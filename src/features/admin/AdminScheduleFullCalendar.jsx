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
import './adminScheduleCalendar.css';

const SLOT_MIN_HOUR = 7;
const SLOT_MAX_HOUR = 23;

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
  const { showToast } = useGlobalModal();

  useEffect(() => {
    if (initialDate instanceof Date && !Number.isNaN(initialDate.getTime())) {
      setViewDate(initialDate);
    }
  }, [initialDate]);

  const overlayEvents = useMemo(
    () => buildAvailabilityOverlayEvents(getSlotLaneState, viewDate),
    [getSlotLaneState, viewDate, scheduleSettingsStamp]
  );

  const mergedEvents = useMemo(() => [...overlayEvents, ...(events || [])], [overlayEvents, events]);

  const handleDatesSet = useCallback((arg) => {
    if (arg?.view?.type) setViewType(arg.view.type);
    const d = arg?.view?.currentStart;
    if (d instanceof Date && !Number.isNaN(d.getTime())) setViewDate(d);
  }, []);

  const validRange = useMemo(() => {
    const end = new Date();
    end.setFullYear(end.getFullYear() + 1);
    return { start: '2000-01-01', end: end.toISOString().slice(0, 10) };
  }, []);

  const fetchVisibleWeekBookings = useCallback(async () => {
    const api = calRef.current?.getApi?.() ?? null;
    if (!api) {
      window.alert('캘린더를 준비하는 중입니다. 잠시 후 다시 시도해주세요.');
      return null;
    }

    const anchor = api.getDate();
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
  }, []);

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
              <span className="h-3 w-5 rounded-sm bg-emerald-100 ring-1 ring-emerald-300/80" aria-hidden />
              예약 가능
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-5 rounded-sm bg-slate-100 ring-1 ring-slate-300 labdot-legend-closed" aria-hidden />
              주간 비활성
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-5 rounded-sm ring-1 ring-rose-400/80 labdot-legend-date-off" aria-hidden />
              이 날짜만 꺼짐
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-5 rounded-sm bg-[#064e3b]" aria-hidden />
              수업
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-5 rounded-sm bg-slate-500" aria-hidden />
              휴무
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-5 rounded-sm bg-amber-500" aria-hidden />
              OT
            </span>
          </div>
        </div>
      ) : null}
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
      <div className="labdot-fc-wrap relative rounded-2xl border border-[#064e3b]/15 bg-white shadow-sm overflow-hidden">
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
            right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
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
            const classes = ['labdot-slot-hour'];
            if (onSlotClick) classes.push('labdot-slot-clickable');
            if (getSlotLaneState) {
              const state = getSlotLaneState(d);
              if (state === 'available') classes.push('labdot-slot-available');
              else if (state === 'date_off') classes.push('labdot-slot-date-off');
              else if (state === 'holiday') classes.push('labdot-slot-holiday');
              else classes.push('labdot-slot-closed');
            } else if (isSlotAvailable?.(d)) {
              classes.push('labdot-slot-available');
            } else if (isSlotAvailable) {
              classes.push('labdot-slot-closed');
            }
            return classes;
          }}
          expandRows
          height="auto"
          contentHeight={typeof window !== 'undefined' && window.innerWidth < 640 ? 520 : 640}
          weekends
          events={mergedEvents}
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
            if (!onSlotClick) return;
            info.jsEvent.preventDefault();
            onSlotClick(info);
          }}
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
