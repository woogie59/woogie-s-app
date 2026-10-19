import React, { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import LabDotBrand from '../../components/ui/LabDotBrand';

/**
 * 내 운동 기록 (짐매니오 /m/workout 이식) — 테스트용1 전용.
 * 표시 데이터는 QA 샘플 + 기록 버튼은 화면 상태에만 반영.
 * 실제 조회/저장은 운동 기록 DB 테이블 승인 후 연결.
 */
const WORKOUT_PARTS = ['가슴', '등', '하체', '어깨', '팔', '코어', '유산소'];
const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

const SAMPLE_ENTRIES = [
  { id: 's1', at: '2026-09-28T07:40:00+09:00', kind: 'personal', parts: ['하체'] },
  { id: 's2', at: '2026-10-05T07:30:00+09:00', kind: 'personal', parts: ['가슴'] },
  { id: 's3', at: '2026-10-07T18:00:00+09:00', kind: 'pt', parts: [] },
  { id: 's4', at: '2026-10-09T08:10:00+09:00', kind: 'personal', parts: ['등', '팔'] },
  { id: 's5', at: '2026-10-12T18:00:00+09:00', kind: 'pt', parts: [] },
  { id: 's6', at: '2026-10-14T07:30:00+09:00', kind: 'personal', parts: ['어깨'] },
  { id: 's7', at: '2026-10-16T18:00:00+09:00', kind: 'pt', parts: [] },
  { id: 's8', at: '2026-10-18T09:20:00+09:00', kind: 'personal', parts: ['하체', '유산소'] },
];

const kstYmd = (iso) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
const kstHour = (iso) =>
  Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', hourCycle: 'h23' }).format(new Date(iso)));
const kstTime = (iso) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));

const addDays = (ymd, delta) => {
  const d = new Date(`${ymd}T12:00:00+09:00`);
  d.setUTCDate(d.getUTCDate() + delta);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
};

const shiftMonth = (month, delta) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

/** 짐매니오 workoutSummary 이식: 이번 달/지난주→이번 주 횟수 + 요일·시간대 패턴 */
function workoutSummary(entries, month, today) {
  const dow = new Date(`${today}T12:00:00+09:00`).getUTCDay();
  const monday = addDays(today, -(dow === 0 ? 6 : dow - 1));
  const lastMonday = addDays(monday, -7);
  const monthly = entries.filter((e) => kstYmd(e.at).startsWith(month) && kstYmd(e.at) <= today);
  const current = entries.filter((e) => { const d = kstYmd(e.at); return d >= monday && d <= today; });
  const last = entries.filter((e) => { const d = kstYmd(e.at); return d >= lastMonday && d < monday; });
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const days = new Map();
  const times = new Map();
  for (const e of monthly) {
    const d = kstYmd(e.at);
    const day = dayNames[new Date(`${d}T12:00:00+09:00`).getUTCDay()];
    const hour = kstHour(e.at);
    const time = hour < 6 ? '새벽 (0-6시)' : hour < 12 ? '오전 (6-12시)' : hour < 18 ? '오후 (12-18시)' : '저녁 (18-24시)';
    days.set(day, (days.get(day) ?? 0) + 1);
    times.set(time, (times.get(time) ?? 0) + 1);
  }
  const top = (map) => {
    const n = Math.max(0, ...map.values());
    return n ? { labels: [...map].filter(([, v]) => v === n).map(([k]) => k), count: n } : null;
  };
  return { monthly, count: monthly.length, current: current.length, last: last.length, weekday: top(days), time: top(times) };
}

