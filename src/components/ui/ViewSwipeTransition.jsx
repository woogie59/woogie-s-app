import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * ViewSwipeTransition
 * - viewKey 전환 시 이전 화면을 짧게 유지한 채 두 화면이 겹쳐 움직인다 (iOS 감각).
 *   forward: 새 화면이 오른쪽에서 들어오고, 기존 화면은 왼쪽으로 살짝 밀리며 어두워짐
 *   back: 기존 화면이 오른쪽으로 밀려 나가고, 이전 화면이 왼쪽에서 들어옴
 * - canGoBack일 때 좌측 가장자리(28px) 스와이프로 뒤로가기.
 *   드래그하는 동안 손가락 아래에 실제 이전 화면(underlay)이 패럴랙스+디밍으로 따라오고,
 *   놓을 때 커밋이든 취소든 드래그 위치에서 끊기지 않고 이어진다.
 * 순수 시각/입력 레이어. 라우팅·데이터 로직에는 관여하지 않는다.
 */

const EDGE_PX = 28;
const TRIGGER_PX = 72;
const FLICK_VELOCITY = 0.45;
const CANCEL_RATIO = 1.4;
const EXIT_MS = 420;
const EXIT_EASE = 'cubic-bezier(0.32,0.72,0,1)';
const PREVIEW_PX = 6; // 이 정도 가로 이동부터 이전 화면 미리보기 마운트
const UNDER_PARALLAX = 0.25; // 아래 화면 패럴랙스 비율
const UNDER_DIM = 0.25;

