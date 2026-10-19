import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import LabDotBrand from '../../components/ui/LabDotBrand';
import { supabase } from '../../lib/supabaseClient';
import { isAttendanceLogCompletedForBalance } from '../../utils/sessionHelpers';

/**
 * 내 운동 기록 (짐매니오 /m/workout 이식) — 테스트용1 전용.
 * 개인운동: member_workout_entries 테이블 (본인 행만, RLS).
 * PT: 기존 attendance_logs의 완료 출석에서 파생.
 */
const WORKOUT_PARTS = ['가슴', '등', '하체', '어깨', '팔', '코어', '유산소'];
const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

const kstYmd = (iso) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
const kstHour = (iso) =>
  Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', hourCycle: 'h23' }).format(new Date(iso)));
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

export default function MemberWorkoutLog({ user, setView, goBack }) {
  const today = useMemo(() => kstYmd(new Date().toISOString()), []);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState(today);
  const [parts, setParts] = useState([]);
  const [ptParts, setPtParts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setLoadError(false);
    try {
      const [weRes, logsRes] = await Promise.all([
        supabase.from('member_workout_entries').select('id, at, kind, parts').eq('user_id', user.id).order('at', { ascending: true }),
        supabase.from('attendance_logs').select('id, status, check_in_at').eq('user_id', user.id),
      ]);
      if (weRes.error) throw weRes.error;
      const personal = (weRes.data || []).filter((r) => r.kind !== 'pt').map((r) => ({ id: r.id, at: r.at, kind: 'personal', parts: r.parts || [] }));
      const ptPartsByDay = new Map();
      for (const r of weRes.data || []) {
        if (r.kind === 'pt') ptPartsByDay.set(kstYmd(r.at), { id: r.id, parts: r.parts || [] });
      }
      const pt = (logsRes.error ? [] : logsRes.data || [])
        .filter((l) => isAttendanceLogCompletedForBalance(l) && l.check_in_at)
        .map((l) => {
          const pp = ptPartsByDay.get(kstYmd(l.check_in_at));
          return { id: `att-${l.id}`, at: l.check_in_at, kind: 'pt', parts: pp?.parts || [], ptEntryId: pp?.id || null };
        });
      setEntries([...personal, ...pt]);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [user?.id, today]);

  useEffect(() => { load(); }, [load]);

  const summary = useMemo(() => workoutSummary(entries, month, today), [entries, month, today]);
  const [year, m] = month.split('-').map(Number);
  const firstDow = new Date(`${month}-01T12:00:00+09:00`).getUTCDay();
  const offset = firstDow === 0 ? 6 : firstDow - 1;
  const days = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const dayRows = summary.monthly.filter((e) => kstYmd(e.at) === selected);
  const selectedEntry = entries.find((e) => e.kind === 'personal' && kstYmd(e.at) === selected);
  // selectedPersonal removed: auto-save replaces the button state

  const selectedPt = dayRows.find((e) => e.kind === 'pt');
  useEffect(() => {
    setParts(selectedEntry?.parts ?? []);
    setPtParts(selectedPt?.parts ?? []);
    // 선택한 날짜가 바뀌면 그 날의 기록을 편집 대상으로 불러온다
  }, [selected, selectedEntry?.id, selectedEntry?.parts, selectedPt?.id, selectedPt?.parts]);
  const ptCount = summary.monthly.filter((e) => e.kind === 'pt').length;
  const personalCount = summary.count - ptCount;

  const goHome = () => (goBack ? goBack() : setView('client_home'));

  async function save(nextParts) {
    if (!user?.id || saving) return;
    const toSave = nextParts ?? parts;
    setSaving(true);
    setSaveError(null);
    try {
      if (selectedEntry) {
        const { error } = await supabase.from('member_workout_entries').update({ parts: toSave }).eq('id', selectedEntry.id);
        if (error) throw error;
        setEntries((old) => old.map((e) => (e.id === selectedEntry.id ? { ...e, parts: toSave } : e)));
      } else {
        const now = new Date();
        const hhmmss = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(now);
        const row = { user_id: user.id, at: new Date(`${selected}T${hhmmss}+09:00`).toISOString(), kind: 'personal', parts: toSave };
        const { data, error } = await supabase.from('member_workout_entries').insert([row]).select().single();
        if (error) throw error;
        setEntries((old) => [...old, { id: data.id, at: data.at, kind: 'personal', parts: data.parts || [] }]);
      }
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch {
      setSaveError('저장하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  }

  function togglePart(p) {
    if (saving) return;
    const next = parts.includes(p) ? parts.filter((x) => x !== p) : [...parts, p];
    setParts(next);
    save(next);
  }

  async function savePt(nextParts) {
    if (!user?.id || saving || !selectedPt) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (selectedPt.ptEntryId) {
        const { error } = await supabase.from('member_workout_entries').update({ parts: nextParts }).eq('id', selectedPt.ptEntryId);
        if (error) throw error;
        setEntries((old) => old.map((e) => (e.id === selectedPt.id ? { ...e, parts: nextParts } : e)));
      } else {
        const row = { user_id: user.id, at: selectedPt.at, kind: 'pt', parts: nextParts };
        const { data, error } = await supabase.from('member_workout_entries').insert([row]).select().single();
        if (error) throw error;
        setEntries((old) => old.map((e) => (e.id === selectedPt.id ? { ...e, parts: data.parts || [], ptEntryId: data.id } : e)));
      }
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch {
      setSaveError('저장하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  }

  function togglePtPart(p) {
    if (saving) return;
    const next = ptParts.includes(p) ? ptParts.filter((x) => x !== p) : [...ptParts, p];
    setPtParts(next);
    savePt(next);
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
          <p className="mt-2.5 mb-2 text-xs font-light tracking-[0.12em] text-gray-500">운동기록</p>
        </div>
        <div className="flex items-center justify-end">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-800">테스트</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col px-5 gap-4 pb-6 overflow-y-auto scrollable min-h-0">
        {loading ? (
          <p className="mt-8 text-center text-sm text-gray-500">운동 기록을 불러오는 중입니다…</p>
        ) : loadError ? (
          <section role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p>운동 기록을 확인하지 못했습니다.</p>
            <button type="button" onClick={load} className="mt-3 min-h-11 rounded-lg border px-4">다시 시도</button>
          </section>
        ) : (
          <>
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
                  const personalEntry = rows.find((e) => e.kind === 'personal');
                  const personal = rows.length - pt;
                  const isSelected = date === selected;
                  const isToday = date === today;
                  const firstPart = (personalEntry?.parts?.[0] || '개인').slice(0, 2);
                  const ptFirst = rows.find((e) => e.kind === 'pt')?.parts?.[0]?.slice(0, 2) || '';
                  const tint = pt > 0
                    ? 'bg-sky-100 text-sky-900'
                    : personal > 0
                      ? 'bg-emerald-100 text-[#064e3b]'
                      : 'text-gray-700';
                  return (
                    <button
                      key={date}
                      type="button"
                      disabled={date > today}
                      aria-pressed={isSelected}
                      aria-label={`${m}월 ${i + 1}일, PT ${pt}회, 개인운동 ${personal}회${isToday ? ', 오늘' : ''}`}
                      onClick={() => setSelected(date)}
                      className={`flex min-h-[56px] flex-col items-center justify-start gap-1 rounded-xl pt-2 text-sm font-medium ${isSelected ? (pt > 0 ? 'bg-sky-600 text-white' : 'bg-[#064e3b] text-white') : tint} ${isToday && !isSelected ? 'ring-2 ring-[#064e3b]' : ''} disabled:bg-transparent disabled:text-gray-300 disabled:ring-0`}
                    >
                      <span className="leading-none">{i + 1}</span>
                      {((pt > 0 && ptFirst) || (pt === 0 && personal > 0)) && (
                        <span aria-hidden="true" className={`whitespace-nowrap text-[11px] leading-none ${isSelected ? 'text-white/90' : ''}`}>
                          {pt > 0 ? ptFirst : firstPart}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

            </section>

            <section className="rounded-xl border border-gray-200 bg-white px-4 py-2.5" aria-label="운동 기록 요약">
              <p className="text-sm text-gray-700 tabular-nums">
                <span className="font-semibold text-slate-900">{month === today.slice(0, 7) ? '이번 달' : `${m}월`} {summary.count}회</span>
                <span className="text-gray-400"> · </span>PT {ptCount} · 개인운동 {personalCount}
              </p>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-4" aria-labelledby="workout-day">
              <h2 id="workout-day" className="font-semibold flex items-center gap-2">
                {Number(selected.slice(5, 7))}월 {Number(selected.slice(8))}일 ({WEEKDAYS[(new Date(`${selected}T12:00:00+09:00`).getUTCDay() + 6) % 7]}){selected === today ? ' · 오늘' : ''}
                {savedFlash && <span role="status" className="text-xs font-medium text-[#064e3b]">저장됨</span>}
              </h2>
              <div aria-live="polite" aria-atomic="true">
                {dayRows.length ? (
                  <ul className="mt-2 space-y-2">
                    {dayRows.map((e) => (
                      <li key={e.id} className={`flex items-center gap-2 rounded-xl px-3 py-2.5 ${e.kind === 'pt' ? 'bg-sky-50 text-sky-900' : 'bg-emerald-50 text-[#064e3b]'}`}>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${e.kind === 'pt' ? 'bg-sky-100 text-sky-800' : 'bg-emerald-100 text-[#064e3b]'}`}>
                          {e.kind === 'pt' ? 'PT' : '개인운동'}
                        </span>
                        {e.parts?.length > 0 && <p className="text-xs opacity-80">{e.parts.join(' · ')}</p>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-gray-500">운동 기록이 없습니다.</p>
                )}
              </div>
              <div className="mt-3 border-t border-gray-100 pt-3">
                <p className="text-xs text-gray-600">개인운동 부위 (선택)</p>
                <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="운동 부위 선택 (선택 사항)">
                  {WORKOUT_PARTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={parts.includes(p)}
                      onClick={() => togglePart(p)}
                      className={`min-h-11 rounded-full border px-3 text-sm ${parts.includes(p) ? 'border-transparent bg-[#064e3b] font-semibold text-white' : 'border-transparent bg-gray-100 text-gray-600'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                {selectedPt && (
                  <>
                    <p className="mt-4 text-xs text-sky-800">PT 운동부위 (선택)</p>
                    <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="PT 운동 부위 선택 (선택 사항)">
                      {WORKOUT_PARTS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          aria-pressed={ptParts.includes(p)}
                          onClick={() => togglePtPart(p)}
                          className={`min-h-11 rounded-full border px-3 text-sm ${ptParts.includes(p) ? 'border-transparent bg-sky-600 font-semibold text-white' : 'border-transparent bg-gray-100 text-gray-600'}`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <p className="mt-3 text-xs text-gray-500">{saving ? '저장 중…' : '부위를 누르면 바로 저장됩니다'}</p>
                {saveError && <p role="alert" className="mt-2 text-sm text-amber-900">{saveError}</p>}
              </div>
            </section>

            

            
          </>
        )}
      </main>
    </div>
  );
}