export default function MemberWorkoutLog({ setView, goBack }) {
  const today = useMemo(() => kstYmd(new Date().toISOString()), []);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [entries, setEntries] = useState(SAMPLE_ENTRIES);
  const [selected, setSelected] = useState(today);
  const [parts, setParts] = useState([]);
  const [saved, setSaved] = useState(false);

  const summary = useMemo(() => workoutSummary(entries, month, today), [entries, month, today]);
  const [year, m] = month.split('-').map(Number);
  const firstDow = new Date(`${month}-01T12:00:00+09:00`).getUTCDay();
  const offset = firstDow === 0 ? 6 : firstDow - 1;
  const days = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const dayRows = summary.monthly.filter((e) => kstYmd(e.at) === selected);
  const todayEntry = entries.find((e) => e.kind === 'personal' && kstYmd(e.at) === today);
  const todayPersonal = Boolean(todayEntry) || saved;
  const ptCount = summary.monthly.filter((e) => e.kind === 'pt').length;
  const personalCount = summary.count - ptCount;

  const goHome = () => (goBack ? goBack() : setView('client_home'));

  function save() {
    if (todayEntry) {
      setEntries((old) => old.map((e) => (e.id === todayEntry.id ? { ...e, parts } : e)));
    } else {
      setEntries((old) => [...old, { id: `local-${Date.now()}`, at: new Date().toISOString(), kind: 'personal', parts }]);
    }
    setSaved(true);
    setSelected(today);
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50 text-slate-900 flex flex-col pb-safe font-sans antialiased">
      <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-start gap-2 px-5 pt-5 pb-3">
        <div className="flex items-center">
          <button type="button" onClick={goHome} aria-label="뒤로" className="p-2 -ml-2 rounded-xl text-gray-500 hover:text-slate-900 transition-colors">
            <ArrowLeft size={20} strokeWidth={1.5} />
          </button>
        </div>
        <div className="flex min-w-0 flex-col items-center text-center">
          <LabDotBrand variant="header" />
          <p className="mt-2.5 mb-2 text-xs font-light tracking-[0.12em] text-gray-500">내 운동 기록</p>
        </div>
        <div className="flex items-center justify-end">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-800">테스트</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col px-5 gap-4 pb-6 overflow-y-auto scrollable min-h-0">
        <section className="rounded-2xl bg-gradient-to-r from-[#0f2818] to-[#1a4026] p-5 text-white shadow-lg border border-white/10" aria-label="운동 기록 횟수">
          <p className="text-sm text-white/80">{month === today.slice(0, 7) ? '이번 달' : `${year}년 ${m}월`} 운동 기록</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{summary.count}회</p>
          <p className="mt-2 text-sm text-white/80">PT {ptCount} · 개인운동 {personalCount}</p>
          <div className="mt-4 border-t border-white/15 pt-3">
            <p className="text-sm">지난주 {summary.last}회 <span aria-hidden="true">→</span> 이번 주 {summary.current}회</p>
            <p className="mt-1 text-xs text-white/80">월요일 시작 · 이번 주는 오늘까지</p>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4" aria-label="월별 운동 달력">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button type="button" aria-label="이전 달" onClick={() => setMonth(shiftMonth(month, -1))} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-gray-700">‹</button>
            <h2 className="text-base font-semibold">{year}년 {m}월</h2>
            {month < today.slice(0, 7) ? (
              <button type="button" aria-label="다음 달" onClick={() => setMonth(shiftMonth(month, 1))} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-gray-700">›</button>
            ) : (
              <span className="flex min-h-11 min-w-11 items-center justify-center text-gray-300" aria-hidden="true">›</span>
            )}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500">
            {WEEKDAYS.map((d) => <span key={d} className="py-2">{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: offset }, (_, i) => <span key={`blank${i}`} />)}
            {Array.from({ length: days }, (_, i) => {
              const date = `${month}-${String(i + 1).padStart(2, '0')}`;
              const rows = summary.monthly.filter((e) => kstYmd(e.at) === date);
              const pt = rows.filter((e) => e.kind === 'pt').length;
              const personal = rows.length - pt;
              const isSelected = date === selected;
              return (
                <button
                  key={date}
                  type="button"
                  disabled={date > today}
                  aria-pressed={isSelected}
                  aria-label={`${m}월 ${i + 1}일, PT ${pt}회, 개인운동 ${personal}회${date === today ? ', 오늘' : ''}`}
                  onClick={() => setSelected(date)}
                  className={`flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl text-sm ${isSelected ? 'bg-[#064e3b] text-white' : date === today ? 'bg-emerald-50 text-[#064e3b]' : 'text-gray-700'} disabled:text-gray-300`}
                >
                  <span>{i + 1}</span>
                  <span aria-hidden="true" className="flex h-1.5 gap-1">
                    {pt > 0 && <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-[#064e3b]'}`} />}
                    {personal > 0 && <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-sky-200' : 'bg-sky-600'}`} />}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-gray-600">
            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#064e3b]" aria-hidden="true" /> PT
            <span className="ml-3 mr-1 inline-block h-1.5 w-1.5 rounded-full bg-sky-600" aria-hidden="true" /> 개인운동
          </p>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4" aria-labelledby="personal-workout">
          <h2 id="personal-workout" className="font-semibold">오늘 개인운동</h2>
          {todayPersonal && <p role="status" className="mt-3 text-sm text-[#064e3b]">기록 완료</p>}
          <p className="mt-2 text-xs text-gray-600">운동 부위 (선택)</p>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="운동 부위 선택 (선택 사항)">
            {WORKOUT_PARTS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={parts.includes(p)}
                onClick={() => setParts((old) => (old.includes(p) ? old.filter((x) => x !== p) : [...old, p]))}
                className={`min-h-11 rounded-full border px-3 text-sm ${parts.includes(p) ? 'border-[#064e3b] bg-emerald-50 text-[#064e3b]' : 'border-gray-200 text-gray-600'}`}
              >
                {p}
              </button>
            ))}
          </div>
          <button type="button" onClick={save} className="mt-3 min-h-12 w-full rounded-xl bg-[#064e3b] px-4 text-sm font-semibold text-white">
            {todayPersonal ? '부위 저장' : '오늘 개인운동 기록'}
          </button>
          <p className="mt-2 text-xs text-gray-500">직접 기록 · 하루 1회 · 테스트 화면이라 새로고침하면 사라져요</p>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4" aria-labelledby="workout-day">
          <h2 id="workout-day" className="font-semibold">
            {Number(selected.slice(5, 7))}월 {Number(selected.slice(8))}일 ({WEEKDAYS[(new Date(`${selected}T12:00:00+09:00`).getUTCDay() + 6) % 7]})
          </h2>
          <div aria-live="polite" aria-atomic="true">
            {dayRows.length ? (
              <ul className="mt-2 divide-y divide-gray-100">
                {dayRows.map((e) => (
                  <li key={e.id} className="py-3">
                    <p className="text-sm font-medium">{kstTime(e.at)} · {e.kind === 'pt' ? 'PT' : '개인운동'}</p>
                    {e.parts.length > 0 && <p className="mt-1 break-words text-sm text-gray-600">{e.parts.join(' · ')}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-gray-500">운동 기록이 없습니다.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">{m}월 운동 패턴</h2>
            <span className="text-xs text-gray-500">운동 기록 {summary.count}회 기준</span>
          </div>
          {summary.count ? (
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">자주 운동한 요일</dt>
                <dd className="mt-1 font-medium">{summary.weekday?.labels.join(' · ')}요일 <span className="font-normal text-gray-500">(각 {summary.weekday?.count}회)</span></dd>
              </div>
              <div>
                <dt className="text-gray-500">자주 운동한 시간대</dt>
                <dd className="mt-1 font-medium">{summary.time?.labels.join(' · ')} <span className="font-normal text-gray-500">(각 {summary.time?.count}회)</span></dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-gray-500">운동 기록이 쌓이면 표시됩니다.</p>
          )}
        </section>
      </main>
    </div>
  );
}
