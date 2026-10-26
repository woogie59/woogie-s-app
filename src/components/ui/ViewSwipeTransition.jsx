import React, { useCallback, useEffect, useRef } from 'react';

/**
 * ViewSwipeTransition
 * - viewKey가 바뀔 때 새 화면에 슬라이드 전환 모션을 적용한다.
 *   forward: 오른쪽에서 밀려 들어옴 / back: 왼쪽에서 밀려 들어옴 (iOS 네이티브 감각)
 * - canGoBack일 때 화면 왼쪽 가장자리(28px)에서 시작하는 가로 스와이프로
 *   뒤로가기를 지원한다. 드래그 중 화면이 손끝을 따라 움직이고,
 *   임계 거리/속도를 넘으면 onSwipeBack을 호출한다.
 * 순수 시각/입력 레이어라 데이터·라우팅 로직에는 관여하지 않는다.
 */

const EDGE_PX = 28;          // 제스처 시작 인식 영역 (좌측)
const TRIGGER_PX = 72;       // 이 거리 이상 밀면 뒤로가기 확정
const FLICK_VELOCITY = 0.45; // px/ms 이상이면 빠른 밀기로 확정
const CANCEL_RATIO = 1.4;    // 가로 우세 판정 비율

export default function ViewSwipeTransition({
  viewKey,
  direction = 'none',
  canGoBack = false,
  onSwipeBack,
  children,
}) {
  const wrapRef = useRef(null);
  const itemRef = useRef(null);
  const gestureRef = useRef(null);
  const stateRef = useRef({ canGoBack, onSwipeBack });

  useEffect(() => {
    stateRef.current = { canGoBack, onSwipeBack };
  }, [canGoBack, onSwipeBack]);

  const resetItemStyle = useCallback(() => {
    const el = itemRef.current;
    if (!el) return;
    el.style.transition = '';
    el.style.transform = '';
    el.style.boxShadow = '';
  }, []);

  const onTouchStart = useCallback((e) => {
    if (!stateRef.current.canGoBack) return;
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    if (t.clientX > EDGE_PX) return;
    gestureRef.current = {
      startX: t.clientX,
      startY: t.clientY,
      dx: 0,
      dy: 0,
      active: false,
      startT: Date.now(),
    };
  }, []);

  const onTouchMove = useCallback((e) => {
    const g = gestureRef.current;
    if (!g || e.touches.length !== 1) return;
    const t = e.touches[0];
    g.dx = t.clientX - g.startX;
    g.dy = t.clientY - g.startY;

    if (!g.active) {
      // 세로 스크롤 의도가 우세하면 제스처 포기
      if (Math.abs(g.dy) > 12 && Math.abs(g.dy) > Math.abs(g.dx)) {
        gestureRef.current = null;
        return;
      }
      if (g.dx > 12 && g.dx > Math.abs(g.dy) * CANCEL_RATIO) {
        g.active = true;
      } else {
        return;
      }
    }

    if (e.cancelable) e.preventDefault();
    const el = itemRef.current;
    if (el) {
      const x = Math.max(0, g.dx);
      el.style.transition = 'none';
      el.style.transform = `translateX(${x}px)`;
      el.style.boxShadow = x > 4 ? '-16px 0 40px rgba(0,0,0,0.18)' : 'none';
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    const g = gestureRef.current;
    gestureRef.current = null;
    if (!g || !g.active) return;

    const dt = Math.max(1, Date.now() - g.startT);
    const velocity = g.dx / dt;
    const commit = g.dx > TRIGGER_PX || velocity > FLICK_VELOCITY;

    const el = itemRef.current;
    if (el) {
      el.style.transition = 'transform 0.22s cubic-bezier(0.32,0.72,0,1), box-shadow 0.22s ease';
      el.style.transform = commit ? 'translateX(100%)' : 'translateX(0px)';
      el.style.boxShadow = 'none';
    }
    if (commit) {
      // 밀려나가는 모션이 보인 뒤 실제 뒤로가기 (들어오는 화면은 왼쪽에서 슬라이드)
      window.setTimeout(() => stateRef.current.onSwipeBack?.(), 140);
    } else {
      window.setTimeout(resetItemStyle, 260);
    }
  }, [resetItemStyle]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    wrap.addEventListener('touchstart', onTouchStart, { passive: true });
    wrap.addEventListener('touchmove', onTouchMove, { passive: false });
    wrap.addEventListener('touchend', onTouchEnd, { passive: true });
    wrap.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      wrap.removeEventListener('touchstart', onTouchStart);
      wrap.removeEventListener('touchmove', onTouchMove);
      wrap.removeEventListener('touchend', onTouchEnd);
      wrap.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [onTouchStart, onTouchMove, onTouchEnd]);

  // 뷰가 바뀌면 드래그 잔여 스타일 정리
  useEffect(() => {
    gestureRef.current = null;
    resetItemStyle();
  }, [viewKey, resetItemStyle]);

  const animClass =
    direction === 'forward'
      ? 'view-anim-forward'
      : direction === 'back'
        ? 'view-anim-back'
        : '';

  return (
    <div ref={wrapRef} className="view-swipe-wrap">
      <div key={viewKey} ref={itemRef} className={`view-swipe-item ${animClass}`}>
        {children}
      </div>
    </div>
  );
}
