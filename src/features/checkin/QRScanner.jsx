import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../../lib/supabaseClient';

const QRScanner = ({ setView }) => {
  const [result, setResult] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const scannerRef = useRef(null);

  const processCheckIn = async (decodedText) => {
    if (!decodedText || typeof decodedText !== 'string') return;

    if (navigator.vibrate) navigator.vibrate(200);

    try {
      const { data, error } = await supabase.rpc('check_in_user', { user_uuid: decodedText });
      if (error) throw error;

      const { data: userData } = await supabase.from('profiles').select('name').eq('id', decodedText).single();

      const remaining = data?.[0]?.remaining ?? 0;
      const userName = userData?.name || '회원';
      const isGoldenTime = remaining === 6;

      if (isGoldenTime) {
        await supabase.functions.invoke('send-admin-alert', {
          body: {
            heading: '⚠️ 재등록 골든타임 (D-6)',
            message: `${userName}님이 6회 남았습니다. 성취도 분석을 준비하세요!`,
          },
        });
      }

      setResult({
        success: true,
        userName,
        message: `출석 완료 (잔여: ${remaining}회)`,
        remainingSessions: remaining,
        isGoldenTime,
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
    <div className="min-h-[100dvh] bg-zinc-950 text-white flex flex-col relative">
      <button
        onClick={async () => {
          await stopScanner();
          setView('admin_home');
        }}
        className="absolute top-6 left-6 z-50 text-zinc-400 hover:text-white border border-zinc-700 px-4 py-2 rounded-xl bg-zinc-900/80"
      >
        ← Back
      </button>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <h2 className="text-2xl font-bold text-yellow-500 mb-4">QR CHECK-IN</h2>
        <p className="text-zinc-500 text-sm mb-6">회원 QR 코드를 카메라에 맞춰주세요</p>

        {cameraError ? (
          <div className="w-full max-w-sm text-center">
            <p className="text-red-500 mb-4">{cameraError}</p>
            <button onClick={startScanner} className="bg-yellow-600 text-black font-bold py-3 px-6 rounded-xl">
              재시도
            </button>
          </div>
        ) : (
          <div className="w-full max-w-md">
            <div id="reader" className="rounded-2xl overflow-hidden border-2 border-yellow-500/50" />
            <p className="text-zinc-500 text-xs text-center mt-4">스캔 영역 안에 QR을 맞춰주세요</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-6 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className={`w-full max-w-sm p-8 rounded-2xl text-center border-2 ${result.success ? 'bg-zinc-900 border-green-500' : 'bg-zinc-900 border-red-500'}`}
            >
              {result.success ? (
                <>
                  <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">{result.userName || '알림'}</h3>
                  <p className="font-bold text-green-400">{result.message}</p>
                  {result.remainingSessions != null && (
                    <p className="text-yellow-500 text-sm mt-2">남은 횟수: {result.remainingSessions}회</p>
                  )}
                  {result.isGoldenTime && (
                    <p className="text-amber-400 text-sm mt-3 font-medium bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2">
                      🔥 성취도 분석이 필요한 시점입니다! (관리자 알림 전송됨)
                    </p>
                  )}
                </>
              ) : (
                <>
                  <XCircle size={64} className="text-red-500 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-red-400 mb-3">출석 실패</h3>
                  <p className="text-base font-semibold text-white leading-relaxed bg-red-950/50 border border-red-500/50 rounded-xl px-4 py-4">
                    {result.message}
                  </p>
                  <p className="text-zinc-500 text-xs mt-3">위 사유를 회원에게 안내해주세요</p>
                </>
              )}
              <button
                onClick={() => {
                  setResult(null);
                  resumeScanner();
                }}
                className="mt-6 w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl font-bold"
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
