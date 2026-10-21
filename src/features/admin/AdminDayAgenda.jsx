import React, { useMemo } from 'react';

const DOW_KO = ['일', '월', '화', '수', '목', '금', '토'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function mondayOf(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return x;
}

function eventTimeText(ev) {
  const s = ev.start instanceof Date ? ev.start : new Date(ev.start);
  if (Number.isNaN(s.getTime())) return '';
  return `${pad2(s.getHours())}:${pad2(s.getMinutes())}`;
}

function describeEvent(ev) {
  const p = ev.extendedProps || {};
  if (p.isBlock) {
    const hold = p.block?.kind === 'hold';
    return {
      kind: hold ? 'off' : 'wait',
      name: ev.title || (hold ? '휴무' : '예약처리'),
      sub: hold ? '휴무(차단) · 회원 예약 막힘' : '예약처리(OT) · 회원 예약 막힘',
      badge: hold ? '휴무' : '차단',
    };
  }
  const done = p.item?.status === 'Completed';
  return {
    kind: done ? 'done' : 'ok',
    name: ev.title ? `${ev.title} 회원` : '회원',
    sub: done ? '수업 완료' : 'PT · 예약됨',
    badge: done ? '완료' : '예약',
  };
}

/**
 * 안 A — 일 단위 아젠다 (모바일 기본 뷰)
 * @param {object} props
 * @param {Date} props.date
 * @param {(d: Date) => void} props.onSelectDate
 * @param {import('@fullcalendar/core').EventInput[]} props.events
 * @param {(info: { event: { extendedProps: object } }) => void} props.onEventClick
 */
export default function AdminDayAgenda({ date, onSelectDate, events, onEventClick }) {
  const dayKey = toKey(date);
  const weekStart = mondayOf(date);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart.getTime()]);

  const dayEvents = useMemo(() => {
    return (events || [])
      .filter((ev) => {
        const p = ev.extendedProps || {};
        if (p.availabilityBg || p.isAvailability || ev.display === 'background') return false;
        const s = ev.start instanceof Date ? ev.start : new Date(ev.start);
        return !Number.isNaN(s.getTime()) && toKey(s) === dayKey;
      })
      .sort((a, b) => new Date(a.start) - new Date(b.start));
  }, [events, dayKey]);

  const move = (delta) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    onSelectDate(d);
  };

  return (
    <div className="labdot-agenda">
      <div className="labdot-agenda-head">
        <button type="button" onClick={() => move(-1)} aria-label="이전 날">‹</button>
        <p>
          {date.getMonth() + 1}월 {date.getDate()}일 ({DOW_KO[date.getDay()]})
        </p>
        <button type="button" onClick={() => move(1)} aria-label="다음 날">›</button>
      </div>
      <div className="labdot-agenda-days">
        {weekDays.map((d) => {
          const on = toKey(d) === dayKey;
          return (
            <button
              key={toKey(d)}
              type="button"
              className={on ? 'on' : ''}
              onClick={() => onSelectDate(new Date(d))}
            >
              {DOW_KO[d.getDay()]} {d.getDate()}
            </button>
          );
        })}
      </div>
      {dayEvents.length === 0 ? (
        <div className="labdot-agenda-empty">이 날은 일정이 없습니다.</div>
      ) : (
        dayEvents.map((ev) => {
          const d = describeEvent(ev);
          return (
            <button
              key={ev.id}
              type="button"
              className={`labdot-agenda-row k-${d.kind}`}
              onClick={() => onEventClick?.({ event: { extendedProps: ev.extendedProps || {} } })}
            >
              <span className="t">{eventTimeText(ev)}</span>
              <span className="info">
                <span className="name">{d.name}</span>
                <span className="sub">{d.sub}</span>
              </span>
              <span className={`badge b-${d.kind}`}>{d.badge}</span>
            </button>
          );
        })
      )}
    </div>
  );
}
