import React from 'react';

export const formatEndKo = (ymd) =>
  new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' }).format(
    new Date(`${ymd}T00:00:00+09:00`),
  );

export const kstTodayYmd = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

/** 짐매니오 회원 홈 membershipExpiryLabel 이식 (만료까지 N일 / 오늘 만료 / 만료 N일 경과) */
export function membershipPeriodLabel(daysLeft) {
  if (!Number.isSafeInteger(daysLeft)) return '만료일 확인 필요';
  if (daysLeft < 0) return `만료 ${Math.abs(daysLeft)}일 경과`;
  return daysLeft === 0 ? '오늘 만료' : `만료까지 ${daysLeft}일`;
}

/**
 * 회원권 남은 기간 표시 (짐매니오 회원 홈 "회원권" 영역 이식).
 * 현재는 테스트용1의 QA 샘플 값으로만 렌더링 — 실제 종료일은 DB 필드 승인 후 연결.
 */
export default function MembershipPeriodCard({ title, end, badge }) {
  const today = kstTodayYmd();
  const daysLeft = Math.round(
    (Date.parse(`${end}T00:00:00+09:00`) - Date.parse(`${today}T00:00:00+09:00`)) / 86400000,
  );
  return (
    <div className="mt-4 border-t border-white/15 pt-3" aria-label="회원권 기간">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-white/70 font-medium">회원권</p>
        {badge && (
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white/80">{badge}</span>
        )}
      </div>
      <p className="mt-1 text-lg font-semibold text-white">{membershipPeriodLabel(daysLeft)}</p>
      <p className="mt-1 text-xs text-white/70">
        {title} · 만료 {formatEndKo(end)}
      </p>
    </div>
  );
}
