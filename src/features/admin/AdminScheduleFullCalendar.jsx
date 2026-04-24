import React, { useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import koLocale from '@fullcalendar/core/locales/ko';
import './adminScheduleCalendar.css';

/**
 * @param {object} props
 * @param {import('@fullcalendar/core').EventInput[]} props.events
 * @param {(info: import('@fullcalendar/core').EventClickArg) => void} props.onEventClick
 * @param {boolean} [props.loading]
 * @param {Date} [props.initialDate]
 */
const AdminScheduleFullCalendar = ({ events, onEventClick, loading, initialDate }) => {
  const validRange = useMemo(() => {
    const end = new Date();
    end.setFullYear(end.getFullYear() + 1);
    return { start: '2000-01-01', end: end.toISOString().slice(0, 10) };
  }, []);

  return (
    <div className="labdot-fc-wrap relative rounded-2xl border border-[#064e3b]/15 bg-white shadow-sm overflow-hidden">
      {loading && (
        <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
          <p className="text-sm font-medium text-[#064e3b]">일정 불러오는 중…</p>
        </div>
      )}
      <FullCalendar
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
  );
};

export default AdminScheduleFullCalendar;