export default function ViewSwipeTransition({
  viewKey,
  direction = 'none',
  canGoBack = false,
  onSwipeBack,
  onDragPreview,
  underlay = null,
  children,
}) {
  const wrapRef = useRef(null);
  const itemRef = useRef(null);
  const gestureRef = useRef(null);
  // 드래그 커밋 정보: 들어오는 화면이 미리보기 위치에서 이어지게 하는 데 사용
  const commitRef = useRef(null); // { underX }
  const stateRef = useRef({ canGoBack, onSwipeBack, onDragPreview });
  useEffect(() => {
    stateRef.current = { canGoBack, onSwipeBack, onDragPreview };
  }, [canGoBack, onSwipeBack, onDragPreview]);

  // 전환 동안만 유지되는 이전 화면 레이어.
  // effect가 아니라 렌더 중 파생 상태로 처리해야, 화면이 바뀌는 바로 그 렌더에서
  // 이전 화면이 keyed 레이어로 남아 DOM/상태가 그대로 이어진다 (리마운트 깜빡임 방지).
  const [exiting, setExiting] = useState(null); // { key, children, mode }
  const [snapshot, setSnapshot] = useState({ key: viewKey, children, suppressEnter: false });

  if (snapshot.key !== viewKey) {
    // 화면 전환: 나가는 화면을 최신 상태 그대로 레이어에 보존
    if (direction === 'forward' || direction === 'back') {
      setExiting({ key: snapshot.key, children: snapshot.children, mode: direction });
    } else {
      setExiting(null);
    }
    // 드래그 커밋으로 들어오는 화면은 진입 애니메이션 없이 미리보기 위치에서 이어진다
    setSnapshot({ key: viewKey, children, suppressEnter: direction === 'back' && !!commitRef.current });
  } else if (snapshot.children !== children) {
    // 같은 화면이면 최신 children으로 갱신해 두어 나갈 때 스냅샷이 신선하도록
    setSnapshot({ key: viewKey, children, suppressEnter: snapshot.suppressEnter });
  }

  // 드래그 커밋으로 들어오는 화면의 초기 위치를 첫 페인트 전에 미리보기 위치로 맞춘다
  useLayoutEffect(() => {
    if (!exiting || exiting.mode !== 'back') return;
    const commit = commitRef.current;
    if (commit && itemRef.current) {
      itemRef.current.style.transition = 'none';
      itemRef.current.style.transform = `translateX(${commit.underX}px)`;
    }
  }, [exiting]);

  useEffect(() => {
    if (!exiting) return undefined;
    if (exiting.mode === 'back') {
      // 나가는 레이어는 드래그 위치(또는 0)에서 100%까지, 들어오는 화면은
      // 미리보기 위치에서 0까지 — 손가락 동작 그대로 마무리한다.
      const overEl = wrapRef.current?.querySelector('.view-layer-exit-over');
      const itemEl = itemRef.current;
      const commit = commitRef.current;
      requestAnimationFrame(() => {
        if (overEl) {
          overEl.style.transition = `transform 0.28s ${EXIT_EASE}, box-shadow 0.28s ease`;
          overEl.style.transform = 'translateX(100%)';
          overEl.style.boxShadow = 'none';
        }
        if (commit && itemEl) {
          itemEl.style.transition = `transform 0.28s ${EXIT_EASE}`;
          itemEl.style.transform = 'translateX(0px)';
          window.setTimeout(() => {
            itemEl.style.transition = '';
            itemEl.style.transform = '';
          }, 300);
        }
        commitRef.current = null;
      });
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
      previewOn: false,
      underX: null,
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
        if (g.previewOn) stateRef.current.onDragPreview?.(false);
        gestureRef.current = null;
        return;
      }
      // 가로 이동이 감지되면 바로 이전 화면 미리보기를 깔아 빈 배경이 보이지 않게 한다
      if (!g.previewOn && g.dx > PREVIEW_PX && g.dx > Math.abs(g.dy)) {
        g.previewOn = true;
        stateRef.current.onDragPreview?.(true);
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
    const w = wrapRef.current?.offsetWidth || 390;
    const x = Math.max(0, g.dx);
    const p = Math.min(1, x / w);
    const el = itemRef.current;
    if (el) {
      el.style.transition = 'none';
      el.style.transform = `translateX(${x}px)`;
      el.style.boxShadow = x > 4 ? '-16px 0 40px rgba(0,0,0,0.18)' : 'none';
    }
    // 아래 화면(이전 화면)이 손가락 진행에 맞춰 패럴랙스로 따라온다
    g.underX = -UNDER_PARALLAX * (1 - p) * w;
    const under = wrapRef.current?.querySelector('.view-layer-drag-under');
    if (under) {
      under.style.transition = 'none';
      under.style.transform = `translateX(${g.underX}px)`;
      const dim = under.querySelector('.view-drag-dim');
      if (dim) dim.style.opacity = String(UNDER_DIM * (1 - p));
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    const g = gestureRef.current;
    gestureRef.current = null;
    if (!g) return;
    if (!g.active) {
      if (g.previewOn) stateRef.current.onDragPreview?.(false);
      return;
    }

    const dt = Math.max(1, Date.now() - g.startT);
    const velocity = g.dx / dt;
    const commit = g.dx > TRIGGER_PX || velocity > FLICK_VELOCITY;

    if (commit) {
      // 들어오는 화면이 미리보기 위치에서 이어지도록 커밋 정보를 남기고 즉시 뒤로가기
      const w = wrapRef.current?.offsetWidth || 390;
      commitRef.current = { underX: g.underX ?? -UNDER_PARALLAX * w };
      stateRef.current.onDragPreview?.(false);
      stateRef.current.onSwipeBack?.();
      return;
    }
    // 취소: 현재 화면은 원위치로, 아래 화면 미리보기도 함께 되돌아간 뒤 언마운트
    const w = wrapRef.current?.offsetWidth || 390;
    const under = wrapRef.current?.querySelector('.view-layer-drag-under');
    if (under) {
      under.style.transition = `transform 0.22s ${EXIT_EASE}`;
      under.style.transform = `translateX(${-UNDER_PARALLAX * w}px)`;
      const dim = under.querySelector('.view-drag-dim');
      if (dim) {
        dim.style.transition = 'opacity 0.22s ease';
        dim.style.opacity = String(UNDER_DIM);
      }
    }
    const el = itemRef.current;
    if (el) {
      el.style.transition = `transform 0.22s ${EXIT_EASE}, box-shadow 0.22s ease`;
      el.style.transform = 'translateX(0px)';
      el.style.boxShadow = 'none';
    }
    window.setTimeout(() => {
      resetItemStyle();
      stateRef.current.onDragPreview?.(false);
    }, 240);
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

  // 드래그 커밋 직후에는 진입 애니메이션을 억제한다 (미리보기 위치에서 이어지므로)
  const suppressEnter = direction === 'back' && snapshot.key === viewKey && snapshot.suppressEnter;
  const animClass = suppressEnter
    ? ''
    : direction === 'forward'
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
      {underlay && (
        <div className="view-layer-drag-under" aria-hidden="true">
          {underlay}
          <div className="view-drag-dim" />
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
