import React, { useCallback, useEffect, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import koLocale from '@fullcalendar/core/locales/ko';
import { ChevronDown, ChevronUp, Download } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { downloadWeeklyScheduleXlsx, getMonday, toYmd } from '../../utils/weeklyScheduleGridExport';
import {
  SATURDAY_OPEN_HOUR,
  detectHiddenEventSlots,
  isDayOpen,
  isSlotFolded,
} from '../../utils/labdotWeekSchedulePolicy';
import './adminScheduleCalendar.css';

function buildSlotCollapseClasses(arg, expandEarly, expandLateWeekend, expandLateWeekday) {
  const d = arg?.date;
  if (!d) return [];
  const classes = [];
  if (d.getDay() === 6 && d.getHours() < SATURDAY_OPEN_HOUR) {
    classes.push('labdot-sat-morning-na');
  }
  if (isSlotFolded(d, expandEarly, expandLateWeekend, expandLateWeekday)) {
    classes.push('labdot-slot-collapsed');
  }
  return classes;
}

/**
 * @param {object} props
 * @param {import('@fullcalendar/core').EventInput[]} props.events
 * @param {(info: import('@fullcalendar/core').EventClickArg) => void} props.onEventClick
 * @param {boolean} [props.loading]
 * @param {Date} [props.initialDate]
 * @param {number} [props.settingsRevision]
 */
const AdminScheduleFullCalendar = ({
  events,
  onEventClick,
  loading,
  initialDate,
  settingsRevision = 0,
}) => {
  const calRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [expandEarly, setExpandEarly] = useState(false);
  const [expandLateWeekend, setExpandLateWeekend] = useState(false);
  const [expandLateWeekday, setExpandLateWeekday] = useState(false);
  const [weekSettings, setWeekSettings] = useState([]);
  const [activeView, setActiveView] = useState('timeGridWeek');

  const isTimeGridView = activeView.startsWith('timeGrid');
  const showLateToggle = !expandLateWeekend || !expandLateWeekday;

  const hiddenCounts = useMemo(() => detectHiddenEventSlots(events), [events]);

  const slotBounds = useMemo(
    () => ({
      slotMinTime: expandEarly ? '00:00:00' : '10:00:00',
      slotMaxTime: expandLateWeekday || expandLateWeekend ? '24:00:00' : '23:00:00',
    }),
    [expandEarly, expandLateWeekday, expandLateWeekend]
  );

  const calendarHeight = useMemo(() => {
    const mobile = typeof window !== 'undefined' && window.innerWidth < 640;
    let hours = 13;
    if (expandEarly) hours += 10;
    if (expandLateWeekend || expandLateWeekday) hours += 1;
    const base = mobile ? 300 : 360;
    return Math.min(mobile ? 560 : 680, base + hours * 22);
  }, [expandEarly, expandLateWeekend, expandLateWeekday]);

  const validRange = useMemo(() => {
    const end = new Date();
    end.setFullYear(end.getFullYear() + 1);
    return { start: '2000-01-01', end: end.toISOString().slice(0, 10) };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('trainer_settings')
        .select('day_of_week, off, available_hours')
        .order('day_of_week');
      if (!cancelled && !error) {
        setWeekSettings(data || []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [settingsRevision]);

  useEffect(() => {
    const { needEarly, needLateWeekend, needLateWeekday } = hiddenCounts;
    if (needEarly && !expandEarly) setExpandEarly(true);
    if (needLateWeekend && !expandLateWeekend) setExpandLateWeekend(true);
    if (needLateWeekday && !expandLateWeekday) setExpandLateWeekday(true);
  }, [hiddenCounts, expandEarly, expandLateWeekend, expandLateWeekday]);

  const slotLaneClassNames = useCallback(
    (arg) => buildSlotCollapseClasses(arg, expandEarly, expandLateWeekend, expandLateWeekday),
    [expandEarly, expandLateWeekend, expandLateWeekday]
  );

  const slotLabelClassNames = useCallback(
    (arg) => {
      const d = arg?.date;
      if (!d) return [];
      const classes = [];
      if (!expandEarly && d.getHours() < 10) classes.push('labdot-slot-collapsed');
      return classes;
    },
    [expandEarly]
  );

  const eventAllow = useCallback(
    (dropInfo) => {
      const start = dropInfo?.start;
      if (!start) return true;
      return !isSlotFolded(start, expandEarly, expandLateWeekend, expandLateWeekday);
    },
    [expandEarly, expandLateWeekend, expandLateWeekday]
  );

  const dayHeaderContent = useCallback(
    (arg) => {
      const dow = arg.date.getDay();
      const open = (dow === 0 || dow === 6) && isDayOpen(weekSettings, dow);
      return (
        <div className="labdot-fc-day-header flex flex-col items-center gap-0.5 py-0.5 leading-tight">
          <span>{arg.text}</span>
          {open ? (
            <span className="rounded px-1 py-0.5 text-[9px] font-bold tracking-wide bg-emerald-600 text-white leading-none">
              OPEN
            </span>
          ) : null}
        </div>
      );
    },
    [weekSettings]
  );

  const handleExportWeeklyXlsx = async () => {
    const api = calRef.current?.getApi?.() ?? null;
    if (!api) {
      window.alert('캘린더를 준비하는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    setExporting(true);
    try {
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
      downloadWeeklyScheduleXlsx(monday, weekEndExcl, rows);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[weekly export]', e);
      window.alert('엑셀을 만들 수 없습니다. ' + msg);
    } finally {
      setExporting(false);
    }
  };

  const expandAllLate = () => {
    setExpandLateWeekend(true);
    setExpandLateWeekday(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
        <button
          type="button"
          onClick={handleExportWeeklyXlsx}
          disabled={loading || exporting}
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

        {isTimeGridView && (
          <div className="labdot-fc-slot-hint px-3 py-2 text-[10px] text-slate-500 border-b border-slate-100 bg-slate-50/80">
            기본 보기 10:00–23:00 (주말 19:00까지) · 접힌 시간은 아래 버튼으로 펼칩니다
          </div>
        )}

        {isTimeGridView && !expandEarly && (
          <button
            type="button"
            className="labdot-fc-expand-btn w-full flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-semibold text-[#064e3b] bg-emerald-50/60 border-b border-emerald-100/80 hover:bg-emerald-50 transition-colors"
            onClick={() => setExpandEarly(true)}
          >
            <ChevronUp className="h-3.5 w-3.5" strokeWidth={2.5} />
            + 00시~09시 일정 보기
            {hiddenCounts.needEarly ? (
              <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white">일정</span>
            ) : null}
          </button>
        )}

        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          initialDate={initialDate}
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
          dayHeaderContent={dayHeaderContent}
          datesSet={(info) => setActiveView(info.view.type)}
          slotMinTime={slotBounds.slotMinTime}
          slotMaxTime={slotBounds.slotMaxTime}
          scrollTime="10:00:00"
          allDaySlot={false}
          slotDuration="00:30:00"
          slotLabelInterval="01:00:00"
          snapDuration="00:15:00"
          firstDay={1}
          slotLaneClassNames={slotLaneClassNames}
          slotLabelClassNames={slotLabelClassNames}
          eventAllow={eventAllow}
          expandRows={false}
          height="auto"
          contentHeight={isTimeGridView ? calendarHeight : undefined}
          weekends
          events={events}
          eventClick={(info) => {
            info.jsEvent.preventDefault();
            if (onEventClick) onEventClick(info);
          }}
          eventDisplay="block"
          dayMaxEvents
          nowIndicator
          validRange={validRange}
        />

        {isTimeGridView && showLateToggle && (
          <button
            type="button"
            className="labdot-fc-expand-btn w-full flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-semibold text-[#064e3b] bg-emerald-50/60 border-t border-emerald-100/80 hover:bg-emerald-50 transition-colors"
            onClick={expandAllLate}
          >
            <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.5} />
            + 마감 이후 일정 보기
            {(hiddenCounts.needLateWeekend || hiddenCounts.needLateWeekday) && (
              <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white">일정</span>
            )}
            {!expandLateWeekend && (
              <span className="ml-0.5 text-[10px] font-normal text-slate-500">(주말 19시~)</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default AdminScheduleFullCalendar;
