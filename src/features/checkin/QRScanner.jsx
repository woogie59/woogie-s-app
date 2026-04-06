import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../../lib/supabaseClient';
import { invokeNotifyMemberEvents } from '../../utils/notifications';
import { todayDateKeysForBookingMatch } from '../../utils/bookingDateKeys';

const QRScanner = ({ setView, goBack }) => {
  const [result, setResult] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const scannerRef = useRef(null);

  const processCheckIn = async (decodedText) => {
    if (!decodedText || typeof decodedText !== 'string') return;

    if (navigator.vibrate) navigator.vibrate(200);

    try {
      const scannedUserId = decodedText.trim();
      const todayKeys = todayDateKeysForBookingMatch();

      console.log('🔍 [QR 스캔] 타겟 유저 ID:', scannedUserId);
      console.log('🔍 [QR 스캔] 오늘 날짜 키 후보 (TEXT date):', todayKeys);

      // 오늘 달력에 해당하는 예약만, 가장 최근 생성(재예약·삭제 후 신규 행 우선) 1건
      const { data: bookingData, error: fetchError } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', scannedUserId)
        .in('date', todayKeys)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log('🔍 [QR 스캔] 오늘 최신 예약 1건:', bookingData, '에러:', fetchError);

      const { data, error } = await supabase.rpc('check_in_user', { user_uuid: scannedUserId });
      if (error) throw error;

      const { data: userData } = await supabase.from('profiles').select('name').eq('id', scannedUserId).single();

      let remaining = 0;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        remaining = Number(data.remaining ?? data.remaining_sessions ?? 0);
      } else if (Array.isArray(data) && data[0] != null) {
        remaining = Number(data[0].remaining ?? data[0].remaining_sessions ?? 0);
      }
      if (!Number.isFinite(remaining)) remaining = 0;

      const userName = userData?.name || '회원';

      try {
        await invokeNotifyMemberEvents(
          scannedUserId,
          'LAB DOT · 출석',
          '출석되었습니다',
          'attendance'
        );
      } catch (e) {
        console.warn('[QRScanner] member attendance push:', e);
      }

      if (remaining === 3) {
        await supabase.functions.invoke('send-admin-alert', {
          body: {
            heading: '세션 잔여 알림',
            message: `${userName}님, ${remaining}회 남았습니다.`,
          },
        });
      }

      setResult({
        success: true,
        userName,
        message: `출석 완료 (잔여: ${remaining}회)`,
        remainingSessions: remaining,
      });
    } catch (error) {
      console.log('QR Check-in error (full object):', error);
      const errMsg = error?.message ?? '';
      let msg;
      if (errMsg.includes('ERR_NO_BOOKING_TODAY')) {
        msg = '오늘 예약된 내역을 찾을 수 없습니다. (DB 날짜 형식을 확인하세요)';
      } else if (errMsg.includes('ERR_NO_SESSIONS') || errMsg.includes('NO_SESSIONS_LEFT') || errMsg.includes('No remaining')) {
        msg = '남은 세션이 없습니다.';
      } else {
        msg = errMsg || 'QR 인식 오류: 다시 시도해주세요.';
      }
      setResult({ success: false, message: msg });
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    }
  };

  const startScanner = async () => {
    if (scannerRef.current) return;
    setCameraError(null);

    try {
      await new Promise((r) => setTimeout(r, 150));
      const html5QrCode = new Html5Qrcode('reader');
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        async (decodedText) => {
          try {
            await html5QrCode.pause();
          } catch (e) {}
          await processCheckIn(decodedText);
        },
        () => {}
      );
    } catch (err) {
      console.error('QRScanner camera error:', err);
      scannerRef.current = null;
      setCameraError('카메라 권한을 허용해주세요.');
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (e) {}
      try {
        scannerRef.current.clear();
      } catch (e) {}
      scannerRef.current = null;
    }
  };

  const resumeScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.resume();
      } catch (e) {
        scannerRef.current = null;
        startScanner();
      }
    }
  };

  useEffect(() => {
    startScanner();
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="min-h-[100dvh] bg-white text-slate-900 flex flex-col relative">
      <button
        onClick={async () => {
          await stopScanner();
          goBack?.();
        }}
        className="absolute top-6 left-6 z-50 text-gray-600 hover:text-emerald-700 border border-gray-200 px-4 py-2 rounded-xl bg-white/80 backdrop-blur"
      >
        ← Back
      </button>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <h2 className="text-2xl font-semibold tracking-wide text-[#064e3b] mb-4">QR CHECK-IN</h2>
        <p className="text-gray-500 text-sm mb-6">회원 QR 코드를 카메라에 맞춰주세요</p>

        {cameraError ? (
          <div className="w-full max-w-sm text-center">
            <p className="text-red-600 mb-4">{cameraError}</p>
            <button onClick={startScanner} className="bg-emerald-600 text-white font-bold py-3 px-6 rounded-xl">
              재시도
            </button>
          </div>
        ) : (
          <div className="w-full max-w-md">
            <div className="animate-lab-scan-breathe rounded-2xl overflow-hidden bg-slate-950/[0.03]">
              <div id="reader" className="rounded-2xl overflow-hidden min-h-[260px] w-full [&_video]:rounded-2xl" />
            </div>
            <p className="text-gray-500 text-xs text-center mt-4">스캔 영역 안에 QR을 맞춰주세요</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/20 p-6 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className={`w-full max-w-sm p-8 rounded-2xl text-center border-2 ${
                result.success ? 'bg-white border-emerald-600/60' : 'bg-white border-red-200'
              }`}
            >
              {result.success ? (
                <>
                  <CheckCircle size={64} className="text-emerald-600 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{result.userName || '알림'}</h3>
                  <p className="font-bold text-emerald-700">{result.message}</p>
                  {result.remainingSessions != null && (
                    <p className="text-emerald-600 text-sm mt-2">남은 횟수: {result.remainingSessions}회</p>
                  )}
                  {result.remainingSessions === 3 && (
                    <p className="text-emerald-800 text-sm mt-3 font-medium bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-2">
                      관리자에게 세션 잔여 알림이 전송되었습니다.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <XCircle size={64} className="text-red-600 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-red-700 mb-3">출석 실패</h3>
                  <p className="text-base font-semibold text-red-800 leading-relaxed bg-red-50 border border-red-200 rounded-xl px-4 py-4">
                    {result.message}
                  </p>
                  <p className="text-gray-500 text-xs mt-3">위 사유를 회원에게 안내해주세요</p>
                </>
              )}
              <button
                onClick={() => {
                  setResult(null);
                  resumeScanner();
                }}
                className="mt-6 w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold"
              >
                확인
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default QRScanner;
