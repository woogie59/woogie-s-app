import { createContext, useContext } from 'react';

// Opt-in is resolved only from the authenticated profile. Never from URL/storage.
export const isDesignRefinementEnabled = (profile) =>
  profile?.name === '테스트2' && profile?.role === 'user';

export const DesignRefinementContext = createContext({ enabled: false, setEnabled: () => {} });
export const useDesignRefinement = () => useContext(DesignRefinementContext);

export const formatBookingDateKo = (date, time = '') => {
  const [y, m, d] = String(date || '').slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return date || '';
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][new Date(y, m - 1, d).getDay()];
  return `${m}월 ${d}일 (${weekday})${time ? ` ${String(time).slice(0, 5)}` : ''}`;
};

