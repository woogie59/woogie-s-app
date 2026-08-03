import React, { useMemo, useRef, useState, useCallback } from 'react';
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
import { SATURDAY_OPEN_HOUR } from '../../utils/labdotWeekSchedulePolicy';
import './adminScheduleCalendar.css';

/**
 * @param {object} props
 * @param {import('@fullcalendar/core').EventInput[]} props.events
 * @param {(info: import('@fullcalendar/core').EventClickArg) => void} props.onEventClick
 * @param {boolean} [props.loading]
 * @param {Date} [props.initialDate]
 */
const AdminScheduleFullCalendar = ({ events, onEventClick, loading, initialDate }) => {
  const calRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [copying, setCopying] = useState(false);
  const { showToast } = useGlobalModal();

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

      const result = await copyWeeklyScheduleAoaToClipboard(built.aoa);
      showToast(
        result.mode === 'html'
          ? '주간 일정이 복사되었습니다. 스프레드시트에 붙여넣기(Cmd+V) 하면 테두리가 적용됩니다.'
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
          slotMinTime="06:00:00"
          slotMaxTime="23:00:00"
          allDaySlot={false}
          slotDuration="00:30:00"
          slotLabelInterval="01:00:00"
          snapDuration="00:15:00"
          firstDay={1}
          slotLaneClassNames={(arg) => {
            const d = arg?.date;
            if (!d) return [];
            if (d.getDay() === 6 && d.getHours() < SATURDAY_OPEN_HOUR) {
              return ['labdot-sat-morning-na'];
            }
            return [];
          }}
          expandRows
          height="auto"
          contentHeight={typeof window !== 'undefined' && window.innerWidth < 640 ? 520 : 640}
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
      </div>
    </div>
  );
};

export default AdminScheduleFullCalendar;
