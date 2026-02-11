import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QrCode, Camera, CheckCircle, ChevronRight, BookOpen, LogOut, Plus, User, X, CreditCard, History, Search, ArrowLeft, Edit3, Save, Sparkles, MessageSquare, Calendar, Clock, ChevronLeft, XCircle, Trash2, Edit, Image } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

// [중요] 우리가 만든 Supabase 연결 도구와 페이지 가져오기
import { supabase } from './lib/supabaseClient'; 
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
        // [관리자 뒷문] admin / 1234 입력 시 강제 이동
        if (email === 'admin' && pw === '1234') {
            alert('관리자 모드로 진입합니다.');
            setView('admin_home'); // 화면을 강제로 관리자 홈으로 바꿈
            return;
        }

        setLoading(true);
        // 일반 회원은 Supabase 인증 사용
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: pw,
        });
        setLoading(false);

        if (error) {
            alert('로그인 실패: ' + error.message);
        } else {
            console.log("로그인 성공!", data);
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

  const handleCancelBooking = async (bookingId, date, time) => {
    if (!confirm(`Cancel booking on ${date} at ${time}?`)) return;

    setCancelling(bookingId);
    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('id', bookingId);

    if (error) {
      alert('Error cancelling booking: ' + error.message);
    } else {
      alert('Booking cancelled successfully!');
      fetchMyBookings(); // Refresh list
    }
    setCancelling(null);
  };

  const handleOpenSchedule = () => {
    setShowScheduleModal(true);
    fetchMyBookings();
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

              {/* QR Code Simulation Box */}
              <div className="bg-white p-6 rounded-xl mb-6 flex items-center justify-center min-h-[280px]">
                <div className="text-center">
                  <QrCode size={200} className="text-zinc-900 mx-auto mb-4" />
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

      {/* My Schedule Modal */}
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
              className="bg-zinc-900 border-2 border-yellow-500 rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif text-yellow-500">MY SCHEDULE</h3>
                <button 
                  onClick={() => setShowScheduleModal(false)}
                  className="text-zinc-500 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Bookings List */}
              {loadingBookings ? (
                <p className="text-zinc-500 text-center py-10">Loading...</p>
              ) : myBookings.length > 0 ? (
                <div className="space-y-3 mb-4">
                  {myBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="bg-zinc-800 border border-zinc-700 rounded-xl p-4"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="flex items-center gap-2 text-yellow-500">
                              <Calendar size={16} />
                              <span className="font-medium">{booking.date}</span>
                            </div>
                            <div className="flex items-center gap-2 text-yellow-500">
                              <Clock size={16} />
                              <span className="font-serif text-lg">{booking.time}</span>
                            </div>
                          </div>
                          <p className="text-zinc-500 text-xs">
                            Booked on {new Date(booking.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={() => handleCancelBooking(booking.id, booking.date, booking.time)}
                          disabled={cancelling === booking.id}
                          className="p-2 rounded-lg bg-red-600/20 border border-red-600/30 text-red-500 hover:bg-red-600/30 active:scale-95 transition-all disabled:opacity-50"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Calendar size={64} className="text-zinc-700 mb-4" />
                  <h4 className="text-lg font-bold text-zinc-500 mb-2">No Bookings</h4>
                  <p className="text-sm text-zinc-600">You haven't booked any classes yet</p>
                </div>
              )}

              {/* Close Button */}
              <button
                onClick={() => setShowScheduleModal(false)}
                className="w-full bg-yellow-600 text-white font-bold py-3 rounded-lg hover:bg-yellow-500 active:scale-95 transition-all"
              >
                CLOSE
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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

  // [Smart Revenue State]
  const [currentRevenueDate, setCurrentRevenueDate] = useState(new Date());
  const [revenueLogs, setRevenueLogs] = useState([]);
  const [isRevenueLoading, setIsRevenueLoading] = useState(false);
  
  // Salary Configuration (Persist in LocalStorage)
  const [salaryConfig, setSalaryConfig] = useState(() => {
    const saved = localStorage.getItem('salaryConfig');
    return saved ? JSON.parse(saved) : { base: 500000, incentiveRate: 100, extra: 0 };
  });

  // Save config whenever it changes
  useEffect(() => {
    localStorage.setItem('salaryConfig', JSON.stringify(salaryConfig));
  }, [salaryConfig]);

  // [핵심] 앱이 켜질 때 & 로그인 상태 바뀔 때 실행됨
  useEffect(() => {
    // 1. 현재 로그인 정보 가져오기
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session check:', session);
      
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
      if (session) {
        setView('client_home');
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

  // [Smart Revenue Logic]
  const fetchRevenueData = async () => {
    if (!supabase) return;
    setIsRevenueLoading(true);
    
    const year = currentRevenueDate.getFullYear();
    const month = currentRevenueDate.getMonth();
    const startDate = new Date(year, month, 1).toISOString();
    const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

    try {
      const { data, error } = await supabase
        .from('attendance_logs')
        .select('*, profiles(name)')
        .gte('check_in_at', startDate)
        .lte('check_in_at', endDate)
        .order('check_in_at', { ascending: false });

      if (error) throw error;
      setRevenueLogs(data || []);
    } catch (err) {
      console.error('Error fetching revenue:', err);
    } finally {
      setIsRevenueLoading(false);
    }
  };

  // Helper to handle month changes
  const changeMonth = (delta) => {
    const newDate = new Date(currentRevenueDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentRevenueDate(newDate);
  };

  // Helper to handle input changes
  const handleConfigChange = (key, value) => {
    setSalaryConfig(prev => ({ ...prev, [key]: Number(value) }));
  };

  // Helper to format currency
  const fmt = (num) => num?.toLocaleString() || '0';

  // Excel download handler
  const handleDownloadExcel = () => {
    alert('Excel export feature coming soon! For now, you can copy the data from the table.');
  };

  // Auto-fetch when revenue date changes
  useEffect(() => {
    if (view === 'revenue') {
      fetchRevenueData();
    }
  }, [view, currentRevenueDate]);

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

          {/* 관리자 화면 (session 없이도 접근 가능 - admin backdoor) */}
          {view === 'admin_home' && (
            <AdminRoute session={session}>
              <AdminHome setView={setView} logout={handleLogout} />
            </AdminRoute>
          )}

          {/* 회원 목록 */}
          {view === 'member_list' && (
            <AdminRoute session={session}>
              <MemberList setView={setView} setSelectedMemberId={setSelectedMemberId} />
            </AdminRoute>
          )}

          {/* 회원 상세 */}
          {view === 'member_detail' && selectedMemberId && (
            <AdminRoute session={session}>
              <MemberDetail selectedMemberId={selectedMemberId} setView={setView} />
            </AdminRoute>
          )}

          {/* QR 스캐너 */}
          {view === 'scanner' && (
            <AdminRoute session={session}>
              <QRScanner setView={setView} />
            </AdminRoute>
          )}

          {/* 관리자 스케줄 관리 */}
          {view === 'admin_schedule' && (
            <AdminRoute session={session}>
              <AdminSchedule setView={setView} />
            </AdminRoute>
          )}

          {/* 매출 관리 & 급여 계산기 */}
          {view === 'revenue' && (
            <AdminRoute session={session}>
              <div className="min-h-[100dvh] bg-zinc-950 flex flex-col p-6 text-white overflow-y-auto pb-24">
                <BackButton onClick={() => setView('admin_home')} label="Admin Home" />
                
                {/* Header & Date */}
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-yellow-500">💰 SALARY CALCULATOR</h2>
                  <div className="flex items-center gap-4 bg-zinc-900 px-4 py-2 rounded-lg border border-zinc-800">
                    <button onClick={() => changeMonth(-1)} className="text-xl font-bold hover:text-yellow-500">◀</button>
                    <span className="text-lg font-bold w-24 text-center">
                      {currentRevenueDate.getFullYear()}. {currentRevenueDate.getMonth() + 1}
                    </span>
                    <button onClick={() => changeMonth(1)} className="text-xl font-bold hover:text-yellow-500">▶</button>
                  </div>
                </div>

                {/* Calculator Inputs (The Excel Replacement) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  
                  {/* 1. Base Salary */}
                  <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800">
                    <label className="text-zinc-400 text-xs block mb-1">Base Salary (Basic)</label>
                    <div className="flex items-center text-xl font-bold">
                      <span className="text-zinc-500 mr-2">₩</span>
                      <input 
                        type="number" 
                        value={salaryConfig.base}
                        onChange={(e) => handleConfigChange('base', e.target.value)}
                        className="bg-transparent w-full outline-none text-white border-b border-zinc-700 focus:border-yellow-500 transition"
                      />
                    </div>
                  </div>

                  {/* 2. PT Revenue & Incentive Rate */}
                  <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800">
                    <div className="flex justify-between mb-1">
                      <label className="text-zinc-400 text-xs">PT Revenue ({revenueLogs.length} sessions)</label>
                      <div className="flex items-center text-xs gap-1">
                        <span>Rate:</span>
                        <input 
                          type="number" 
                          value={salaryConfig.incentiveRate}
                          onChange={(e) => handleConfigChange('incentiveRate', e.target.value)}
                          className="bg-zinc-800 w-10 text-center rounded text-yellow-500 font-bold outline-none"
                        />
                        <span>%</span>
                      </div>
                    </div>
                    <div className="text-xl font-bold text-yellow-400">
                      + ₩ {fmt(revenueLogs.reduce((sum, log) => sum + (log.session_price_snapshot || 0), 0) * (salaryConfig.incentiveRate / 100))}
                      <span className="text-xs text-zinc-500 font-normal ml-2 block">
                        (Total: ₩ {fmt(revenueLogs.reduce((sum, log) => sum + (log.session_price_snapshot || 0), 0))})
                      </span>
                    </div>
                  </div>

                  {/* 3. Extra Income */}
                  <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800">
                    <label className="text-zinc-400 text-xs block mb-1">Extra / Bonus</label>
                    <div className="flex items-center text-xl font-bold text-green-400">
                      <span className="text-zinc-500 mr-2">+ ₩</span>
                      <input 
                        type="number" 
                        value={salaryConfig.extra}
                        onChange={(e) => handleConfigChange('extra', e.target.value)}
                        className="bg-transparent w-full outline-none text-green-400 border-b border-zinc-700 focus:border-green-500 transition"
                      />
                    </div>
                  </div>

                  {/* 4. Final Payout */}
                  <div className="bg-gradient-to-br from-yellow-900/50 to-zinc-900 p-4 rounded-lg border border-yellow-500 shadow-lg flex flex-col justify-center">
                    <label className="text-yellow-200 text-xs block mb-1">FINAL PAYOUT</label>
                    <div className="text-3xl font-bold text-yellow-400">
                      ₩ {fmt(salaryConfig.base + (revenueLogs.reduce((sum, log) => sum + (log.session_price_snapshot || 0), 0) * (salaryConfig.incentiveRate / 100)) + salaryConfig.extra)}
                    </div>
                  </div>
                </div>

                {/* Excel Download Button */}
                <div className="flex justify-end mb-4">
                  <button 
                    onClick={handleDownloadExcel}
                    className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded font-bold text-sm shadow flex items-center gap-2"
                  >
                    📥 DOWNLOAD EXCEL REPORT
                  </button>
                </div>

                {/* Attendance Table */}
                <div className="bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-zinc-800 text-zinc-400 text-xs uppercase">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Member</th>
                        <th className="p-3 text-right">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800 text-sm">
                      {isRevenueLoading ? (
                        <tr><td colSpan="3" className="p-6 text-center text-zinc-500">Loading...</td></tr>
                      ) : revenueLogs.length === 0 ? (
                        <tr><td colSpan="3" className="p-6 text-center text-zinc-500">No records found for this month.</td></tr>
                      ) : (
                        revenueLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-zinc-800/50">
                            <td className="p-3">
                              <div className="font-bold text-white">{new Date(log.check_in_at).toLocaleDateString('ko-KR')}</div>
                              <div className="text-zinc-500 text-xs">{new Date(log.check_in_at).toLocaleTimeString('ko-KR', {hour:'2-digit', minute:'2-digit'})}</div>
                            </td>
                            <td className="p-3 text-zinc-300">{log.profiles?.name || 'Unknown'}</td>
                            <td className="p-3 text-right font-bold text-yellow-500">₩ {log.session_price_snapshot?.toLocaleString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
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

// [App.jsx] QRScanner 컴포넌트 교체
// [App.jsx] QRScanner 컴포넌트 교체
const QRScanner = ({ setView }) => {
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const scannerRef = useRef(null);

  useEffect(() => {
      // DOM이 완전히 렌더된 후 카메라 시작
      const timer = setTimeout(() => {
          startScan();
      }, 200);
      return () => {
          clearTimeout(timer);
          stopScan();
      };
  }, []);

  const startScan = async () => {
      try {
          // ghost 인스턴스 정리
          if (scannerRef.current) {
              try {
                  await scannerRef.current.stop();
              } catch (e) {}
              try {
                  scannerRef.current.clear();
              } catch (e) {}
              scannerRef.current = null;
          }
          await new Promise(r => setTimeout(r, 100));

          const html5QrCode = new Html5Qrcode("reader");
          scannerRef.current = html5QrCode;

          await html5QrCode.start(
              { facingMode: "environment" },
              {
                  fps: 30,
                  qrbox: { width: 280, height: 280 },
                  aspectRatio: 1.0,
                  disableFlip: false
              },
              onScanSuccess,
              () => {}
          );
          setErrorMsg(null);
      } catch (err) {
          console.error("QR Camera error:", err);
          setErrorMsg("카메라 권한을 허용해주세요.");
      }
  };

  const stopScan = async () => {
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

  const onScanSuccess = async (decodedText) => {
      console.log("QR 인식됨:", decodedText);
      if (!scannerRef.current) return;

      try {
          await scannerRef.current.pause();
      } catch (e) {}
      if (navigator.vibrate) navigator.vibrate(200);

      try {
          const { data, error } = await supabase.rpc('check_in_user', { user_uuid: decodedText });
          if (error) throw error;

          const { data: userData } = await supabase.from('profiles').select('name').eq('id', decodedText).single();
          setResult({
              success: true,
              userName: userData?.name || '회원',
              message: `출석 완료 (잔여: ${data.remaining}회)`
          });
      } catch (error) {
          let msg = "유효하지 않은 QR입니다.";
          if (error.message?.includes("No remaining")) msg = "잔여 세션이 없습니다.";
          setResult({ success: false, message: msg });
          if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
      }

      setTimeout(() => {
          setResult(null);
          if (scannerRef.current) {
              try {
                  scannerRef.current.resume();
              } catch (e) {
                  startScan();
              }
          }
      }, 2000);
  };

  return (
      <div className="min-h-[100dvh] bg-black text-white flex flex-col items-center justify-center relative">
          <button 
              onClick={() => { stopScan(); setView('admin_home'); }} 
              className="absolute top-6 left-6 z-50 bg-zinc-800 px-4 py-2 rounded-lg"
          >
              ← 나가기
          </button>

          <div className="w-full max-w-sm relative">
              {/* 스캐너 영역 */}
              <div id="reader" className="w-full h-[350px] bg-black rounded-2xl overflow-hidden border-2 border-yellow-500"></div>
              
              {errorMsg && <p className="text-red-500 text-center mt-4">{errorMsg}</p>}
              
              {!errorMsg && !result && (
                  <p className="text-zinc-500 text-center mt-4 animate-pulse">QR 코드를 사각형 안에 맞춰주세요</p>
              )}
          </div>

          {/* 결과 모달 */}
          {result && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                  <div className={`p-8 rounded-2xl text-center border-2 ${result.success ? 'bg-zinc-900 border-green-500' : 'bg-zinc-900 border-red-500'}`}>
                      <h3 className="text-2xl font-bold mb-2">{result.userName || '알림'}</h3>
                      <p className={`text-lg font-bold ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                          {result.message}
                      </p>
                  </div>
              </div>
          )}
      </div>
  );
};
// --- [MacroCalculator] 스마트 매크로 계산기 ---
const MacroCalculator = ({ user, setView }) => {
  const [goal, setGoal] = useState('diet');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [gender, setGender] = useState('M');
  const [age, setAge] = useState('');
  const [result, setResult] = useState(null);

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
        <h2 className="text-2xl font-bold text-yellow-500 mb-2">🍽️ MACRO CALCULATOR</h2>
        <p className="text-zinc-500 text-sm">Smart nutrition guide based on your goals</p>
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
          CALCULATE MACROS
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
            <h3 className="text-yellow-500 font-bold mb-3">📊 Calorie Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">BMR</p>
                <p className="text-2xl font-bold text-white">{result.bmr}</p>
                <p className="text-xs text-zinc-600">kcal/day</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">TDEE</p>
                <p className="text-2xl font-bold text-white">{result.tdee}</p>
                <p className="text-xs text-zinc-600">kcal/day</p>
              </div>
            </div>
          </div>

          {/* Daily Totals */}
          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
            <h3 className="text-yellow-500 font-bold mb-3">🍽️ Daily Macros (Total)</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Carbs</span>
                <span className="text-xl font-bold text-blue-400">{result.totalCarbs}g</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Protein</span>
                <span className="text-xl font-bold text-red-400">{result.totalProtein}g</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Fat</span>
                <span className="text-xl font-bold text-green-400">{result.totalFat}g</span>
              </div>
            </div>
          </div>

          {/* Per Meal */}
          <div className="bg-gradient-to-br from-yellow-900/30 to-zinc-900 rounded-xl p-5 border-2 border-yellow-500/30">
            <h3 className="text-yellow-500 font-bold mb-3 flex items-center gap-2">
              <span>⭐</span> Per Meal (4 meals/day)
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
          </div>

          {/* Goal Description */}
          <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
            <h4 className="text-sm font-bold text-yellow-500 mb-2">📋 Your Goal Strategy</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {goal === 'body_profile' && '고단백 저탄수화물 전략으로 체지방을 감량하면서 근육을 보호합니다.'}
              {goal === 'diet' && '균형잡힌 매크로 비율로 건강하게 체중을 감량합니다.'}
              {goal === 'muscle_gain' && '고탄수화물 식단으로 근육 성장에 필요한 에너지를 충분히 공급합니다.'}
            </p>
          </div>
        </motion.div>
      )}

      {/* Info Card */}
      {!result && (
        <div className="max-w-md mx-auto bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
          <p className="text-xs text-zinc-500 leading-relaxed">
            💡 활동량은 주 3-5회 운동을 기준으로 자동 설정됩니다. (Activity Factor: 1.375)
          </p>
        </div>
      )}
    </div>
  );
};

// [교체] ClassBooking 컴포넌트 전체
const ClassBooking = ({ user, setView }) => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [bookings, setBookings] = useState([]); // 초기값 빈 배열 보장
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  // 시간대 설정
  const TIME_SLOTS = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"];

  // 날짜 생성
  const generateDates = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      dates.push(d);
    }
    return dates;
  };
  const dates = generateDates();

  // 날짜 선택 시 예약된 목록 가져오기
  useEffect(() => {
    if (!selectedDate) return;
    
    const fetchBookings = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('*')
          .eq('date', selectedDate);
          
        if (error) throw error;
        // 데이터가 없으면 빈 배열로 설정 (앱 죽음 방지)
        setBookings(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        setBookings([]);
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, [selectedDate]);

  // 예약 여부 확인 (안전하게 체크)
  const isSlotBooked = (time) => {
    if (!Array.isArray(bookings)) return false;
    return bookings.some(b => b.time === time);
  };

  const handleBookSlot = async (timeSlot) => {
    if (processing) return;
    if (!confirm(`${selectedDate} ${timeSlot} 예약하시겠습니까?`)) return;

    setProcessing(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .insert([{ user_id: user.id, date: selectedDate, time: timeSlot }])
        .select();

      if (error) throw error;

      alert("✅ 예약 완료!");
      const { data: updated } = await supabase.from('bookings').select('*').eq('date', selectedDate);
      setBookings(updated || []);
    } catch (err) {
      alert("❌ 예약 실패: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-white p-6 pb-20">
      <BackButton onClick={() => setView('client_home')} label="Home" />
      
      <header className="text-center mb-6">
        <h2 className="text-lg font-serif text-yellow-500">CLASS BOOKING</h2>
      </header>

      {/* 날짜 선택 */}
      <div className="grid grid-cols-7 gap-2 mb-8">
        {dates.map((date) => {
          const dateStr = date.toISOString().split('T')[0];
          const dayNum = date.getDate();
          const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
          const isSelected = selectedDate === dateStr;
          
          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(dateStr)}
              className={`p-2 rounded-xl border flex flex-col items-center ${
                isSelected ? 'bg-yellow-600 border-yellow-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
              }`}
            >
              <span className="text-[10px] uppercase">{dayName}</span>
              <span className="text-lg font-bold">{dayNum}</span>
            </button>
          );
        })}
      </div>

      {/* 시간 선택 */}
      {selectedDate && (
        <>
          <h3 className="text-sm text-zinc-400 mb-3 uppercase tracking-widest">Available Times</h3>
          {loading ? (
            <p className="text-center text-zinc-600 py-10">Loading...</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {TIME_SLOTS.map((time) => {
                const booked = isSlotBooked(time);
                return (
                  <button
                    key={time}
                    disabled={booked || processing}
                    onClick={() => handleBookSlot(time)}
                    className={`p-4 rounded-xl border text-lg font-bold flex justify-between items-center ${
                      booked 
                        ? 'bg-zinc-900/50 border-zinc-800 text-zinc-700 cursor-not-allowed' 
                        : 'bg-zinc-900 border-zinc-800 text-white hover:border-yellow-600'
                    }`}
                  >
                    <span>{time}</span>
                    {booked ? <span className="text-xs text-red-900">BOOKED</span> : <span className="text-green-500">●</span>}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// --- [AdminSchedule] 관리자 스케줄 관리 화면 ---
const AdminSchedule = ({ setView }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);

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

  const handleCancelBooking = async (bookingId, userName, date, time) => {
    if (!confirm(`Cancel booking for ${userName} on ${date} at ${time}?`)) return;

    setCancelling(bookingId);
    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('id', bookingId);

    if (error) {
      alert('Error cancelling booking: ' + error.message);
    } else {
      alert('Booking cancelled successfully!');
      fetchBookings(); // Refresh list
    }
    setCancelling(null);
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
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-yellow-600/30 transition-colors"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="font-bold text-white text-lg mb-1">
                    {booking.profiles?.name || 'Unknown User'}
                  </h3>
                  <p className="text-zinc-500 text-xs">{booking.profiles?.email || '-'}</p>
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
              
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 text-yellow-500">
                  <Calendar size={16} />
                  <span className="font-medium">{booking.date}</span>
                </div>
                <div className="flex items-center gap-2 text-yellow-500">
                  <Clock size={16} />
                  <span className="font-serif text-lg">{booking.time}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Calendar size={64} className="text-zinc-700 mb-4" />
          <h3 className="text-xl font-bold text-zinc-500 mb-2">No Bookings</h3>
          <p className="text-sm text-zinc-600">No scheduled classes yet</p>
        </div>
      )}
    </div>
  );
};

// --- [AdminHome] 관리자 메인 화면 ---
const AdminHome = ({ setView, logout }) => (
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
         <ButtonGhost onClick={() => setView('admin_schedule')}>SCHEDULE</ButtonGhost>
         <ButtonGhost onClick={() => setView('library')}>LIBRARY</ButtonGhost>
         <ButtonGhost onClick={() => setView('revenue')}>💰 REVENUE</ButtonGhost>
      </div>
    </div>
  </div>
);

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
const AdminRoute = ({ children, session }) => {
  // [미구현] 관리자 권한 확인 로직 필요
  const isAdmin = true; // 임시로 true 설정

  if (!isAdmin) {
    return <p>관리자 권한이 필요합니다.</p>;
  }

  return children;
};
