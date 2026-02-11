import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QrCode, Camera, CheckCircle, ChevronRight, ChevronDown, ChevronUp, BookOpen, LogOut, Plus, User, X, CreditCard, History, Search, ArrowLeft, Edit3, Save, Sparkles, MessageSquare, Calendar, Clock, ChevronLeft, XCircle, Trash2, Edit, Image, DollarSign, Download, Printer, Eye, EyeOff } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import OneSignal from 'react-onesignal';

// [중요] 우리가 만든 Supabase 연결 도구와 페이지 가져오기
import { supabase, REMEMBER_ME_KEY } from './lib/supabaseClient'; 
import RegisterView from './pages/RegisterView';

// --- (가짜 데이터 삭제함) ---
// 이제 INITIAL_USERS 같은 가짜 데이터는 쓰지 않습니다.

// --- Mock Data (게시판 데이터는 일단 유지 - 나중에 DB로 옮길 예정) ---
const INITIAL_KNOWLEDGE = [
  {
    post_id: 'n1',
    category: 'Nutrition',
    title: '체지방 감량을 위한 탄수화물 사이클링',
    content: '고강도 운동일에는 탄수화물 섭취를 늘리고, 휴식일에는 줄이는 전략적 식단 가이드입니다.',
    body: `<p>탄수화물 사이클링(Carb Cycling)은 다이어트 정체기를 극복하고 근손실을 최소화하며 체지방을 태우는 고급 영양 전략입니다.</p>`,
    date: '2024.01.20',
    image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&q=80'
  },
  {
    post_id: 'w1',
    category: 'Workout',
    title: '3대 운동 증량 프로그램 (5x5)',
    content: '스트렝스 향상을 위한 가장 클래식하고 효과적인 5x5 프로그램의 원리와 적용.',
    body: `<h3>StrongLifts 5x5 프로그램 가이드</h3><p>3대 운동(스쿼트, 벤치프레스, 데드리프트) 중량을 늘리고 싶다면 가장 확실한 방법은 5x5 훈련법입니다.</p>`,
    date: '2024.02.01',
    image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80'
  }
];

// --- Sub Components (간단한 컴포넌트들은 여기에 유지) ---

const CinematicIntro = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => onComplete(), 2500); // 시간 조금 줄임
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ delay: 1.5, duration: 1 }}
      onAnimationComplete={onComplete}
    >
      <motion.h1
        className="text-2xl md:text-4xl font-serif text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600 tracking-widest text-center px-4"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.5, ease: "easeInOut", repeat: 1, repeatType: "reverse" }}
      >
        THE COACH<br /><span className="text-sm md:text-lg text-zinc-500 font-sans tracking-[0.5em]">PROFESSIONAL</span>
      </motion.h1>
    </motion.div>
  );
};

const ButtonPrimary = ({ children, onClick, className = "", icon: Icon }) => (
  <button
    onClick={onClick}
    className={`w-full py-4 px-6 bg-gradient-to-r from-zinc-800 to-zinc-900 border border-yellow-600/30 rounded-xl text-yellow-500 font-medium tracking-wide shadow-lg hover:shadow-yellow-900/20 active:scale-95 transition-all flex items-center justify-center gap-3 ${className}`}
  >
    {Icon && <Icon size={20} />}
    {children}
  </button>
);

const ButtonGhost = ({ children, onClick, className = "" }) => (
  <button
    onClick={onClick}
    className={`w-full py-3 px-6 text-zinc-400 text-sm hover:text-white transition-colors tracking-widest uppercase ${className}`}
  >
    {children}
  </button>
);

const BackButton = ({ onClick, label = "Back" }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 text-zinc-400 hover:text-yellow-500 transition-colors mb-4"
  >
    <ArrowLeft size={20} />
    <span className="text-sm uppercase tracking-wider">{label}</span>
  </button>
);

// --- [LoginView] 진짜 로그인 기능 연결 ---
// --- [LoginView] 관리자 뒷문 추가 버전 ---
const LoginView = ({ setView }) => {
    const [email, setEmail] = useState('');
    const [pw, setPw] = useState('');
    const [loading, setLoading] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [rememberMe, setRememberMe] = useState(() => {
      try {
        return localStorage.getItem(REMEMBER_ME_KEY) !== 'false';
      } catch {
        return true;
      }
    });

    const handleForgotPassword = async () => {
        if (!resetEmail) {
            alert('Please enter your email address');
            return;
        }
        
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                redirectTo: `${window.location.origin}`,
            });
            
            if (error) throw error;
            
            alert('Password reset link sent to your email!');
            setShowForgotPassword(false);
            setResetEmail('');
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    const handleLogin = async () => {
        setLoading(true);
        try {
          localStorage.setItem(REMEMBER_ME_KEY, rememberMe ? 'true' : 'false');
          const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: pw,
          });
          if (error) {
            alert('로그인 실패: ' + error.message);
          } else {
            console.log('로그인 성공!', data);
          }
        } finally {
          setLoading(false);
        }
    };

    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] px-6 bg-zinc-950 text-white">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-serif text-yellow-500 mb-2">THE COACH</h2>
          <p className="text-zinc-500 text-xs tracking-[0.2em] uppercase">Premium Management System</p>
        </div>

        {!showForgotPassword ? (
          <>
            <div className="w-full max-w-sm space-y-4">
              <input 
                type="text" 
                placeholder="EMAIL (admin)" 
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-yellow-600 outline-none transition-colors" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
              />
              <input 
                type="password" 
                placeholder="PASSWORD (1234)" 
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-yellow-600 outline-none transition-colors" 
                value={pw} 
                onChange={e => setPw(e.target.value)} 
              />

              <label className="flex items-center gap-3 cursor-pointer select-none group py-1">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setRememberMe(checked);
                    try {
                      localStorage.setItem(REMEMBER_ME_KEY, checked ? 'true' : 'false');
                    } catch {}
                  }}
                  className="w-5 h-5 rounded border-2 border-zinc-600 bg-zinc-900 text-yellow-500 focus:ring-2 focus:ring-yellow-500/50 focus:ring-offset-0 focus:ring-offset-zinc-950 cursor-pointer accent-yellow-500 checked:border-yellow-500"
                />
                <span className="text-zinc-400 group-hover:text-zinc-300 text-sm font-medium">자동 로그인 유지</span>
              </label>
              
              <ButtonPrimary onClick={handleLogin}>
                  {loading ? 'CHECKING...' : 'ENTER'}
              </ButtonPrimary>
            </div>
            
            <button
              onClick={() => setShowForgotPassword(true)}
              className="mt-4 text-sm text-zinc-500 hover:text-yellow-500 transition-colors"
            >
              Forgot Password?
            </button>

            <div className="flex gap-4 mt-6 text-xs text-zinc-500">
                <button onClick={() => setView('register')} className="hover:text-yellow-500">회원가입</button>
            </div>
          </>
        ) : (
          <div className="w-full max-w-sm bg-zinc-900 p-6 rounded-xl border border-zinc-800">
            <h3 className="text-xl font-bold text-yellow-500 mb-4">Reset Password</h3>
            <p className="text-sm text-zinc-400 mb-4">
              Enter your email address and we'll send you a link to reset your password.
            </p>
            
            <input 
              type="email" 
              placeholder="Enter your email" 
              value={resetEmail} 
              onChange={e => setResetEmail(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:border-yellow-600 outline-none transition-colors mb-4"
            />

            <div className="flex gap-2">
              <button
                onClick={() => setShowForgotPassword(false)}
                className="flex-1 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleForgotPassword}
                className="flex-1 py-3 px-4 bg-yellow-600 hover:bg-yellow-500 rounded-xl text-black font-bold transition-all"
              >
                Send Reset Link
              </button>
            </div>
          </div>
        )}
      </div>
    );
};

