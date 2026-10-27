import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * ViewSwipeTransition
 * - viewKey 전환 시 이전 화면을 짧게 유지한 채 두 화면이 겹쳐 움직인다 (iOS 감각).
 *   forward: 새 화면이 오른쪽에서 들어오고, 기존 화면은 왼쪽으로 살짝 밀리며 어두워짐
 *   back: 기존 화면이 오른쪽으로 밀려 나가고, 이전 화면이 왼쪽에서 들어옴
 * - canGoBack일 때 좌측 가장자리(28px) 스와이프로 뒤로가기.
 *   드래그 위치 그대로 이어서 밀려나가므로 중간에 끊기는 느낌이 없다.
 * 순수 시각/입력 레이어. 라우팅·데이터 로직에는 관여하지 않는다.
 */

const EDGE_PX = 28;
const TRIGGER_PX = 72;
const FLICK_VELOCITY = 0.45;
const CANCEL_RATIO = 1.4;
const EXIT_MS = 420;
const EXIT_EASE = 'cubic-bezier(0.32,0.72,0,1)';

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

  // 전환 동안만 유지되는 이전 화면 레이어.
  // effect가 아니라 렌더 중 파생 상태로 처리해야, 화면이 바뀌는 바로 그 렌더에서
  // 이전 화면이 keyed 레이어로 남아 DOM/상태가 그대로 이어진다 (리마운트 깜빡임 방지).
  const [exiting, setExiting] = useState(null); // { key, children, mode }
  const [snapshot, setSnapshot] = useState({ key: viewKey, children });

  if (snapshot.key !== viewKey) {
    // 화면 전환: 나가는 화면을 최신 상태 그대로 레이어에 보존
    if (direction === 'forward' || direction === 'back') {
      setExiting({ key: snapshot.key, children: snapshot.children, mode: direction });
    } else {
      setExiting(null);
    }
    setSnapshot({ key: viewKey, children });
  } else if (snapshot.children !== children) {
    // 같은 화면이면 최신 children으로 갱신해 두어 나갈 때 스냅샷이 신선하도록
    setSnapshot({ key: viewKey, children });
  }

  useEffect(() => {
    if (!exiting) return undefined;
    if (exiting.mode === 'back') {
      // 드래그 위치(또는 0)에서 그대로 100%까지 밀려나가는 애니메이션.
      // key 매칭으로 이동한 같은 DOM 노드라 인라인 transform이 이어진다.
      const el = wrapRef.current?.querySelector('.view-layer-exit-over');
      if (el) {
        requestAnimationFrame(() => {
          el.style.transition = `transform 0.28s ${EXIT_EASE}, box-shadow 0.28s ease`;
          el.style.transform = 'translateX(100%)';
          el.style.boxShadow = 'none';
        });
      }
    }
    const t = window.setTimeout(() => setExiting(null), EXIT_MS);
    return () => window.clearTimeout(t);
  }, [exiting]);

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
        // 진행 중인 진입 애니메이션이 인라인 transform을 덮지 않도록 제거
        const el = itemRef.current;
        if (el) el.classList.remove('view-anim-forward', 'view-anim-back');
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

    if (commit) {
      // 밀려나가는 레이어로 자연스럽게 이어지도록 즉시 뒤로가기
      stateRef.current.onSwipeBack?.();
      return;
    }
    const el = itemRef.current;
    if (el) {
      el.style.transition = `transform 0.22s ${EXIT_EASE}, box-shadow 0.22s ease`;
      el.style.transform = 'translateX(0px)';
      el.style.boxShadow = 'none';
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

  const animClass =
    direction === 'forward'
      ? 'view-anim-forward'
      : direction === 'back'
        ? 'view-anim-back'
        : '';

  return (
    <div ref={wrapRef} className="view-swipe-wrap">
      {exiting && exiting.mode === 'forward' && (
        <div key={exiting.key} className="view-layer-exit-under" aria-hidden="true">
          {exiting.children}
        </div>
      )}
      <div key={viewKey} ref={itemRef} className={`view-swipe-item ${animClass}`}>
        {children}
      </div>
      {exiting && exiting.mode === 'back' && (
        <div key={exiting.key} className="view-layer-exit-over" aria-hidden="true">
          {exiting.children}
        </div>
      )}
    </div>
  );
}
