// 격리 더미 프리뷰: 관리자 주간 캘린더의 '피티 등록 신청' 표시·다이얼로그 픽셀 검증용.
// 실제 Supabase 데이터 없음. App.jsx의 admin_schedule 배선(쿼리 status 필터, 이벤트 병합, 클릭 분기)을 그대로 모사.
import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { GlobalModalProvider } from '../../src/context/GlobalModalContext';
import AdminScheduleFullCalendar from '../../src/features/admin/AdminScheduleFullCalendar';
import PtRequestCalendarDialog from '../../src/features/admin/PtRequestCalendarDialog';
import {
  buildAdminCalendarEvents,
  buildBlockedCalendarEvents,
  buildPtRequestCalendarEvents,
} from '../../src/utils/adminScheduleCalendarEvents';

// --- 더미 원천 데이터 (실제 회원 없음) ---
// App.jsx의 쿼리: .in('status', ['requested','accepted']) — 여기서도 같은 필터를 적용한다.
const RAW_PT_REQUESTS = [
  { id: 'dummy-req-1', link_id: 'l1', requested_date: '2026-11-19', requested_time: '14:00', status: 'requested', member_name: '김더미' },
  // 신청 즉시 확정 모델: accepted 신청은 block_id를 갖고 블록으로만 표시된다
  { id: 'dummy-req-2', link_id: 'l2', requested_date: '2026-11-20', requested_time: '10:00', status: 'accepted', member_name: '박더미', block_id: 'blk-pt-1' },
  { id: 'dummy-req-3', link_id: 'l1', requested_date: '2026-11-18', requested_time: '11:00', status: 'cancelled', member_name: '취소더미' },
  { id: 'dummy-req-4', link_id: 'l2', requested_date: '2026-11-18', requested_time: '15:00', status: 'declined', member_name: '거절더미' },
];

const MERGED_ITEMS = {
  '2026-11-19': [
    { booking: { id: 'bk-1', status: 'confirmed', profiles: { name: '일반더미' } }, time: '12:00', userName: '일반더미', status: 'Scheduled' },
  ],
};

const RAW_BLOCKS = [
  { id: 'blk-ot-1', block_date: '2026-11-19', block_time: '16:00', kind: 'ot' },
  // 즉시 확정된 박더미 신청의 블록 — 이름은 블록에 쓰지 않고 otNames 맵으로만 표시
  { id: 'blk-pt-1', block_date: '2026-11-20', block_time: '10:00', kind: 'ot', label: 'PT' },
];
const RAW_OT_NAMES = { 'blk-ot-1': '오티더미', 'blk-pt-1': '박더미' };

// decide RPC 모의: 실제 서버 호출 없음, 호출 인자 기록
const rpcCalls = [];
const mockClient = {
  rpc: async (fn, args) => {
    rpcCalls.push({ fn, args });
    window.__lastRpc = { fn, args };
    return { data: { ok: true }, error: null };
  },
};

// App.jsx는 scheduleCalendarSeed를 안정된 state로 유지하고 key로 리마운트 → 동일하게 상수 사용
const INITIAL_DATE = new Date('2026-11-17T09:00:00+09:00');

function Preview() {
  const [ptRequests, setPtRequests] = useState(RAW_PT_REQUESTS);
  const [blocks, setBlocks] = useState(RAW_BLOCKS);
  const [otNames, setOtNames] = useState(RAW_OT_NAMES);
  const [ptCalendarRequest, setPtCalendarRequest] = useState(null);

  const events = useMemo(() => {
    // App.jsx fetch 단계의 status 필터와 동일
    const visible = ptRequests.filter((r) => r.status === 'requested' || r.status === 'accepted');
    return [
      ...buildAdminCalendarEvents(MERGED_ITEMS),
      ...buildBlockedCalendarEvents(blocks, otNames),
      ...buildPtRequestCalendarEvents(visible),
    ];
  }, [ptRequests, blocks, otNames]);

  // App.jsx openCalendarEvent 의 PT 분기와 동일
  const openCalendarEvent = (info) => {
    const ptReq = info?.event?.extendedProps?.ptRequest;
    if (info?.event?.extendedProps?.isPtRequest && ptReq?.id) { setPtCalendarRequest(ptReq); return; }
  };

  // onChanged: App.jsx에서는 fetchRevenueData. 여기서는 decide 승인 결과를 로컬 상태에 반영.
  const refetch = () => {
    const rpc = window.__lastRpc;
    if (rpc?.fn === 'ot_admin_pt_decide') {
      const req = ptRequests.find((r) => r.id === rpc.args.p_request_id);
      if (rpc.args.p_decision === 'accepted' && req) {
        // 새 RPC는 승인 즉시 블록을 만든다 — 동일하게 모사
        const nb = 'blk-new-' + req.id;
        setPtRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, status: 'accepted', block_id: nb } : r)));
        setBlocks((prev) => [...prev, { id: nb, block_date: req.requested_date, block_time: req.requested_time, kind: 'ot', label: 'PT' }]);
        setOtNames((prev) => ({ ...prev, [nb]: req.member_name }));
      } else {
        setPtRequests((prev) => prev.map((r) => (r.id === rpc.args.p_request_id ? { ...r, status: rpc.args.p_decision } : r)));
      }
    }
  };

  return (
    <div className="bg-slate-50 min-h-[100dvh] p-2">
      <p className="text-xs text-slate-400 px-2 py-1">격리 더미 프리뷰 — 실제 데이터·서버 호출 없음</p>
      <AdminScheduleFullCalendar
        events={events}
        onEventClick={openCalendarEvent}
        initialDate={INITIAL_DATE}
      />
      {ptCalendarRequest ? (
        <PtRequestCalendarDialog
          request={ptCalendarRequest}
          client={mockClient}
          onClose={() => setPtCalendarRequest(null)}
          onChanged={refetch}
        />
      ) : null}
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <GlobalModalProvider>
    <Preview />
  </GlobalModalProvider>,
);