// --- [ResetPasswordView] 비밀번호 재설정 화면 ---
const ResetPasswordView = ({ onClose }) => {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    // Log when component mounts to verify it's showing
    useEffect(() => {
        console.log('✅ ResetPasswordView mounted - User can now reset password');
    }, []);

    const handleResetPassword = async () => {
        console.log('🔄 Starting password reset...');
        
        if (!newPassword) {
            alert('새 비밀번호를 입력해주세요.');
            return;
        }

        if (newPassword.length < 6) {
            alert('비밀번호는 최소 6자리 이상이어야 합니다.');
            return;
        }

        if (newPassword !== confirmPassword) {
            alert('비밀번호가 일치하지 않습니다.');
            return;
        }

        setLoading(true);

        try {
            console.log('📝 Calling supabase.auth.updateUser...');
            const { data, error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            console.log('✅ Password updated successfully:', data);
            alert('✅ 비밀번호가 변경되었습니다');
            
            // Sign out to force fresh login with new password
            await supabase.auth.signOut();
            
            // Close the reset view
            onClose();
        } catch (error) {
            console.error('❌ Password update error:', error);
            alert('오류: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-6 bg-zinc-950 text-white">
        <div className="mb-8 text-center">
          <div className="mb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-500/10 border-2 border-yellow-500 mb-4">
              <span className="text-3xl">🔐</span>
            </div>
          </div>
          <h2 className="text-3xl font-serif text-yellow-500 mb-2">Reset Password</h2>
          <p className="text-zinc-500 text-xs tracking-[0.2em] uppercase">Enter Your New Password</p>
        </div>

        <div className="w-full max-w-sm space-y-4">
          <div>
            <label className="text-xs text-zinc-500 ml-1 mb-1 block">New Password</label>
            <input 
              type="password" 
              placeholder="새 비밀번호 (6자리 이상)" 
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-yellow-600 outline-none transition-colors" 
              value={newPassword} 
              onChange={e => setNewPassword(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs text-zinc-500 ml-1 mb-1 block">Confirm Password</label>
            <input 
              type="password" 
              placeholder="비밀번호 확인" 
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-yellow-600 outline-none transition-colors" 
              value={confirmPassword} 
              onChange={e => setConfirmPassword(e.target.value)} 
            />
          </div>
          
          <ButtonPrimary onClick={handleResetPassword} disabled={loading}>
              {loading ? 'UPDATING...' : 'UPDATE PASSWORD'}
          </ButtonPrimary>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              onClose();
            }}
            className="w-full text-sm text-zinc-500 hover:text-yellow-500 transition-colors mt-4"
          >
            ← Cancel
          </button>
        </div>
        
        {/* Debug info */}
        <div className="mt-8 text-xs text-zinc-700 text-center">
          <p>🔐 Recovery session active</p>
        </div>
      </div>
    );
};

// --- [ClientHome] DB 데이터 연동 버전 ---
const ClientHome = ({ user, logout, setView }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [myBookings, setMyBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [cancelling, setCancelling] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState(null); // { id, date, time }
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  // 화면이 켜지면 DB에서 내 정보를 가져옴
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('프로필 로딩 실패:', error);
      } else {
        setProfile(data);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [user]);

  // [REALTIME] Listen for attendance check-ins
  useEffect(() => {
    if (!user) return;

    // Create a channel for realtime updates
    const channel = supabase
      .channel('attendance_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'attendance_logs',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Attendance detected:', payload);
          
          // Show notification to user
          alert('✅ 출석완료되었습니다');
          
          // Refresh profile to get updated session count
          const fetchProfile = async () => {
            const { data, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .single();

            if (!error && data) {
              setProfile(data);
            }
          };
          fetchProfile();
        }
      )
      .subscribe();

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchMyBookings = async () => {
    if (!user) {
      console.log('[fetchMyBookings] No user, skipping');
      return;
    }

    setLoadingBookings(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      console.log('[fetchMyBookings] user.id:', user.id, '| data:', data, '| error:', error);

      if (error) {
        console.error('[fetchMyBookings] Error:', error);
        setMyBookings([]);
      } else {
        setMyBookings(data || []);
      }
    } catch (err) {
      console.error('[fetchMyBookings] Unexpected error:', err);
      setMyBookings([]);
    } finally {
      setLoadingBookings(false);
    }
  };

  const handleCancelBooking = (bookingId, date, time) => {
    setBookingToDelete({ id: bookingId, date, time });
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteAction = async () => {
    if (!bookingToDelete) return;
    setCancelling(bookingToDelete.id);
    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('id', bookingToDelete.id);

    if (error) {
      alert('취소 실패: ' + error.message);
    } else {
      fetchMyBookings(); // Refresh list
    }
    setCancelling(null);
    setBookingToDelete(null);
    setIsDeleteModalOpen(false);
  };

  const handleOpenSchedule = () => {
    setShowScheduleModal(true);
    const d = new Date();
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);
    setCurrentWeekStart(monday);
    fetchMyBookings();
  };

  const toDateKey = (d) => {
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  };

  const getWeekDates = (weekStart) => {
    const arr = [];
    for (let i = 0; i < 7; i++) {
      const dd = new Date(weekStart);
      dd.setDate(weekStart.getDate() + i);
      arr.push({ date: dd, key: toDateKey(dd) });
    }
    return arr;
  };

  const todayKey = toDateKey(new Date());

  const bookingsInWeek = React.useMemo(() => {
    const week = getWeekDates(currentWeekStart);
    const start = week[0].key;
    const end = week[6].key;
    return (myBookings || []).filter((b) => b.date >= start && b.date <= end);
  }, [myBookings, currentWeekStart]);

  const bookingsByDay = React.useMemo(() => {
    const map = {};
    bookingsInWeek.forEach((b) => {
      if (!map[b.date]) map[b.date] = [];
      map[b.date].push(b);
    });
    Object.values(map).forEach((arr) => arr.sort((a, b) => (a.time || '').localeCompare(b.time || '')));
    return map;
  }, [bookingsInWeek]);

  const formatTime24h = (t) => {
    if (!t || typeof t !== 'string') return t || '—';
    const m = String(t).match(/(\d{1,2}):(\d{2})/);
    return m ? `${m[1].padStart(2, '0')}:${m[2]}` : t;
  };

  const weekLabel = () => {
    const start = getWeekDates(currentWeekStart)[0].date;
    const end = getWeekDates(currentWeekStart)[6].date;
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-white flex flex-col relative pb-safe">
      <header className="p-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-serif text-yellow-500">THE COACH</h2>
          {/* 진짜 이름 표시 */}
          <p className="text-zinc-500 text-xs">
            {loading ? 'Loading...' : `${profile?.name || '회원'} 님`}
          </p>
        </div>
        <button onClick={logout}><LogOut size={20} className="text-zinc-600 hover:text-white transition-colors" /></button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8 w-full relative">
        {/* QR 코드 버튼 */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-yellow-600 to-amber-600 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
          <button 
            onClick={() => setShowQRModal(true)}
            className="relative w-48 h-48 rounded-full bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-2xl"
          >
            <QrCode size={40} className="text-yellow-500" />
            <span className="text-sm tracking-widest font-medium text-zinc-300">CHECK-IN</span>
          </button>
        </div>

        {/* 메뉴 버튼들 */}
        <div className="w-full max-w-xs space-y-2 mt-8">
           <ButtonGhost onClick={() => setView('library')}>LIBRARY</ButtonGhost>
           <ButtonGhost onClick={() => setView('class_booking')}>CLASS BOOKING</ButtonGhost>
           <ButtonGhost onClick={handleOpenSchedule}>MY SCHEDULE</ButtonGhost>
           <ButtonGhost onClick={() => setView('macro_calculator')}>MACRO CALCULATOR</ButtonGhost>
        </div>

         {/* [핵심] 진짜 남은 횟수 표시 */}
         <div className="absolute bottom-6 left-6 text-left">
             <p className="text-zinc-500 text-[10px] tracking-widest uppercase mb-1">Total Remaining</p>
             <p className="text-2xl font-serif text-white">
               {loading ? '-' : (profile?.remaining_sessions || 0)} 
               <span className="text-xs font-sans text-zinc-500 ml-1">Sessions</span>
             </p>
         </div>
        <button onClick={() => setView('admin_home')}>Admin Home</button>
      </div>

      {/* QR Code Modal */}
      <AnimatePresence>
        {showQRModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90"
            onClick={() => setShowQRModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border-2 border-yellow-500 rounded-2xl p-8 max-w-sm w-full"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif text-yellow-500">CHECK-IN QR</h3>
                <button 
                  onClick={() => setShowQRModal(false)}
                  className="text-zinc-500 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Real QR Code */}
              <div className="bg-white p-6 rounded-xl mb-6 flex items-center justify-center min-h-[280px] border-2 border-zinc-200">
                <div className="text-center">
                  {user?.id ? (
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(user.id)}&size=200x200&format=png`}
                      alt="Check-in QR Code"
                      className="mx-auto mb-3 border-2 border-zinc-300 rounded-lg"
                    />
                  ) : (
                    <div className="w-[200px] h-[200px] bg-zinc-200 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <span className="text-zinc-500 text-sm">Loading...</span>
                    </div>
                  )}
                  <p className="text-xs text-zinc-600 font-mono break-all px-4">
                    {user?.id || 'Loading...'}
                  </p>
                </div>
              </div>

              {/* User Info */}
              <div className="bg-zinc-800 rounded-xl p-4 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-zinc-400 text-sm">Name</span>
                  <span className="text-white font-bold">{profile?.name || 'Loading...'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 text-sm">Remaining Sessions</span>
                  <span className="text-2xl font-serif text-yellow-500">{profile?.remaining_sessions || 0}</span>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
                <div className="flex items-start gap-3">
                  <Sparkles size={20} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      관리자에게 이 화면을 보여주세요. QR 스캔 시 자동으로 세션이 차감됩니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setShowQRModal(false)}
                className="w-full mt-6 bg-yellow-600 text-white font-bold py-3 rounded-lg hover:bg-yellow-500 active:scale-95 transition-all"
              >
                CLOSE
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* My Schedule Modal - Weekly Agenda View */}
      <AnimatePresence>
        {showScheduleModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90"
            onClick={() => setShowScheduleModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border-2 border-yellow-500 rounded-2xl p-6 max-w-md w-full max-h-[85vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-serif text-yellow-500">MY SCHEDULE</h3>
                <button onClick={() => setShowScheduleModal(false)} className="text-zinc-500 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              {/* Week Navigator */}
              <div className="flex items-center justify-between gap-4 mb-4">
                <button
                  onClick={() => {
                    const prev = new Date(currentWeekStart);
                    prev.setDate(prev.getDate() - 7);
                    setCurrentWeekStart(prev);
                  }}
                  className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-yellow-500 transition"
                >
                  <ChevronLeft size={24} />
                </button>
                <span className="text-sm font-bold text-white min-w-[180px] text-center">
                  {weekLabel()}
                </span>
                <button
                  onClick={() => {
                    const next = new Date(currentWeekStart);
                    next.setDate(next.getDate() + 7);
                    setCurrentWeekStart(next);
                  }}
                  className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-yellow-500 transition"
                >
                  <ChevronRight size={24} />
                </button>
              </div>

              {/* Weekly Timeline - 7 days */}
              <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                {loadingBookings ? (
                  <p className="text-zinc-500 text-center py-10">Loading...</p>
                ) : (
                  getWeekDates(currentWeekStart).map(({ date, key }) => {
                    const dayBookings = bookingsByDay[key] || [];
                    const isToday = key === todayKey;
                    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    return (
                      <div
                        key={key}
                        className={`rounded-xl border overflow-hidden ${
                          isToday ? 'bg-yellow-500/10 border-yellow-500/60' : 'bg-zinc-800/50 border-zinc-700'
                        }`}
                      >
                        <div className={`px-4 py-2 flex items-center justify-between ${isToday ? 'bg-yellow-500/20' : 'bg-zinc-800/80'}`}>
                          <span className="font-bold text-white">
                            {dayName} {dateStr}
                          </span>
                          {isToday && (
                            <span className="text-xs font-bold text-yellow-500 bg-yellow-500/30 px-2 py-0.5 rounded">Today</span>
                          )}
                        </div>
                        {dayBookings.length === 0 ? (
                          <div className="px-4 py-3 text-zinc-500 text-sm">Rest Day 💤</div>
                        ) : (
                          <div className="divide-y divide-zinc-700">
                            {dayBookings.map((booking) => (
                              <div key={booking.id} className="flex items-center justify-between gap-3 px-4 py-3">
                                <div className="flex-1">
                                  <span className="text-2xl font-mono font-bold text-yellow-500">
                                    {formatTime24h(booking.time)}
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleCancelBooking(booking.id, booking.date, booking.time)}
                                  disabled={cancelling === booking.id}
                                  className="p-2 rounded-lg bg-red-600/20 border border-red-600/30 text-red-500 hover:bg-red-600/30 active:scale-95 transition-all disabled:opacity-50"
                                  title="Cancel booking"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {bookingsInWeek.length === 0 && !loadingBookings && (
                <p className="text-zinc-600 text-xs text-center mt-2">이번 주 예약이 없어요. CLASS BOOKING에서 예약해보세요!</p>
              )}

              <button
                onClick={() => setShowScheduleModal(false)}
                className="w-full mt-4 bg-yellow-600 text-black font-bold py-3 rounded-xl hover:bg-yellow-500 active:scale-95 transition-all"
              >
                닫기
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && bookingToDelete && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => { setIsDeleteModalOpen(false); setBookingToDelete(null); }}
        >
          <div
            className="bg-zinc-900 border border-yellow-500/30 rounded-2xl shadow-2xl shadow-black/50 p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-zinc-100 mb-2">예약 취소</h3>
            <p className="text-zinc-400 text-sm mb-6">
              {bookingToDelete.date} {bookingToDelete.time} 수업 예약을 취소할까요?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setIsDeleteModalOpen(false); setBookingToDelete(null); }}
                className="px-4 py-2.5 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
              >
                취소
              </button>
              <button
                onClick={confirmDeleteAction}
                disabled={cancelling === bookingToDelete.id}
                className="px-4 py-2.5 rounded-xl bg-yellow-600 text-black font-bold hover:bg-yellow-500 transition disabled:opacity-50"
              >
                {cancelling === bookingToDelete.id ? '처리 중...' : '예, 취소할게요'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Main App Component ---


export default function App() {
  const [showIntro, setShowIntro] = useState(true);
  const [session, setSession] = useState(null); // 현재 로그인 세션
  const [view, setView] = useState('login');
  const [selectedMemberId, setSelectedMemberId] = useState(null); // 선택된 회원 ID
  
  // [PASSWORD RESET STATE - OVERRIDES EVERYTHING]
  const [showResetPassword, setShowResetPassword] = useState(false);

  // [Library State]
  const [libraryPosts, setLibraryPosts] = useState([]);
  const [isLibraryLoading, setIsLibraryLoading] = useState(false);
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '', category: 'Tip', image_url: '' });
  
  // [Library Enhanced State]
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);
  const [showPostDetail, setShowPostDetail] = useState(false);

  // [Smart Revenue / Dashboard State]
  const [currentRevenueDate, setCurrentRevenueDate] = useState(new Date());
  const [dashboardFocusDate, setDashboardFocusDate] = useState(new Date());
  const [dashboardViewMode, setDashboardViewMode] = useState('day');
  const [revenueLogs, setRevenueLogs] = useState([]);
  const [dashboardBookings, setDashboardBookings] = useState([]);
  const [isRevenueLoading, setIsRevenueLoading] = useState(false);
  const [selectedRevenueDay, setSelectedRevenueDay] = useState(null);
  const [showPayrollCalculator, setShowPayrollCalculator] = useState(false);
  const [isManagerMode, setIsManagerMode] = useState(false);
  
  // Salary Configuration (Persist in LocalStorage)
  const [salaryConfig, setSalaryConfig] = useState(() => {
    const saved = localStorage.getItem('salaryConfig');
    return saved ? JSON.parse(saved) : { base: 500000, incentiveRate: 100, extra: 0 };
  });

  // Save config whenever it changes
  useEffect(() => {
    localStorage.setItem('salaryConfig', JSON.stringify(salaryConfig));
  }, [salaryConfig]);

  // [OneSignal] Initialize once on app load
  const [oneSignalReady, setOneSignalReady] = useState(false);
  useEffect(() => {
    OneSignal.init({
      appId: 'fd6573e6-1bd8-43af-9838-3b582f68286a',
      allowLocalhostAsSecureOrigin: true,
    }).then(() => setOneSignalReady(true)).catch(() => {});
  }, []);

  // [OneSignal] Sync onesignal_id to Supabase whenever user logs in
  useEffect(() => {
    const user = session?.user;
    if (!oneSignalReady || !user?.id) return;

    const runOneSignalSync = async () => {
      try {
        await OneSignal.login(user.id);
      } catch (e) {
        console.warn('[OneSignal] login:', e);
      }

      const savePlayerIdToProfile = async (playerId) => {
        if (!playerId) return;
        const { error } = await supabase
          .from('profiles')
          .update({ onesignal_id: playerId })
          .eq('id', user.id);
        if (error) console.warn('[OneSignal] Failed to save onesignal_id:', error);
      };

      const optedIn = OneSignal.User?.PushSubscription?.optedIn;
      if (optedIn) {
        const id = OneSignal.User?.PushSubscription?.id || OneSignal.User?.onesignalId;
        if (id) await savePlayerIdToProfile(id);
      } else {
        await OneSignal.Slidedown.promptPush();
      }

      OneSignal.User?.PushSubscription?.addEventListener?.('change', async (event) => {
        const newId = event?.current?.id || OneSignal.User?.PushSubscription?.id;
        if (newId) await savePlayerIdToProfile(newId);
      });
    };

    runOneSignalSync();
  }, [oneSignalReady, session?.user]);

  // [핵심] 앱이 켜질 때 & 로그인 상태 바뀔 때 실행됨
  useEffect(() => {
    // 1. Auto-login only if a valid session exists in storage (localStorage when rememberMe, sessionStorage otherwise)
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session check:', session);
      const hasValidSession = session?.access_token && session?.user;
      
      // CRITICAL: Check for recovery type FIRST before anything else
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const type = hashParams.get('type');
      
      if (type === 'recovery') {
        console.log('🔐 PASSWORD RECOVERY DETECTED - Setting showResetPassword=true');
        setSession(session);
        setShowResetPassword(true); // OVERRIDE everything
        return; // Exit early
      }
      
      setSession(session);
      if (hasValidSession) {
        setView('client_home');
      } else if (!session) {
        setView('login');
      }
    });

    // 2. 로그인/로그아웃 감시자 등록
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', event, session);
      
      // CRITICAL: Handle PASSWORD_RECOVERY event FIRST
      if (event === 'PASSWORD_RECOVERY') {
        console.log('🔐 PASSWORD_RECOVERY EVENT - Setting showResetPassword=true');
        setSession(session);
        setShowResetPassword(true); // OVERRIDE everything
        return; // Exit early
      }
      
      // If we just finished resetting password, don't process other events
      if (showResetPassword) {
        console.log('⚠️ Password reset in progress, ignoring other auth events');
        return;
      }
      
      setSession(session);
      
      if (session) {
        setView('client_home');
      } else {
        setView('login');
      }
    });

    return () => subscription.unsubscribe();
  }, [showResetPassword]);

  const handleLogout = async () => {
      await supabase.auth.signOut();
      setView('login');
  };

  // [Library Logic]
  const fetchLibraryPosts = async () => {
    if (!supabase) return;
    setIsLibraryLoading(true);
    try {
      const { data, error } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setLibraryPosts(data || []);
    } catch (err) {
      console.error('Error fetching posts:', err);
    } finally {
      setIsLibraryLoading(false);
    }
  };

  const handleSavePost = async () => {
    if (!newPost.title || !newPost.content) return alert('Please enter a title and content.');
    try {
      const { error } = await supabase.from('posts').insert([{ ...newPost, created_at: new Date() }]);
      if (error) throw error;
      alert('Post saved successfully!');
      setShowWriteModal(false);
      setNewPost({ title: '', content: '', category: 'Tip', image_url: '' });
      fetchLibraryPosts();
    } catch (err) {
      alert('Error saving post: ' + err.message);
    }
  };

  // [Library Search & Filter Logic]
  const handleSearch = () => {
    let filtered = libraryPosts;

    // Filter by category
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(post => post.category === selectedCategory);
    }

    // Filter by search query (only when button clicked)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(post =>
        post.title.toLowerCase().includes(query) ||
        (post.content && post.content.toLowerCase().includes(query))
      );
    }

    setFilteredPosts(filtered);
  };

  // Update filtered posts when category changes or posts load
  useEffect(() => {
    handleSearch();
  }, [selectedCategory, libraryPosts]);

  // Auto-fetch when view changes to library
  useEffect(() => {
    if (view === 'library') {
      fetchLibraryPosts();
    }
  }, [view]);

  const fetchRevenueData = async () => {
    if (!supabase) return;
    setIsRevenueLoading(true);
    const year = currentRevenueDate.getFullYear();
    const month = currentRevenueDate.getMonth();
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);
    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();
    const startKey = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    try {
      const [{ data: logsData, error: logsErr }, { data: bookingsData, error: bookingsErr }] = await Promise.all([
        supabase.from('attendance_logs').select('*, profiles(name)').gte('check_in_at', startISO).lte('check_in_at', endISO).order('check_in_at', { ascending: false }),
        supabase.from('bookings').select('*, profiles(name, email)').gte('date', startKey).lte('date', endKey).order('date', { ascending: true }).order('time', { ascending: true }),
      ]);
      if (logsErr) throw logsErr;
      if (bookingsErr) throw bookingsErr;
      setRevenueLogs(logsData || []);
      setDashboardBookings(bookingsData || []);
    } catch (err) {
      console.error('Error fetching dashboard:', err);
    } finally {
      setIsRevenueLoading(false);
    }
  };

  const changeMonth = (delta) => {
    const newDate = new Date(currentRevenueDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentRevenueDate(newDate);
    setSelectedRevenueDay(null);
  };

  const toDateKey = (d) => {
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  };

  const formatDateHeader = (dateKey) => {
    const [y, m, d] = dateKey.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
    return `${monthDay} (${weekday})`;
  };

  const revenueSessionsByDate = React.useMemo(() => {
    const map = {};
    revenueLogs.forEach((log) => {
      const key = toDateKey(log.check_in_at);
      if (!map[key]) map[key] = [];
      map[key].push(log);
    });
    return map;
  }, [revenueLogs]);

  const getSessionTime24h = (log) => {
    if (log?.session_time_fixed && typeof log.session_time_fixed === 'string') {
      const match = log.session_time_fixed.match(/^(\d{1,2}):(\d{2})/);
      if (match) return `${match[1].padStart(2, '0')}:${match[2]}`;
    }
    return new Date(log.check_in_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const normalizeTime24h = (t) => {
    if (!t || typeof t !== 'string') return '';
    const m = String(t).match(/(\d{1,2}):(\d{2})/);
    return m ? `${String(m[1]).padStart(2, '0')}:${m[2]}` : t;
  };

  const mergedItemsByDate = React.useMemo(() => {
    const logsByUserTime = {};
    revenueLogs.forEach((log) => {
      const key = toDateKey(log.check_in_at);
      const time = normalizeTime24h(getSessionTime24h(log));
      const k = `${key}|${log.user_id}|${time}`;
      logsByUserTime[k] = log;
    });
    const result = {};
    dashboardBookings.forEach((b) => {
      const key = b.date;
      if (!result[key]) result[key] = [];
      const time = normalizeTime24h(b.time);
      const matchKey = `${key}|${b.user_id}|${time}`;
      const matchedLog = logsByUserTime[matchKey];
      const isCompleted = !!matchedLog;
      result[key].push({
        type: 'booking',
        booking: b,
        log: matchedLog || null,
        status: isCompleted ? 'Completed' : 'Scheduled',
        userName: b.profiles?.name || 'Unknown',
        time: time || b.time,
        price: matchedLog?.session_price_snapshot ?? null,
      });
    });
    revenueLogs.forEach((log) => {
      const key = toDateKey(log.check_in_at);
      const time = normalizeTime24h(getSessionTime24h(log));
      const hasBooking = dashboardBookings.some((b) => b.date === key && b.user_id === log.user_id && normalizeTime24h(b.time) === time);
      if (!hasBooking) {
        if (!result[key]) result[key] = [];
        result[key].push({ type: 'log', booking: null, log, status: 'Completed', userName: log.profiles?.name || 'Unknown', time, price: log.session_price_snapshot });
      }
    });
    Object.keys(result).forEach((k) => result[k].sort((a, b) => (a.time || '').localeCompare(b.time || '')));
    return result;
  }, [revenueLogs, dashboardBookings]);

  const revenueDatesSorted = React.useMemo(() => {
    const allKeys = new Set([...Object.keys(revenueSessionsByDate), ...Object.keys(mergedItemsByDate)]);
    return Array.from(allKeys).sort((a, b) => b.localeCompare(a));
  }, [revenueSessionsByDate, mergedItemsByDate]);

  const getWeekDates = (d) => {
    const date = new Date(d);
    const day = date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
    const week = [];
    for (let i = 0; i < 7; i++) {
      const dd = new Date(monday);
      dd.setDate(monday.getDate() + i);
      week.push(toDateKey(dd));
    }
    return week;
  };

  const revenueCalendarDays = React.useMemo(() => {
    const y = currentRevenueDate.getFullYear();
    const m = currentRevenueDate.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const startPad = first.getDay();
    const daysInMonth = last.getDate();
    const cells = [];
    for (let i = 0; i < startPad; i++) cells.push({ type: 'pad', value: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ type: 'day', value: d, key, count: (revenueSessionsByDate[key] || []).length });
    }
    return cells;
  }, [currentRevenueDate, revenueSessionsByDate]);

  // Helper to handle input changes
  const handleConfigChange = (key, value) => {
    setSalaryConfig(prev => ({ ...prev, [key]: Number(value) }));
  };

  const fmt = (num) => num?.toLocaleString() || '0';

  const downloadPayrollCSV = () => {
    const totalSessions = revenueLogs.length;
    const totalSales = revenueLogs.reduce((sum, log) => sum + (log.session_price_snapshot || 0), 0);
    const commission = totalSales * (salaryConfig.incentiveRate / 100);
    const grossPayout = salaryConfig.base + commission + salaryConfig.extra;
    const taxDeduction = Math.round(grossPayout * 0.033);
    const netPayout = grossPayout - taxDeduction;

    const monthLabel = `${currentRevenueDate.getFullYear()}년 ${currentRevenueDate.getMonth() + 1}월`;
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;

    const summaryRows = [
      esc(`${monthLabel} Payroll Report`),
      esc(`Total Sessions: ${totalSessions}`),
      esc(`Total Sales: ₩${totalSales.toLocaleString()}`),
      esc(`Net Payout: ₩${netPayout.toLocaleString()}`),
      '',
      '',
    ];

    const headerRow = ['Date', 'Scheduled Time', 'Member Name', 'Price'].map(esc).join(',');

    const sortedLogs = [...revenueLogs].sort((a, b) => new Date(a.check_in_at) - new Date(b.check_in_at));
    let lastDateKey = '';
    const dataRows = [];
    sortedLogs.forEach((log) => {
      const d = new Date(log.check_in_at);
      const dateKey = toDateKey(log.check_in_at);
      if (dateKey !== lastDateKey) {
        lastDateKey = dateKey;
        const [y, m, day] = dateKey.split('-');
        dataRows.push(esc(`--- ${y}. ${m}. ${day} ---`));
      }
      const time24 = getSessionTime24h(log);
      dataRows.push([d.toLocaleDateString('ko-KR'), time24, (log.profiles?.name || 'Unknown'), log.session_price_snapshot ?? 0].map(esc).join(','));
    });

    const csvBody = [...summaryRows, headerRow, ...dataRows].join('\n');
    const bom = '\ufeff';
    const blob = new Blob([bom + csvBody], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll_${currentRevenueDate.getFullYear()}-${String(currentRevenueDate.getMonth() + 1).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (view === 'revenue' || view === 'admin_schedule') {
      fetchRevenueData();
    }
  }, [view, currentRevenueDate]);

  useEffect(() => {
    if ((view === 'revenue' || view === 'admin_schedule') && dashboardViewMode === 'day') {
      const fd = dashboardFocusDate;
      const cd = currentRevenueDate;
      if (fd.getMonth() !== cd.getMonth() || fd.getFullYear() !== cd.getFullYear()) {
        setCurrentRevenueDate(new Date(fd));
      }
    }
  }, [dashboardFocusDate, dashboardViewMode]);

  useEffect(() => {
    if (view === 'revenue' || view === 'admin_schedule') {
      const now = new Date();
      setDashboardViewMode('day');
      setDashboardFocusDate(now);
    }
  }, [view]);

  return (
    <div className="bg-black min-h-[100dvh] font-sans selection:bg-yellow-500/30 overflow-x-hidden">
      <AnimatePresence>
        {showIntro && <CinematicIntro onComplete={() => setShowIntro(false)} />}
      </AnimatePresence>

      {!showIntro && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}>
          
          {/* [PASSWORD RESET OVERRIDE] - Shows above everything else */}
          {showResetPassword && (
            <ResetPasswordView 
              onClose={() => {
                console.log('🔄 Closing reset view, returning to login');
                setShowResetPassword(false);
                setView('login');
              }} 
            />
          )}

          {/* Normal views - only show if NOT in password reset mode */}
          {!showResetPassword && (
            <>
              {/* 로그인 안 했을 때 보여줄 화면들 */}
              {!session && view === 'login' && <LoginView setView={setView} />}
              {!session && view === 'register' && <RegisterView setView={setView} />}

              {/* 로그인 했을 때 보여줄 화면 (일반 회원) */}
              {session && view === 'client_home' && <ClientHome user={session.user} logout={handleLogout} setView={setView} />}

          {/* 관리자 화면 (admin role 필수) */}
          {view === 'admin_home' && (
            <AdminRoute session={session} setView={setView}>
              <AdminHome setView={setView} logout={handleLogout} />
            </AdminRoute>
          )}

          {/* 회원 목록 */}
          {view === 'member_list' && (
            <AdminRoute session={session} setView={setView}>
              <MemberList setView={setView} setSelectedMemberId={setSelectedMemberId} />
            </AdminRoute>
          )}

          {view === 'admin_settings' && (
            <AdminRoute session={session} setView={setView}>
              <AdminSettings setView={setView} />
            </AdminRoute>
          )}

          {/* 회원 상세 */}
          {view === 'member_detail' && selectedMemberId && (
            <AdminRoute session={session} setView={setView}>
              <MemberDetail selectedMemberId={selectedMemberId} setView={setView} />
            </AdminRoute>
          )}

          {/* QR 스캐너 */}
          {view === 'scanner' && (
            <AdminRoute session={session} setView={setView}>
              <QRScanner setView={setView} />
            </AdminRoute>
          )}

          {/* Unified Management Dashboard (Revenue + Schedule) */}
          {(view === 'revenue' || view === 'admin_schedule') && (
            <AdminRoute session={session} setView={setView}>
              <div className="min-h-[100dvh] bg-zinc-950 flex flex-col text-white overflow-y-auto pb-20">
                <div className="p-6 pb-2">
                  <BackButton onClick={() => setView('admin_home')} label="Admin Home" />

                  {/* Segmented Control: Day | Week | Month */}
                  <div className="flex gap-1 p-1 bg-zinc-900 rounded-xl border border-zinc-800 w-fit mb-4">
                    {(['day', 'week', 'month']).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setDashboardViewMode(mode)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition capitalize ${
                          dashboardViewMode === mode ? 'bg-yellow-500 text-black' : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        {mode === 'day' ? 'Day' : mode === 'week' ? 'Week' : 'Month'}
                      </button>
                    ))}
                  </div>

                  {/* Header: Navigator + Eye Toggle */}
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
                    <div className="flex items-center gap-3 bg-zinc-900 px-4 py-3 rounded-xl border border-zinc-800">
                      <button
                        onClick={() => {
                          const d = new Date(dashboardViewMode === 'day' ? dashboardFocusDate : currentRevenueDate);
                          if (dashboardViewMode === 'day') { d.setDate(d.getDate() - 1); setDashboardFocusDate(d); }
                          else if (dashboardViewMode === 'week') { d.setDate(d.getDate() - 7); setDashboardFocusDate(d); setCurrentRevenueDate(d); }
                          else changeMonth(-1);
                        }}
                        className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-yellow-500 transition"
                      >
                        <ChevronLeft size={24} />
                      </button>
                      <div className="flex items-center gap-2 min-w-[140px] justify-center">
                        <Calendar size={20} className="text-yellow-500" />
                        <span className="text-lg font-bold">
                          {dashboardViewMode === 'day' && formatDateHeader(toDateKey(dashboardFocusDate))}
                          {dashboardViewMode === 'week' && `Week of ${formatDateHeader(getWeekDates(dashboardFocusDate)[0])}`}
                          {dashboardViewMode === 'month' && `${currentRevenueDate.toLocaleDateString('en-US', { month: 'short' })} ${currentRevenueDate.getFullYear()}`}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          const d = new Date(dashboardViewMode === 'day' ? dashboardFocusDate : currentRevenueDate);
                          if (dashboardViewMode === 'day') { d.setDate(d.getDate() + 1); setDashboardFocusDate(d); }
                          else if (dashboardViewMode === 'week') { d.setDate(d.getDate() + 7); setDashboardFocusDate(d); setCurrentRevenueDate(d); }
                          else changeMonth(1);
                        }}
                        className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-yellow-500 transition"
                      >
                        <ChevronRight size={24} />
                      </button>
                    </div>
                    <button
                      onClick={() => setIsManagerMode((v) => !v)}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all duration-300 ${
                        isManagerMode ? 'bg-yellow-500/20 border-yellow-500 text-yellow-500' : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-600'
                      }`}
                    >
                      {isManagerMode ? <Eye size={22} /> : <EyeOff size={22} />}
                      <span className="text-sm font-medium">{isManagerMode ? 'Manager' : 'Private'}</span>
                    </button>
                  </div>
                </div>

                {/* ========== DAY VIEW ========== */}
                {dashboardViewMode === 'day' && (() => {
                  const dayKey = toDateKey(dashboardFocusDate);
                  const items = mergedItemsByDate[dayKey] || [];
                  const completed = items.filter((x) => x.status === 'Completed').length;
                  const total = items.length;
                  const now = new Date();
                  const nowMinutes = now.getHours() * 60 + now.getMinutes();
                  const isToday = toDateKey(now) === dayKey;
                  let nextUpIndex = -1;
                  let nowLineIndex = -1;
                  if (isToday && items.length > 0) {
                    for (let i = 0; i < items.length; i++) {
                      const [h, m] = (items[i].time || '00:00').split(':').map(Number);
                      if (h * 60 + m > nowMinutes) { nextUpIndex = i; nowLineIndex = i; break; }
                    }
                    if (nextUpIndex < 0) nowLineIndex = items.length;
                  }
                  return (
                    <div className="px-6 flex-1">
                      <div className="mb-6">
                        <h2 className="text-2xl font-bold text-yellow-500 mb-1">{formatDateHeader(dayKey)}</h2>
                        {total > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                              <div className="h-full bg-yellow-500 rounded-full transition-all" style={{ width: total ? `${(completed / total) * 100}%` : 0 }} />
                            </div>
                            <span className="text-zinc-400 text-sm whitespace-nowrap">{completed}/{total} Done</span>
                          </div>
                        )}
                      </div>
                      {items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <Calendar size={64} className="text-zinc-700 mb-4" />
                          <p className="text-zinc-500 font-medium">No classes today</p>
                          <p className="text-zinc-600 text-sm mt-1">Take a breather 💪</p>
                        </div>
                      ) : (
                        <div className="space-y-3 relative">
                          {items.map((item, idx) => {
                            const isNextUp = isToday && idx === nextUpIndex;
                            const showNowBefore = isToday && nowLineIndex >= 0 && idx === nowLineIndex;
                            const showNowAfter = isToday && nowLineIndex === items.length && idx === items.length - 1;
                            return (
                              <React.Fragment key={item.booking?.id || item.log?.id || idx}>
                                {showNowBefore && (
                                  <div className="flex items-center gap-2 py-2">
                                    <div className="flex-1 h-px bg-red-500" />
                                    <span className="text-red-400 text-xs font-mono">Now</span>
                                    <div className="flex-1 h-px bg-red-500" />
                                  </div>
                                )}
                              <div
                                key={item.booking?.id || item.log?.id || idx}
                                className={`rounded-xl border p-4 transition-all ${
                                  item.status === 'Completed'
                                    ? 'bg-yellow-500/10 border-yellow-500/50'
                                    : 'bg-zinc-900 border-zinc-800'
                                } ${isNextUp ? 'ring-2 ring-yellow-400 shadow-lg shadow-yellow-500/20' : ''}`}
                              >
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-zinc-300 font-mono font-medium">{item.time}</span>
                                  <span className="flex-1 text-white font-medium truncate text-center">{item.userName}</span>
                                  {isManagerMode && item.price != null && (
                                    <span className="text-yellow-500 font-bold text-sm">₩ {(item.price ?? 0).toLocaleString()}</span>
                                  )}
                                </div>
                                {isNextUp && <p className="text-yellow-400 text-xs mt-2">↑ Next up</p>}
                              </div>
                              {showNowAfter && (
                                <div className="flex items-center gap-2 py-2">
                                  <div className="flex-1 h-px bg-red-500" />
                                  <span className="text-red-400 text-xs font-mono">Now</span>
                                  <div className="flex-1 h-px bg-red-500" />
                                </div>
                              )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ========== WEEK VIEW ========== */}
                {dashboardViewMode === 'week' && (
                  <div className="px-6 flex-1 space-y-2">
                    {getWeekDates(dashboardFocusDate).map((dateKey) => {
                      const items = mergedItemsByDate[dateKey] || [];
                      const completed = items.filter((x) => x.status === 'Completed').length;
                      if (items.length === 0) {
                        return (
                          <div key={dateKey} className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 px-4 py-2 flex items-center justify-between">
                            <span className="text-zinc-600 text-sm">{formatDateHeader(dateKey)}</span>
                            <span className="text-zinc-700 text-xs">—</span>
                          </div>
                        );
                      }
                      return (
                        <div key={dateKey} className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                          <div className="px-4 py-2 bg-zinc-800/80 font-bold text-white flex items-center justify-between">
                            <span>{formatDateHeader(dateKey)}</span>
                            <span className="text-zinc-400 text-sm font-normal">{items.length} classes {completed > 0 && `(${completed} done)`}</span>
                          </div>
                          <div className="divide-y divide-zinc-800">
                            {items.slice(0, 4).map((item, idx) => (
                              <div key={idx} className={`flex items-center justify-between gap-4 px-4 py-2 ${item.status === 'Completed' ? 'bg-yellow-500/5' : ''}`}>
                                <span className="text-zinc-400 font-mono text-sm">{item.time}</span>
                                <span className="flex-1 text-white text-sm truncate text-center">{item.userName}</span>
                                {isManagerMode && item.price != null && <span className="text-yellow-500 text-xs">₩{(item.price ?? 0).toLocaleString()}</span>}
                              </div>
                            ))}
                            {items.length > 4 && <div className="px-4 py-2 text-zinc-500 text-xs">+{items.length - 4} more</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ========== MONTH VIEW ========== */}
                {dashboardViewMode === 'month' && (
                  <div className="px-6 flex-1">
                    <div className="bg-zinc-900 rounded-xl p-4 mb-6 border border-zinc-800">
                      <div className="grid grid-cols-7 gap-1">
                        {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
                          <div key={d} className="text-center text-zinc-500 text-[10px] font-medium py-1">{d}</div>
                        ))}
                        {isRevenueLoading ? (
                          <div className="col-span-7 py-8 text-center text-zinc-500 text-sm">Loading...</div>
                        ) : (
                          revenueCalendarDays.map((cell, i) =>
                            cell.type === 'pad' ? (
                              <div key={`pad-${i}`} className="aspect-square" />
                            ) : (
                              <button
                                key={cell.key}
                                onClick={() => { setSelectedRevenueDay(selectedRevenueDay === cell.key ? null : cell.key); setDashboardFocusDate(new Date(cell.key + 'T12:00:00')); setDashboardViewMode('day'); }}
                                className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm font-medium transition min-h-[36px] ${
                                  selectedRevenueDay === cell.key ? 'bg-yellow-500 text-black ring-2 ring-yellow-400' : 'bg-zinc-800/50 hover:bg-zinc-700 text-white'
                                }`}
                              >
                                <span>{cell.value}</span>
                                {(mergedItemsByDate[cell.key] || []).length > 0 && (
                                  <span className={`mt-0.5 rounded-full ${(mergedItemsByDate[cell.key] || []).length >= 6 ? 'w-2.5 h-2.5' : (mergedItemsByDate[cell.key] || []).length >= 3 ? 'w-2 h-2' : 'w-1.5 h-1.5'} bg-yellow-500`} />
                                )}
                              </button>
                            )
                          )
                        )}
                      </div>
                    </div>
                    {selectedRevenueDay && (
                      <div className="space-y-2 mb-6">
                        {(mergedItemsByDate[selectedRevenueDay] || []).map((item, idx) => (
                          <div key={idx} className={`flex items-center justify-between gap-4 px-4 py-3 rounded-xl border ${item.status === 'Completed' ? 'bg-yellow-500/10 border-yellow-500/50' : 'bg-zinc-900 border-zinc-800'}`}>
                            <span className="font-mono text-zinc-300">{item.time}</span>
                            <span className="flex-1 text-white text-center truncate">{item.userName}</span>
                            {isManagerMode && item.price != null && <span className="text-yellow-500 font-bold">₩{(item.price ?? 0).toLocaleString()}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Financial Section - Manager Mode Only */}
                {isManagerMode && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-6 mb-4">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                        <span className="text-zinc-400 text-xs">Total Sales</span>
                        <p className="text-xl font-bold text-yellow-400">₩ {fmt(revenueLogs.reduce((s, l) => s + (l.session_price_snapshot || 0), 0))}</p>
                      </div>
                      <div className="bg-zinc-900 rounded-xl p-4 border border-yellow-500/50">
                        <span className="text-yellow-400/90 text-xs">Net Payout</span>
                        <p className="text-xl font-bold text-yellow-400">₩ {fmt((() => { const g = salaryConfig.base + revenueLogs.reduce((s, l) => s + (l.session_price_snapshot || 0), 0) * (salaryConfig.incentiveRate / 100) + salaryConfig.extra; return g - Math.round(g * 0.033); })())}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setShowPayrollCalculator((v) => !v)} className="flex items-center gap-2 bg-zinc-800 px-4 py-2 rounded-xl text-yellow-500 text-sm">🧮 Calculator</button>
                      <button onClick={downloadPayrollCSV} className="flex items-center gap-2 bg-yellow-600 px-4 py-2 rounded-xl text-black font-bold text-sm">📥 Report</button>
                    </div>
                    {showPayrollCalculator && (
                      <div className="mt-4 p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 grid grid-cols-3 gap-4">
                        <div><label className="text-zinc-500 text-xs">Base</label><input type="number" value={salaryConfig.base} onChange={(e) => handleConfigChange('base', e.target.value)} className="w-full bg-zinc-800 rounded px-3 py-2 text-white" /></div>
                        <div><label className="text-zinc-500 text-xs">Incentive %</label><input type="number" value={salaryConfig.incentiveRate} onChange={(e) => handleConfigChange('incentiveRate', e.target.value)} className="w-full bg-zinc-800 rounded px-3 py-2 text-yellow-400" /></div>
                        <div><label className="text-zinc-500 text-xs">Bonus</label><input type="number" value={salaryConfig.extra} onChange={(e) => handleConfigChange('extra', e.target.value)} className="w-full bg-zinc-800 rounded px-3 py-2 text-green-400" /></div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Sticky Footer - Total Monthly Sessions (unobtrusive) */}
                <div className="sticky bottom-0 left-0 right-0 py-3 px-6 bg-zinc-950/95 border-t border-zinc-800/50 text-center">
                  <p className="text-zinc-500 text-xs">
                    Total Monthly Sessions: <span className="text-yellow-500 font-semibold">{isRevenueLoading ? '—' : revenueLogs.length}</span>
                    {isManagerMode && (
                      <span className="ml-4">Revenue: ₩{fmt(revenueLogs.reduce((s, l) => s + (l.session_price_snapshot || 0), 0))}</span>
                    )}
                  </p>
                </div>
              </div>
            </AdminRoute>
          )}

          {/* 클래스 예약 */}
          {session && view === 'class_booking' && (
            <ClassBooking user={session.user} setView={setView} />
          )}

          {/* 매크로 계산기 */}
          {session && view === 'macro_calculator' && (
            <MacroCalculator user={session.user} setView={setView} />
          )}

          {/* 라이브러리 (지식 베이스) */}
          {(session || view === 'admin_home' || view === 'library') && view === 'library' && (
            <div className="min-h-[100dvh] bg-zinc-950 flex flex-col p-6 text-white overflow-y-auto pb-24">
              {/* BACK BUTTON */}
              <BackButton onClick={() => setView(session?.user ? 'client_home' : 'admin_home')} label="Home" />
              
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-yellow-500">📚 KNOWLEDGE BASE</h2>
                {(session?.user?.email === 'admin' || !session) && (
                  <button 
                    onClick={() => setShowWriteModal(true)}
                    className="bg-yellow-500 text-black px-4 py-2 rounded font-bold hover:bg-yellow-400 transition shadow-lg"
                  >
                    + NEW POST
                  </button>
                )}
              </div>

              {/* CATEGORY TABS */}
              <div className="flex gap-2 mb-4 overflow-x-auto">
                {['All', 'Exercise', 'Diet', 'Routine'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                      selectedCategory === cat
                        ? 'bg-yellow-500 text-black'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* SEARCH BAR WITH BUTTON */}
              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  placeholder="Search posts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-yellow-500 outline-none"
                />
                <button
                  onClick={handleSearch}
                  className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold px-6 py-3 rounded-xl transition-all flex items-center gap-2"
                >
                  <Search size={20} />
                  Search
                </button>
              </div>

              {isLibraryLoading ? (
                <div className="text-center text-zinc-400 mt-10">Loading library...</div>
              ) : filteredPosts.length === 0 ? (
                <div className="text-center text-zinc-500 mt-10 p-8 border border-zinc-800 rounded-lg">
                  <p className="text-xl">No posts found.</p>
                  {(session?.user?.email === 'admin' || !session) && <p className="text-sm mt-2">Click "+ NEW POST" to add content.</p>}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredPosts.map((post) => (
                    <button
                      key={post.id}
                      onClick={() => {
                        setSelectedPost(post);
                        setShowPostDetail(true);
                      }}
                      className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 hover:border-yellow-500 transition-all cursor-pointer group"
                    >
                      {post.image_url ? (
                        <img src={post.image_url} alt={post.title} className="w-full h-32 object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <div className="w-full h-32 bg-zinc-800 flex items-center justify-center text-zinc-600">
                          <Image size={32} />
                        </div>
                      )}
                      <div className="p-3">
                        <h3 className="font-bold text-sm text-white line-clamp-2 text-left">{post.title}</h3>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* POST DETAIL MODAL */}
              <AnimatePresence>
                {showPostDetail && selectedPost && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
                    onClick={() => setShowPostDetail(false)}
                  >
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      className="bg-zinc-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border-2 border-yellow-500"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {selectedPost.image_url && (
                        <img 
                          src={selectedPost.image_url} 
                          alt={selectedPost.title} 
                          className="w-full h-64 object-cover"
                        />
                      )}
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <span className="text-xs font-bold text-yellow-400 bg-yellow-900/40 px-3 py-1 rounded-lg border border-yellow-500/20">
                            {selectedPost.category}
                          </span>
                          <button
                            onClick={() => setShowPostDetail(false)}
                            className="text-zinc-500 hover:text-white transition-colors"
                          >
                            <X size={24} />
                          </button>
                        </div>
                        <h2 className="text-3xl font-bold text-yellow-500 mb-4">{selectedPost.title}</h2>
                        <div className="text-zinc-300 leading-relaxed whitespace-pre-line">
                          {selectedPost.content}
                        </div>
                        <button
                          onClick={() => setShowPostDetail(false)}
                          className="w-full mt-6 bg-yellow-600 text-black font-bold py-3 rounded-xl hover:bg-yellow-500 transition-all"
                        >
                          CLOSE
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Write Modal */}
              {showWriteModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                  <div className="bg-zinc-900 p-6 rounded-xl w-full max-w-lg border border-yellow-500/30 shadow-2xl">
                    <h3 className="text-xl font-bold text-yellow-500 mb-6">Create New Post</h3>
                    
                    <input 
                      className="w-full bg-zinc-800 p-3 rounded mb-4 text-white border border-zinc-700 focus:border-yellow-500 outline-none"
                      placeholder="Title"
                      value={newPost.title}
                      onChange={(e) => setNewPost({...newPost, title: e.target.value})}
                    />
                    
                    <select 
                      className="w-full bg-zinc-800 p-3 rounded mb-4 text-white border border-zinc-700 outline-none"
                      value={newPost.category}
                      onChange={(e) => setNewPost({...newPost, category: e.target.value})}
                    >
                      <option value="Exercise">Exercise</option>
                      <option value="Diet">Diet</option>
                      <option value="Routine">Routine</option>
                      <option value="Tip">Tip</option>
                    </select>

                    <input 
                      className="w-full bg-zinc-800 p-3 rounded mb-4 text-white border border-zinc-700 focus:border-yellow-500 outline-none"
                      placeholder="Image URL (Optional)"
                      value={newPost.image_url}
                      onChange={(e) => setNewPost({...newPost, image_url: e.target.value})}
                    />

                    <textarea 
                      className="w-full bg-zinc-800 p-3 rounded mb-6 text-white border border-zinc-700 focus:border-yellow-500 outline-none h-32 resize-none"
                      placeholder="Content..."
                      value={newPost.content}
                      onChange={(e) => setNewPost({...newPost, content: e.target.value})}
                    />

                    <div className="flex justify-end gap-3">
                      <button 
                        onClick={() => setShowWriteModal(false)}
                        className="px-4 py-2 text-zinc-400 hover:text-white font-bold"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleSavePost}
                        className="bg-yellow-500 text-black px-6 py-2 rounded font-bold hover:bg-yellow-400 transition"
                      >
                        SAVE POST
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
            </>
          )}
          
        </motion.div>
      )}
    </div>
  );
}

// --- [QRScanner] Live Camera Only ---
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
      setResult({
        success: true,
        userName: userData?.name || '회원',
        message: `출석 완료 (잔여: ${remaining}회)`,
        remainingSessions: remaining
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
      await new Promise(r => setTimeout(r, 150));
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

      {/* Success/Error Modal */}
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
const translateMacrosToFood = (carbsG, proteinG, fatG, meals = 3) => {
  const perMealCarbs = carbsG / meals;
  const perMealProtein = proteinG / meals;
  const perMealFat = fatG / meals;
  const carbsServings = perMealCarbs / 60;
  const proteinServings = perMealProtein / 30;
  const fatServings = perMealFat / 10;
  const fmt = (n) => n % 1 === 0 ? String(n) : n.toFixed(1);
  const fatLabel = fatServings <= 0.3 ? '견과류 조금' : fatServings <= 0.5 ? '아보카도 절반' : fatServings <= 1 ? '아보카도 1개' : `아보카도 ${fmt(fatServings)}개`;
  return {
    carbs: { servings: carbsServings, label: carbsServings < 0.5 ? '밥 반 공기' : `밥 ${fmt(carbsServings)}공기`, alt: `고구마 ${Math.max(1, Math.round(carbsServings * 2))}개` },
    protein: { servings: proteinServings, label: proteinServings < 0.5 ? '닭가슴살 반 덩어리' : `손바닥 크기 ${fmt(proteinServings)}덩어리`, alt: `계란 ${Math.max(1, Math.round(proteinServings * 4))}개` },
    fat: { servings: fatServings, label: fatLabel, alt: `아몬드 ${Math.max(5, Math.round(fatServings * 10))}알` },
  };
};

// --- [MacroCalculator] 스마트 매크로 계산기 ---
const MacroCalculator = ({ user, setView }) => {
  const [goal, setGoal] = useState('diet');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [gender, setGender] = useState('M');
  const [age, setAge] = useState('');
  const [result, setResult] = useState(null);
  const [showHandGuide, setShowHandGuide] = useState(false);

  const calculateMacros = () => {
    if (!height || !weight || !age) {
      alert('키, 몸무게, 나이를 모두 입력해주세요.');
      return;
    }

    const h = parseFloat(height);
    const w = parseFloat(weight);
    const a = parseInt(age);

    if (h <= 0 || w <= 0 || a <= 0) {
      alert('올바른 값을 입력해주세요.');
      return;
    }

    // 1. Calculate BMR (Mifflin-St Jeor Formula)
    let bmr;
    if (gender === 'M') {
      bmr = (10 * w) + (6.25 * h) - (5 * a) + 5;
    } else {
      bmr = (10 * w) + (6.25 * h) - (5 * a) - 161;
    }

    // 2. Apply activity factor (default: 1.375 = moderately active)
    const activityFactor = 1.375;
    const tdee = bmr * activityFactor;

    // 3. Set macros based on goal
    let proteinGPerKg, carbsPercent, fatPercent;
    
    switch(goal) {
      case 'body_profile': // High protein, low carb
        proteinGPerKg = 2.2;
        carbsPercent = 0.25;
        fatPercent = 0.35;
        break;
      case 'diet': // Moderate
        proteinGPerKg = 1.8;
        carbsPercent = 0.35;
        fatPercent = 0.30;
        break;
      case 'muscle_gain': // High carb
        proteinGPerKg = 1.6;
        carbsPercent = 0.50;
        fatPercent = 0.25;
        break;
      default:
        proteinGPerKg = 1.8;
        carbsPercent = 0.35;
        fatPercent = 0.30;
    }

    // 4. Calculate macros
    const proteinG = w * proteinGPerKg;
    const proteinCal = proteinG * 4;
    
    const carbsCal = tdee * carbsPercent;
    const carbsG = carbsCal / 4;
    
    const fatCal = tdee * fatPercent;
    const fatG = fatCal / 9;

    // 5. Per meal (4 meals/day)
    const mealsPerDay = 4;
    const carbsPerMeal = Math.round(carbsG / mealsPerDay);
    const proteinPerMeal = Math.round(proteinG / mealsPerDay);
    const fatPerMeal = Math.round(fatG / mealsPerDay);

    setResult({
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      totalCarbs: Math.round(carbsG),
      totalProtein: Math.round(proteinG),
      totalFat: Math.round(fatG),
      carbsPerMeal,
      proteinPerMeal,
      fatPerMeal
    });
  };

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-white p-6 pb-20 overflow-y-auto">
      <BackButton onClick={() => setView('client_home')} label="Home" />
      
      <header className="text-center mb-6">
        <h2 className="text-2xl font-bold text-yellow-500 mb-2">🍽️ 매크로 계산기</h2>
        <p className="text-zinc-500 text-sm">목표에 맞는 영양 가이드</p>
      </header>

      {/* Input Form */}
      <div className="max-w-md mx-auto space-y-4 mb-8">
        
        {/* Goal Selection */}
        <div>
          <label className="text-xs text-zinc-500 ml-1 mb-2 block uppercase tracking-wider">목표 선택</label>
          <select 
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-yellow-600 outline-none"
          >
            <option value="body_profile">Body Profile (체지방 감량)</option>
            <option value="diet">Diet (다이어트)</option>
            <option value="muscle_gain">Muscle Gain (근육 증량)</option>
          </select>
        </div>

        {/* Height & Weight */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-zinc-500 ml-1 mb-2 block">키 (cm)</label>
            <input 
              type="number" 
              placeholder="170"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-yellow-600 outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 ml-1 mb-2 block">몸무게 (kg)</label>
            <input 
              type="number" 
              placeholder="70"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-yellow-600 outline-none"
            />
          </div>
        </div>

        {/* Age & Gender */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-zinc-500 ml-1 mb-2 block">나이</label>
            <input 
              type="number" 
              placeholder="30"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-yellow-600 outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 ml-1 mb-2 block">성별</label>
            <select 
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-yellow-600 outline-none"
            >
              <option value="M">남성</option>
              <option value="F">여성</option>
            </select>
          </div>
        </div>

        {/* Calculate Button */}
        <button
          onClick={calculateMacros}
          className="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 text-black font-bold py-4 rounded-xl hover:shadow-lg hover:shadow-yellow-500/20 active:scale-95 transition-all"
        >
          계산하기
        </button>
      </div>

      {/* Results */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto space-y-4"
        >
          {/* BMR & TDEE */}
          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
            <h3 className="text-yellow-500 font-bold mb-3">📊 기초 대사량 & 필요 칼로리</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-zinc-500 mb-1">기초대사량 (BMR)</p>
                <p className="text-2xl font-bold text-white">{result.bmr}</p>
                <p className="text-xs text-zinc-600">kcal/일</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">하루 소모량 (TDEE)</p>
                <p className="text-2xl font-bold text-white">{result.tdee}</p>
                <p className="text-xs text-zinc-600">kcal/일</p>
              </div>
            </div>
          </div>

          {/* Daily Totals */}
          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
            <h3 className="text-yellow-500 font-bold mb-3">🍽️ 하루 총량</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">탄수화물</span>
                <span className="text-xl font-bold text-blue-400">{result.totalCarbs}g</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">단백질</span>
                <span className="text-xl font-bold text-red-400">{result.totalProtein}g</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">지방</span>
                <span className="text-xl font-bold text-green-400">{result.totalFat}g</span>
              </div>
            </div>
          </div>

          {/* Per Meal - Numeric */}
          <div className="bg-gradient-to-br from-yellow-900/30 to-zinc-900 rounded-xl p-5 border-2 border-yellow-500/30">
            <h3 className="text-yellow-500 font-bold mb-3 flex items-center gap-2">
              <span>⭐</span> 끼니당 (4끼 기준)
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-zinc-900/50 p-3 rounded-lg">
                <span className="text-zinc-300 font-medium">탄수화물</span>
                <span className="text-2xl font-bold text-blue-400">{result.carbsPerMeal}g</span>
              </div>
              <div className="flex justify-between items-center bg-zinc-900/50 p-3 rounded-lg">
                <span className="text-zinc-300 font-medium">단백질</span>
                <span className="text-2xl font-bold text-red-400">{result.proteinPerMeal}g</span>
              </div>
              <div className="flex justify-between items-center bg-zinc-900/50 p-3 rounded-lg">
                <span className="text-zinc-300 font-medium">지방</span>
                <span className="text-2xl font-bold text-green-400">{result.fatPerMeal}g</span>
              </div>
            </div>

            {/* What to Eat (Per Meal) - Real Food Translation */}
            {(() => {
              const food = translateMacrosToFood(result.totalCarbs, result.totalProtein, result.totalFat, 3);
              return (
                <div className="mt-4 pt-4 border-t border-zinc-700">
                  <h4 className="text-yellow-400 font-bold mb-3 flex items-center gap-2">
                    <span>🍽️</span> 한 끼에 이만큼 (3끼 기준)
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 bg-zinc-900/80 p-3 rounded-lg border border-zinc-700">
                      <span className="text-2xl">🍚</span>
                      <div>
                        <p className="text-white font-medium">{food.carbs.label}</p>
                        <p className="text-zinc-500 text-xs">또는 {food.carbs.alt}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-zinc-900/80 p-3 rounded-lg border border-zinc-700">
                      <span className="text-2xl">🥩</span>
                      <div>
                        <p className="text-white font-medium">{food.protein.label}</p>
                        <p className="text-zinc-500 text-xs">또는 {food.protein.alt}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-zinc-900/80 p-3 rounded-lg border border-zinc-700">
                      <span className="text-2xl">🥑</span>
                      <div>
                        <p className="text-white font-medium">{food.fat.label}</p>
                        <p className="text-zinc-500 text-xs">또는 {food.fat.alt}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Hand Portion Guide Button */}
          <button
            onClick={() => setShowHandGuide(true)}
            className="w-full flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl py-3 text-zinc-300 hover:text-yellow-500 transition"
          >
            <span className="text-xl">🖐️</span>
            <span>저울 없이 손으로 잴까요?</span>
          </button>

          {/* Hand Guide Modal */}
          <AnimatePresence>
            {showHandGuide && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowHandGuide(false)}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
              >
                <motion.div
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.9 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-zinc-900 rounded-xl border-2 border-yellow-500/50 p-6 max-w-sm w-full"
                >
                  <h3 className="text-yellow-500 font-bold text-lg mb-4 flex items-center gap-2">
                    <span>🖐️</span> 손으로 잰다! 간단 가이드
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg">
                      <span className="text-2xl">🖐️</span>
                      <div>
                        <p className="font-bold text-white">단백질</p>
                        <p className="text-zinc-400">손바닥 크기 한 장</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg">
                      <span className="text-2xl">✊</span>
                      <div>
                        <p className="font-bold text-white">채소</p>
                        <p className="text-zinc-400">주먹 하나 분량</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg">
                      <span className="text-2xl">🤲</span>
                      <div>
                        <p className="font-bold text-white">탄수화물</p>
                        <p className="text-zinc-400">접었을 때 손 한 움큼</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg">
                      <span className="text-2xl">👍</span>
                      <div>
                        <p className="font-bold text-white">지방</p>
                        <p className="text-zinc-400">엄지 끝마디 크기</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-zinc-500 text-xs mt-4">저울 없이도 쉽게! 꾸준히만 하면 됩니다 💪</p>
                  <button
                    onClick={() => setShowHandGuide(false)}
                    className="mt-4 w-full py-3 bg-yellow-500 text-black font-bold rounded-xl"
                  >
                    알겠어요!
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Goal Description */}
          <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
            <h4 className="text-sm font-bold text-yellow-500 mb-2">📋 목표 전략</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {goal === 'body_profile' && '고단백 저탄수로 체지방 줄이기! 근육은 지키고 오직 살만 빠지는 식단이에요.'}
              {goal === 'diet' && '균형 잡힌 비율로 건강하게! 무리 없이 꾸준히 하는 게 핵심이에요.'}
              {goal === 'muscle_gain' && '탄수화물 든든히! 근육 키울 에너지를 충분히 채워주는 식단이에요.'}
            </p>
          </div>
        </motion.div>
      )}

      {/* Info Card */}
      {!result && (
        <div className="max-w-md mx-auto bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
          <p className="text-xs text-zinc-500 leading-relaxed">
            💡 주 3~5회 운동하시면 이 수치가 딱이에요! 더 정확히 맞추고 싶으면 코치에게 문의하세요.
          </p>
        </div>
      )}
    </div>
  );
};

// [교체] ClassBooking 컴포넌트 전체
const ALL_HOURLY_SLOTS = Array.from({ length: 18 }, (_, i) => `${(i + 6).toString().padStart(2, '0')}:00`);
const ClassBooking = ({ user, setView }) => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingToConfirm, setBookingToConfirm] = useState(null); // { date, time }
  const [settings, setSettings] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    mon.setHours(0, 0, 0, 0);
    return mon;
  });


  const toDateKey = (d) => {
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  };

  const getWeekDates = () => {
    const arr = [];
    for (let i = 0; i < 7; i++) {
      const dd = new Date(weekStart);
      dd.setDate(weekStart.getDate() + i);
      arr.push(dd);
    }
    return arr;
  };

  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase.from('trainer_settings').select('*').order('day_of_week');
      setSettings(error ? [] : (data || []));
    };
    const fetchHolidays = async () => {
      const { data, error } = await supabase.from('trainer_holidays').select('date');
      setHolidays(error ? [] : (data || []).map((h) => h.date));
    };
    fetchSettings();
    fetchHolidays();
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    const fetchBookings = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.from('bookings').select('*').eq('date', selectedDate);
        if (error) throw error;
        setBookings(Array.isArray(data) ? data : []);
      } catch (err) {
        setBookings([]);
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, [selectedDate]);

  const isSlotBooked = (time) => bookings.some((b) => b.time === time);

  const getDaySetting = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00');
    const dayOfWeek = d.getDay();
    const row = settings.find((s) => s.day_of_week === dayOfWeek);
    return row || { off: dayOfWeek === 0, start_time: '09:00', end_time: '22:00', break_times: [] };
  };

  const isHoliday = (dateStr) => holidays.includes(dateStr);

  const toMins = (t) => {
    const [h, m] = String(t).split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const isSlotInBreakTimes = (dateStr, time) => {
    const daySet = getDaySetting(dateStr);
    const breakTimes = daySet.break_times || [];
    const slotMins = toMins(time);
    for (const bt of breakTimes) {
      const startMins = toMins(bt.start);
      const endMins = toMins(bt.end);
      if (slotMins >= startMins && slotMins < endMins) return true;
    }
    return false;
  };

  const isSlotInWorkingHours = (dateStr, time) => {
    const daySet = getDaySetting(dateStr);
    const startMins = toMins(daySet.start_time || '09:00');
    const endMins = toMins(daySet.end_time || '22:00');
    const slotMins = toMins(time);
    return slotMins >= startMins && slotMins < endMins;
  };

  const isSlotExpired = (dateStr, time) => {
    if (dateStr !== toDateKey(new Date())) return false;
    const now = new Date();
    const slotMins = toMins(time);
    const nowMins = now.getHours() * 60 + now.getMinutes();
    return slotMins <= nowMins;
  };

  const generateTimeSlots = () => {
    if (!selectedDate) return [];
    const dateStr = selectedDate;
    const daySet = getDaySetting(dateStr);

    if (isHoliday(dateStr)) return [];
    if (daySet.off) return [];

    return ALL_HOURLY_SLOTS.filter((time) => {
      if (!isSlotInWorkingHours(dateStr, time)) return false;
      if (isSlotInBreakTimes(dateStr, time)) return false;
      return true;
    });
  };

  const isSlotAvailable = (time) => {
    if (!selectedDate) return false;
    if (isSlotBooked(time)) return false;
    if (isHoliday(selectedDate)) return false;
    if (getDaySetting(selectedDate).off) return false;
    if (!isSlotInWorkingHours(selectedDate, time)) return false;
    if (isSlotInBreakTimes(selectedDate, time)) return false;
    if (isSlotExpired(selectedDate, time)) return false;
    return true;
  };

  const handleBookSlot = (timeSlot) => {
    if (processing) return;
    if (!isSlotAvailable(timeSlot)) return;
    setBookingToConfirm({ date: selectedDate, time: timeSlot });
    setIsBookingModalOpen(true);
  };

  const confirmBookingAction = async () => {
    if (!bookingToConfirm) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .insert([{ user_id: user.id, date: bookingToConfirm.date, time: bookingToConfirm.time }])
        .select();

      if (error) throw error;

      alert("✅ 예약 완료!");
      const { data: updated } = await supabase.from('bookings').select('*').eq('date', bookingToConfirm.date);
      setBookings(updated || []);
    } catch (err) {
      alert("❌ 예약 실패: " + err.message);
    } finally {
      setProcessing(false);
      setBookingToConfirm(null);
      setIsBookingModalOpen(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-white p-6 pb-20">
      <BackButton onClick={() => setView('client_home')} label="Home" />
      
      <header className="text-center mb-6">
        <h2 className="text-lg font-serif text-yellow-500">CLASS BOOKING</h2>
      </header>

      {/* Week Slider - Mon to Sun */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => { const p = new Date(weekStart); p.setDate(p.getDate() - 7); setWeekStart(p); }} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400">
            <ChevronLeft size={22} />
          </button>
          <span className="text-sm text-zinc-400">
            {getWeekDates()[0].toLocaleDateString('en-US', { weekday: 'short' })} {getWeekDates()[0].getDate()} - {getWeekDates()[6].toLocaleDateString('en-US', { weekday: 'short' })} {getWeekDates()[6].getDate()}
          </span>
          <button onClick={() => { const n = new Date(weekStart); n.setDate(n.getDate() + 7); setWeekStart(n); }} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400">
            <ChevronRight size={22} />
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {getWeekDates().map((date) => {
            const dateStr = toDateKey(date);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            const dayNum = date.getDate();
            const isSelected = selectedDate === dateStr;
            const isToday = dateStr === toDateKey(new Date());
            const todayKey = toDateKey(new Date());
            const isPast = dateStr < todayKey;
            const isHolidayDate = isHoliday(dateStr);
            return (
              <button
                key={dateStr}
                onClick={() => !isPast && setSelectedDate(dateStr)}
                disabled={isPast}
                className={`shrink-0 p-3 rounded-xl border flex flex-col items-center min-w-[64px] ${
                  isSelected ? 'bg-yellow-600 border-yellow-500 text-white' :
                  isPast ? 'bg-zinc-900/50 border-zinc-800 text-zinc-600 cursor-not-allowed' :
                  isHolidayDate ? 'bg-red-900/20 border-red-800/50 text-zinc-500' :
                  'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-yellow-600/50'
                }`}
              >
                <span className="text-[10px] uppercase">{dayName}</span>
                <span className="text-lg font-bold">{dayNum}</span>
                {isToday && <span className="text-[9px] text-yellow-500 mt-0.5">Today</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* 시간 선택 */}
      {selectedDate && (
        <>
          <h3 className="text-sm text-zinc-400 mb-3 uppercase tracking-widest">예약 가능 시간</h3>
          {isHoliday(selectedDate) ? (
            <p className="text-center text-zinc-400 py-8">Today is a trainer&apos;s day off. 💤</p>
          ) : getDaySetting(selectedDate).off ? (
            <p className="text-center text-zinc-400 py-8">Today is a trainer&apos;s day off. 💤</p>
          ) : loading ? (
            <p className="text-center text-zinc-600 py-10">Loading...</p>
          ) : generateTimeSlots().length === 0 ? (
            <p className="text-center text-zinc-500 py-8">No available slots for this day.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {generateTimeSlots().map((time) => {
                const available = isSlotAvailable(time);
                const booked = isSlotBooked(time);
                const expired = isSlotExpired(selectedDate, time);
                const disabled = !available || processing;
                return (
                  <button
                    key={time}
                    disabled={disabled}
                    onClick={() => handleBookSlot(time)}
                    className={`p-4 rounded-xl border text-lg font-bold flex justify-between items-center transition ${
                      expired ? 'bg-zinc-900/30 border-zinc-800 text-zinc-600 cursor-not-allowed' :
                      booked ? 'bg-zinc-900/50 border-zinc-800 text-zinc-700 cursor-not-allowed' :
                      available ? 'bg-zinc-900 border-zinc-800 text-white hover:border-yellow-600' :
                      'bg-zinc-900/50 border-zinc-800 text-zinc-600 cursor-not-allowed'
                    }`}
                  >
                    <span className={expired ? 'line-through' : ''}>{time}</span>
                    {booked && <span className="text-xs text-red-500">예약됨</span>}
                    {expired && !booked && <span className="text-xs text-zinc-500">지남</span>}
                    {available && <span className="text-green-500">●</span>}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Booking Confirmation Modal */}
      {isBookingModalOpen && bookingToConfirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => { setIsBookingModalOpen(false); setBookingToConfirm(null); }}
        >
          <div
            className="bg-zinc-900 border border-yellow-500/30 rounded-2xl shadow-2xl shadow-black/50 p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-zinc-100 mb-2">수업 예약</h3>
            <p className="text-zinc-400 text-sm mb-6">
              {bookingToConfirm.date} {bookingToConfirm.time} 수업을 예약하시겠습니까?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setIsBookingModalOpen(false); setBookingToConfirm(null); }}
                className="px-4 py-2.5 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
              >
                취소
              </button>
              <button
                onClick={confirmBookingAction}
                disabled={processing}
                className="px-4 py-2.5 rounded-xl bg-yellow-600 text-black font-bold hover:bg-yellow-500 transition disabled:opacity-50"
              >
                {processing ? '처리 중...' : '예약확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const toTime24h = (t) => {
  if (!t || typeof t !== 'string') return t || '—';
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  return t;
};

// --- [AdminSchedule] 관리자 스케줄 관리 화면 ---
const AdminSchedule = ({ setView }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState(null); // { id, userName, date, time }
  const [expandedScheduleDates, setExpandedScheduleDates] = useState(new Set());

  const bookingsByDate = React.useMemo(() => {
    const map = {};
    (bookings || []).forEach((b) => {
      const key = b.date;
      if (!map[key]) map[key] = [];
      map[key].push(b);
    });
    Object.values(map).forEach((arr) => arr.sort((a, b) => (a.time || '').localeCompare(b.time || '')));
    return map;
  }, [bookings]);

  const scheduleDatesSorted = React.useMemo(() => Object.keys(bookingsByDate).sort(), [bookingsByDate]);

  const toggleScheduleDateExpanded = (key) => {
    setExpandedScheduleDates((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    if (scheduleDatesSorted.length > 0) {
      setExpandedScheduleDates(new Set(scheduleDatesSorted));
    }
  }, [scheduleDatesSorted]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, profiles(name, email)')
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      console.log('[AdminSchedule] bookings:', data, 'error:', error);
      if (error) throw error;
      setBookings(data || []);
    } catch (err) {
      console.error('[AdminSchedule] fetch error:', err);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleCancelBooking = (bookingId, userName, date, time) => {
    setBookingToDelete({ id: bookingId, userName, date, time });
    setIsCancelModalOpen(true);
  };

  const confirmCancelAction = async () => {
    if (!bookingToDelete) return;
    setCancelling(bookingToDelete.id);
    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('id', bookingToDelete.id);

    if (error) {
      alert('Error cancelling booking: ' + error.message);
    } else {
      alert('Booking cancelled successfully!');
      fetchBookings(); // Refresh list
    }
    setCancelling(null);
    setBookingToDelete(null);
    setIsCancelModalOpen(false);
  };

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-white p-6 pb-20">
      <BackButton onClick={() => setView('admin_home')} label="Admin Home" />
      
      <header className="flex items-center justify-center mb-6">
        <h2 className="text-lg font-serif text-yellow-500">ALL SCHEDULES</h2>
      </header>

      {loading ? (
        <p className="text-zinc-500 text-center py-10">Loading schedules...</p>
      ) : bookings.length > 0 ? (
        <div className="space-y-3">
          {scheduleDatesSorted.map((dateKey) => {
            const dayBookings = bookingsByDate[dateKey] || [];
            const isExpanded = expandedScheduleDates.has(dateKey);
            return (
              <div key={dateKey} className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                <button
                  onClick={() => toggleScheduleDateExpanded(dateKey)}
                  className="w-full flex items-center justify-between gap-4 px-4 py-3 hover:bg-zinc-800/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <Calendar size={18} className="text-yellow-500 shrink-0" />
                    <span className="font-bold text-white">{dateKey}</span>
                    <span className="text-zinc-500 text-sm">({dayBookings.length} bookings)</span>
                  </div>
                  {isExpanded ? <ChevronUp size={20} className="text-zinc-400" /> : <ChevronDown size={20} className="text-zinc-400" />}
                </button>
                {isExpanded && (
                  <div className="border-t border-zinc-800 divide-y divide-zinc-800">
                    {dayBookings.map((booking) => (
                      <div
                        key={booking.id}
                        className="flex justify-between items-center gap-4 p-4 bg-zinc-900/50 hover:bg-zinc-800/30 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-white truncate">
                            {booking.profiles?.name || 'Unknown User'}
                          </h3>
                          <p className="text-zinc-500 text-xs truncate">{booking.profiles?.email || '-'}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex items-center gap-2 text-yellow-500 font-mono text-sm">
                            <Clock size={14} />
                            <span>{toTime24h(booking.time)}</span>
                          </div>
                          <button
                            onClick={() => handleCancelBooking(
                              booking.id,
                              booking.profiles?.name || 'User',
                              booking.date,
                              booking.time
                            )}
                            disabled={cancelling === booking.id}
                            className="p-2 rounded-lg bg-red-600/20 border border-red-600/30 text-red-500 hover:bg-red-600/30 active:scale-95 transition-all disabled:opacity-50"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Calendar size={64} className="text-zinc-700 mb-4" />
          <h3 className="text-xl font-bold text-zinc-500 mb-2">No Bookings</h3>
          <p className="text-sm text-zinc-600">No scheduled classes yet</p>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {isCancelModalOpen && bookingToDelete && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => { setIsCancelModalOpen(false); setBookingToDelete(null); }}
        >
          <div
            className="bg-zinc-900 border border-yellow-500/30 rounded-2xl shadow-2xl shadow-black/50 p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-zinc-100 mb-2">예약 취소</h3>
            <p className="text-zinc-400 text-sm mb-6">
              {bookingToDelete.userName}님의 {bookingToDelete.date} {bookingToDelete.time} 예약을 취소할까요?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setIsCancelModalOpen(false); setBookingToDelete(null); }}
                className="px-4 py-2.5 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
              >
                취소
              </button>
              <button
                onClick={confirmCancelAction}
                disabled={cancelling === bookingToDelete.id}
                className="px-4 py-2.5 rounded-xl bg-yellow-600 text-black font-bold hover:bg-yellow-500 transition disabled:opacity-50"
              >
                {cancelling === bookingToDelete.id ? '처리 중...' : '예, 취소할게요'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- [AdminSettings] Working Hours & Holidays (trainer_settings + trainer_holidays) ---
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const DEFAULT_START = '09:00';
const DEFAULT_END = '22:00';

const AdminSettings = ({ setView }) => {
  const [settings, setSettings] = useState(() => Array.from({ length: 7 }, (_, d) => ({
    day_of_week: d, off: d === 0, start_time: DEFAULT_START, end_time: DEFAULT_END, break_times: [],
  })));
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newOffDay, setNewOffDay] = useState(1);
  const [newOffStart, setNewOffStart] = useState('12:00');
  const [newOffEnd, setNewOffEnd] = useState('13:00');

  const fetchData = async () => {
    setLoading(true);
    const { data: sett, error: e1 } = await supabase.from('trainer_settings').select('*').order('day_of_week');
    const { data: hols, error: e2 } = await supabase.from('trainer_holidays').select('*').order('date', { ascending: false });
    if (!e1 && sett && sett.length) {
      const arr = Array.from({ length: 7 }, (_, d) => {
        const row = sett.find((s) => s.day_of_week === d);
        return row ? {
          day_of_week: d,
          off: !!row.off,
          start_time: (row.start_time || DEFAULT_START).toString().slice(0, 5),
          end_time: (row.end_time || DEFAULT_END).toString().slice(0, 5),
          break_times: Array.isArray(row.break_times) ? row.break_times : [],
        } : { day_of_week: d, off: d === 0, start_time: DEFAULT_START, end_time: DEFAULT_END, break_times: [] };
      });
      setSettings(arr);
    }
    setHolidays(e2 ? [] : (hols || []));
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { if (saveToast) { const t = setTimeout(() => setSaveToast(false), 2500); return () => clearTimeout(t); } }, [saveToast]);

  const updateDay = (dow, fn) => {
    setSettings((prev) => prev.map((s) => s.day_of_week === dow ? fn(s) : s));
  };

  const toggleDayOff = (dow) => updateDay(dow, (s) => ({ ...s, off: !s.off }));

  const setDayStartEnd = (dow, start, end) => updateDay(dow, (s) => ({ ...s, start_time: start, end_time: end }));

  const addBreakTime = (dow, start, end) => {
    updateDay(dow, (s) => ({ ...s, break_times: [...(s.break_times || []), { start, end }] }));
  };

  const removeBreakTime = (dow, idx) => {
    updateDay(dow, (s) => ({
      ...s,
      break_times: (s.break_times || []).filter((_, i) => i !== idx),
    }));
  };

  const saveSettings = async () => {
    setSaving(true);
    const rows = settings.map((s) => ({
      day_of_week: s.day_of_week,
      off: s.off,
      start_time: s.start_time,
      end_time: s.end_time,
      break_times: s.break_times || [],
    }));
    const { error } = await supabase.from('trainer_settings').upsert(rows, { onConflict: 'day_of_week' });
    setSaving(false);
    if (!error) {
      setSaveToast(true);
    } else {
      alert('저장 실패: ' + error.message);
    }
  };

  const addHoliday = async () => {
    if (!newHolidayDate) return;
    const { error } = await supabase.from('trainer_holidays').insert({ date: newHolidayDate, label: newHolidayDate });
    if (!error) { setNewHolidayDate(''); fetchData(); } else { alert('추가 실패: ' + error.message); }
  };

  const removeHoliday = async (id) => {
    await supabase.from('trainer_holidays').delete().eq('id', id);
    fetchData();
  };

  if (loading) return <div className="min-h-[100dvh] bg-zinc-950 p-6 text-white"><p className="text-zinc-500">Loading...</p></div>;

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-white p-6 pb-24 relative">
      {saveToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-yellow-600 text-black font-bold rounded-xl shadow-lg animate-pulse">
          Settings Saved ✓
        </div>
      )}
      <BackButton onClick={() => setView('admin_home')} label="Admin Home" />
      <h2 className="text-2xl font-bold text-yellow-500 mb-6">Day Off Settings</h2>

      {/* Weekly Day Off + Working Hours */}
      <div className="mb-8">
        <h3 className="text-yellow-400 font-bold mb-3">📅 주간 휴무 & 근무시간</h3>
        <div className="space-y-2 mb-4">
          {settings.map((s) => (
            <div key={s.day_of_week} className="p-3 bg-zinc-900 rounded-xl border border-zinc-800">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <span className="font-medium w-8">{DAY_NAMES[s.day_of_week]}</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={s.off} onChange={() => toggleDayOff(s.day_of_week)} className="accent-yellow-500" />
                  <span className="text-sm text-zinc-400">하루 종일 휴무</span>
                </label>
                {!s.off && (
                  <div className="flex items-center gap-2 text-sm">
                    <input type="time" value={s.start_time} onChange={(e) => setDayStartEnd(s.day_of_week, e.target.value, s.end_time)} className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white" />
                    <span className="text-zinc-500">~</span>
                    <input type="time" value={s.end_time} onChange={(e) => setDayStartEnd(s.day_of_week, s.start_time, e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white" />
                  </div>
                )}
              </div>
              {!s.off && (s.break_times || []).length > 0 && (
                <div className="mt-2 ml-10 flex flex-wrap gap-2">
                  {(s.break_times || []).map((bt, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-800 rounded text-xs">
                      {bt.start}-{bt.end}
                      <button onClick={() => removeBreakTime(s.day_of_week, idx)} className="text-red-500 hover:underline">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 p-3 bg-zinc-900 rounded-xl border border-zinc-800 mb-3">
          <select value={newOffDay} onChange={(e) => setNewOffDay(Number(e.target.value))} className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm">
            {[0, 1, 2, 3, 4, 5, 6].map((d) => <option key={d} value={d}>{DAY_NAMES[d]}</option>)}
          </select>
          <input type="time" value={newOffStart} onChange={(e) => setNewOffStart(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm" />
          <span className="text-zinc-500">~</span>
          <input type="time" value={newOffEnd} onChange={(e) => setNewOffEnd(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm" />
          <button onClick={() => { addBreakTime(newOffDay, newOffStart, newOffEnd); }} className="px-4 py-2 bg-yellow-600 text-black font-bold rounded-lg text-sm">추가</button>
        </div>
        <button onClick={saveSettings} disabled={saving} className="w-full py-3 bg-yellow-600 text-black font-bold rounded-xl hover:bg-yellow-500 disabled:opacity-50">
          {saving ? '저장 중...' : '저장 (Save)'}
        </button>
      </div>

      {/* Specific Holidays */}
      <div>
        <h3 className="text-yellow-400 font-bold mb-3">📆 특정 휴무일</h3>
        <div className="flex gap-2 mb-4">
          <input type="date" value={newHolidayDate} onChange={(e) => setNewHolidayDate(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white" />
          <button onClick={addHoliday} className="bg-yellow-600 text-black font-bold px-4 py-2 rounded-lg">추가</button>
        </div>
        <div className="space-y-2">
          {holidays.slice(0, 20).map((h) => (
            <div key={h.id} className="flex items-center justify-between p-3 bg-zinc-900 rounded-xl border border-zinc-800">
              <span className="font-mono">{h.date}</span>
              <button onClick={() => removeHoliday(h.id)} className="text-red-500 text-sm hover:underline">삭제</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- [AdminHome] 관리자 메인 화면 ---
const AdminHome = ({ setView, logout }) => {
  const handleForceSaveID = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('로그인 정보가 없습니다. 다시 로그인해 주세요.');
      return;
    }
    const osId = OneSignal.User?.PushSubscription?.id;
    if (!osId) {
      alert('OneSignal ID가 감지되지 않습니다. 알림 권한을 허용했는지 확인하세요.');
      return;
    }
    const { error } = await supabase
      .from('profiles')
      .update({ onesignal_id: osId })
      .eq('id', user.id);

    if (error) {
      alert('DB 저장 실패: ' + error.message);
    } else {
      const { data: profile } = await supabase
        .from('profiles')
        .select('onesignal_id')
        .eq('id', user.id)
        .single();
      const verified = profile?.onesignal_id === osId;
      alert(verified
        ? '성공! 관리자 알림 ID가 저장되었습니다: ' + osId
        : '저장 완료. (확인: ' + (profile?.onesignal_id || 'null') + ')');
    }
  };

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-white flex flex-col relative pb-safe">
      <header className="p-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-serif text-yellow-500">THE COACH</h2>
          <p className="text-zinc-500 text-xs">Manager Mode</p>
        </div>
        <button onClick={logout}><LogOut size={20} className="text-zinc-600 hover:text-white transition-colors" /></button>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-yellow-600 to-amber-600 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
          <button onClick={() => setView('scanner')} className="relative w-48 h-48 rounded-full bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-2xl">
            <Camera size={40} className="text-yellow-500" />
            <span className="text-sm tracking-widest font-medium text-zinc-300">QR SCAN</span>
          </button>
        </div>
        <div className="w-full max-w-xs space-y-2 mt-8">
           <ButtonGhost onClick={() => setView('member_list')}>CLIENT LIST</ButtonGhost>
           <ButtonGhost onClick={() => setView('revenue')}>📅 DASHBOARD</ButtonGhost>
           <ButtonGhost onClick={() => setView('library')}>LIBRARY</ButtonGhost>
           <ButtonGhost onClick={() => setView('admin_settings')}>⚙️ SETTINGS</ButtonGhost>
           <button
             onClick={handleForceSaveID}
             className="w-full py-3 px-4 rounded-xl text-sm font-medium bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:border-yellow-500/30 transition-colors"
           >
             🔔 알림 연동 확인
           </button>
        </div>
      </div>
    </div>
  );
};

// --- [MemberList] 회원 목록 (DB에서 가져옴) ---
const MemberList = ({ setView, setSelectedMemberId }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUsers = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('role', 'user'); 
            if (error) console.error(error);
            else setUsers(data);
            setLoading(false);
        };
        fetchUsers();
    }, []);

    return (
      <div className="min-h-[100dvh] bg-zinc-950 text-white p-6">
        <BackButton onClick={() => setView('admin_home')} label="Admin Home" />
        
        <header className="flex items-center justify-between mb-8">
          <div></div>
          <h2 className="text-lg font-serif text-yellow-500">CLIENTS</h2>
          <div className="w-6"></div>
        </header>
        <div className="space-y-4">
          {loading ? (
              <p className="text-zinc-500 text-center py-10">Loading clients...</p>
          ) : users.length > 0 ? (
              users.map(u => (
                <div key={u.id} onClick={() => { setSelectedMemberId(u.id); setView('member_detail'); }} className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex justify-between items-center active:bg-zinc-800 hover:border-yellow-600/30 transition-colors cursor-pointer">
                    <div>
                        <h3 className="font-bold text-lg text-white">{u.name}</h3>
                        <p className="text-zinc-500 text-xs mt-1">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <span className="block text-[10px] text-zinc-500 uppercase tracking-wider">Remaining</span>
                            <span className="text-lg font-serif text-yellow-500">{u.remaining_sessions}</span>
                        </div>
                        <ChevronRight size={20} className="text-zinc-600" />
                    </div>
                </div>
              ))
          ) : (
              <div className="text-zinc-500 text-center py-10 flex flex-col items-center gap-2">
                  <User size={40} className="opacity-20"/>
                  <p>등록된 회원이 없습니다.</p>
              </div>
          )}
        </div>
      </div>
    );
};

// --- [MemberDetail] 회원 상세 & 세션 티켓 관리 ---
const MemberDetail = ({ selectedMemberId, setView }) => {
    const [u, setU] = useState(null);
    const [batches, setBatches] = useState([]);
    const [addAmount, setAddAmount] = useState('');
    const [priceInput, setPriceInput] = useState(0);
    const [loading, setLoading] = useState(false);
    const [loadingBatches, setLoadingBatches] = useState(true);

    const fetchMemberDetails = async () => {
        // Fetch user profile
        const { data: userData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', selectedMemberId)
            .single();
        setU(userData);
        setPriceInput(userData?.price_per_session || 0);

        // Fetch session batches (tickets)
        setLoadingBatches(true);
        const { data: batchData, error: batchError } = await supabase
            .from('session_batches')
            .select('*')
            .eq('user_id', selectedMemberId)
            .gt('remaining_count', 0) // Only active batches
            .order('created_at', { ascending: true }); // Oldest first (FIFO)

        if (batchError) {
            console.error('Error fetching batches:', batchError);
            setBatches([]);
        } else {
            setBatches(batchData || []);
        }
        setLoadingBatches(false);
    };

    useEffect(() => {
        fetchMemberDetails();
    }, [selectedMemberId]);

    // Calculate total: If batches exist, sum them; otherwise, use profile's remaining_sessions
    const totalRemaining = batches.length > 0 
        ? batches.reduce((sum, batch) => sum + batch.remaining_count, 0)
        : (u?.remaining_sessions || 0);

    const handleAddSession = async () => {
        // Validation
        if (!addAmount || isNaN(addAmount)) {
            return alert('세션 횟수를 입력해주세요.');
        }
        if (priceInput === null || priceInput === '' || isNaN(priceInput)) {
            return alert('유효한 단가를 입력해주세요.');
        }

        const sessionAmount = parseInt(addAmount);
        const priceValue = parseInt(priceInput);

        if (sessionAmount <= 0) {
            return alert('세션 횟수는 1 이상이어야 합니다.');
        }
        if (priceValue < 0) {
            return alert('단가는 0 이상이어야 합니다.');
        }

        // Confirmation
        const confirmMessage = `${u.name}님에게\n• 세션 ${sessionAmount}회 추가\n• 단가: ${priceValue.toLocaleString()}원/회\n\n새로운 티켓을 생성하시겠습니까?`;
        if (!confirm(confirmMessage)) return;

        // Call RPC function to add new session batch
        setLoading(true);
        const { data, error } = await supabase.rpc('admin_add_session_batch', {
            target_user_id: selectedMemberId,
            sessions_to_add: sessionAmount,
            price: priceValue
        });

        if (error) {
            alert('오류 발생: ' + error.message);
            setLoading(false);
        } else {
            alert(`✓ 새 티켓 추가 완료!\n• ${sessionAmount}회\n• ${priceValue.toLocaleString()}원/회`);
            setAddAmount(''); 
            // CRUCIAL: Refresh all data to show the new batch immediately
            await fetchMemberDetails();
            setLoading(false);
        }
    };

    if (!u) return <div className="min-h-[100dvh] bg-zinc-950 flex items-center justify-center text-zinc-500">Loading...</div>;

    return (
      <div className="min-h-[100dvh] bg-zinc-950 text-white p-6 pb-20 relative">
        <BackButton onClick={() => setView('member_list')} label="Client List" />
        
        <header className="flex items-center justify-center mb-6">
          <h2 className="text-lg font-serif text-yellow-500">{u?.name}</h2>
        </header>
        
        <div className="space-y-6">
          {/* Top Summary - Total Remaining Sessions */}
          <div className="bg-gradient-to-br from-zinc-800 to-zinc-900 p-6 rounded-2xl border border-zinc-700/50 relative overflow-hidden shadow-xl">
            <div className="relative z-10">
                <div className="flex justify-between items-end mb-2">
                    <span className="text-zinc-400 text-sm tracking-widest uppercase">Total Remaining</span>
                    <span className="text-4xl font-serif text-yellow-500">{totalRemaining}</span>
                </div>
                <p className="text-zinc-500 text-xs">{u.email}</p>
                {batches.length > 0 && (
                    <p className="text-zinc-600 text-xs mt-1">
                        {batches.length} active ticket{batches.length > 1 ? 's' : ''}
                    </p>
                )}
            </div>
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <CreditCard size={100} className="text-white"/>
            </div>
          </div>

          {/* Ticket List (Session Batches) */}
          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <History size={16} className="text-yellow-500"/> 
                  Active Session Packs
              </h3>
              
              {loadingBatches ? (
                  <p className="text-zinc-500 text-center py-6">Loading tickets...</p>
              ) : batches.length > 0 ? (
                  <div className="space-y-3">
                      {batches.map((batch, index) => {
                          const isInUse = index === 0; // First batch (oldest) is currently being used
                          const batchDate = new Date(batch.created_at).toLocaleDateString('ko-KR', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit'
                          }).replace(/\. /g, '.').replace(/\.$/, ''); // Format: 2024.02.09
                          
                          return (
                              <div 
                                  key={batch.id}
                                  className={`bg-zinc-950 rounded-lg p-4 transition-all ${
                                      isInUse 
                                          ? 'border-2 border-yellow-600/70 bg-yellow-600/5' 
                                          : 'border border-zinc-800'
                                  }`}
                              >
                                  <div className="flex justify-between items-start mb-3">
                                      <div className="flex-1">
                                          {/* Date */}
                                          <div className="flex items-center gap-2 mb-2">
                                              <Calendar size={14} className={isInUse ? 'text-yellow-500' : 'text-zinc-500'} />
                                              <span className="text-sm text-zinc-400">{batchDate}</span>
                                              {isInUse && (
                                                  <span className="text-xs bg-yellow-600 text-black font-bold px-2 py-0.5 rounded">
                                                      IN USE
                                                  </span>
                                              )}
                                          </div>
                                          
                                          {/* Status & Price */}
                                          <div className="flex items-center gap-6">
                                              <div>
                                                  <span className="text-xs text-zinc-500 block mb-1">🎫 Status</span>
                                                  <span className="text-lg font-bold text-white">
                                                      {batch.remaining_count} / {batch.total_count}
                                                  </span>
                                              </div>
                                              <div className="h-10 w-px bg-zinc-800"></div>
                                              <div>
                                                  <span className="text-xs text-zinc-500 block mb-1">💰 Price</span>
                                                  <span className="text-lg font-serif text-yellow-500">
                                                      {batch.price_per_session.toLocaleString()}
                                                      <span className="text-xs ml-1">원</span>
                                                  </span>
                                              </div>
                                          </div>
                                      </div>
                                  </div>
                                  
                                  {/* Progress Bar */}
                                  <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                                      <div 
                                          className={`h-full rounded-full transition-all ${
                                              isInUse ? 'bg-yellow-600' : 'bg-zinc-700'
                                          }`}
                                          style={{ 
                                              width: `${(batch.remaining_count / batch.total_count) * 100}%` 
                                          }}
                                      ></div>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              ) : (
                  <div className="text-center py-8 border border-zinc-800 rounded-lg bg-zinc-950">
                      <CreditCard size={40} className="mx-auto mb-3 opacity-20 text-zinc-600" />
                      <p className="text-sm text-zinc-500 mb-1">No detailed purchase history available</p>
                      {u.remaining_sessions > 0 && (
                          <p className="text-xs text-zinc-600">
                              (Showing legacy balance: {u.remaining_sessions} sessions)
                          </p>
                      )}
                  </div>
              )}
          </div>

          {/* Add New Session Pack */}
          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Plus size={16} className="text-yellow-500"/> 
                  Add New Session Pack
              </h3>

              {/* Input Fields */}
              <div className="space-y-3">
                  <div>
                      <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-2">
                          Sessions to Add
                      </label>
                      <input 
                        type="number" 
                        placeholder="예: 10" 
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-yellow-600 outline-none transition-colors"
                        value={addAmount}
                        onChange={e => setAddAmount(e.target.value)}
                      />
                  </div>
                  
                  <div>
                      <label className="text-xs text-zinc-400 uppercase tracking-wider block mb-2">
                          Unit Price (KRW)
                      </label>
                      <input 
                        type="number" 
                        placeholder="예: 50000" 
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-yellow-600 outline-none transition-colors"
                        value={priceInput}
                        onChange={e => setPriceInput(e.target.value)}
                      />
                  </div>
              </div>

              {/* Action Button */}
              <button 
                onClick={handleAddSession}
                disabled={loading}
                className="w-full bg-yellow-600 text-white font-bold py-3 rounded-lg text-sm hover:bg-yellow-500 active:scale-95 transition-all disabled:opacity-50"
              >
                  {loading ? '처리 중...' : 'ADD SESSION PACK'}
              </button>

              {/* Helper Text */}
              <p className="text-xs text-zinc-500 flex items-start gap-2">
                <Sparkles size={14} className="mt-0.5 flex-shrink-0" />
                <span>새 티켓이 추가되며, 가장 오래된 티켓부터 소진됩니다 (FIFO)</span>
              </p>
          </div>

          {/* User Info Section */}
          <div className="pt-6 border-t border-zinc-800 space-y-4">
             <div>
                 <label className="text-xs text-zinc-500 uppercase tracking-widest block mb-1">Goal</label>
                 <p className="text-sm text-zinc-300 bg-zinc-900 p-3 rounded-lg border border-zinc-800">
                     {u.goal || '등록된 목표가 없습니다.'}
                 </p>
             </div>
             <div className="flex gap-4">
                 <div className="flex-1">
                     <label className="text-xs text-zinc-500 uppercase tracking-widest block mb-1">Birth</label>
                     <p className="text-sm text-zinc-300">{u.dob || '-'}</p>
                 </div>
                 <div className="flex-1">
                     <label className="text-xs text-zinc-500 uppercase tracking-widest block mb-1">Gender</label>
                     <p className="text-sm text-zinc-300">{u.gender === 'M' ? 'Male' : 'Female'}</p>
                 </div>
             </div>
          </div>
        </div>
      </div>
    );
};

// --- [Admin Route] 관리자만 접근 가능한 페이지 ---
const AdminRoute = ({ children, session, setView }) => {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const check = async () => {
      if (!session?.user?.id) {
        setView?.('login');
        setChecking(false);
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();
      setChecking(false);
      if (error || data?.role !== 'admin') {
        setIsAdmin(false);
        setView?.('client_home');
      } else {
        setIsAdmin(true);
      }
    };
    check();
  }, [session?.user?.id, setView]);

  if (checking) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 flex items-center justify-center text-zinc-500">
        권한 확인 중...
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 flex flex-col items-center justify-center p-6 text-white">
        <p className="text-xl font-bold text-red-500 mb-2">Access Denied</p>
        <p className="text-zinc-400 text-sm mb-4">관리자 권한이 필요합니다.</p>
        <button
          onClick={() => setView?.('client_home')}
          className="px-6 py-2 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition"
        >
          홈으로
        </button>
      </div>
    );
  }
  return children;
};
