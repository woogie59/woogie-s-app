import { createContext, useContext } from 'react';

// User approved all-member rollout after qq account testing on 2026-10-26.
// Administrators and unauthenticated screens keep their existing UI.
export const isDesignRefinementEnabled = (profile) =>
  Boolean(profile?.id) && profile?.role === 'user';

export const DesignRefinementContext = createContext({ enabled: false, setEnabled: () => {} });
export const useDesignRefinement = () => useContext(DesignRefinementContext);

export const formatBookingDateKo = (date, time = '') => {
  const [y, m, d] = String(date || '').slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return date || '';
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][new Date(y, m - 1, d).getDay()];
  return `${m}월 ${d}일 (${weekday})${time ? ` ${String(time).slice(0, 5)}` : ''}`;
};

