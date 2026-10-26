import { createContext, useContext } from 'react';

// User selected qq@qq.qq (테스트용1) on 2026-10-26. Verified auth UUID only; never name, URL or storage flags.
export const isDesignRefinementEnabled = (profile) =>
  profile?.id === '54f02379-a548-4bf8-aaf5-150055b6ec1e' && profile?.role === 'user';

export const DesignRefinementContext = createContext({ enabled: false, setEnabled: () => {} });
export const useDesignRefinement = () => useContext(DesignRefinementContext);

export const formatBookingDateKo = (date, time = '') => {
  const [y, m, d] = String(date || '').slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return date || '';
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][new Date(y, m - 1, d).getDay()];
  return `${m}월 ${d}일 (${weekday})${time ? ` ${String(time).slice(0, 5)}` : ''}`;
};

