import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QrCode, Camera, ChevronRight, ChevronDown, ChevronUp, BookOpen, LogOut, Plus, User, X, Search, ArrowLeft, Edit3, Save, Sparkles, MessageSquare, Calendar, Clock, ChevronLeft, Trash2, Edit, Image, DollarSign, Download, Printer, Eye, EyeOff } from 'lucide-react';
import OneSignal from 'react-onesignal';

import { supabase, REMEMBER_ME_KEY } from './lib/supabaseClient';
import { useGlobalModal } from './context/GlobalModalContext';
import WelcomeModal from './components/WelcomeModal';

import CinematicIntro from './components/ui/CinematicIntro';
import ButtonPrimary from './components/ui/ButtonPrimary';
import ButtonGhost from './components/ui/ButtonGhost';
import BackButton from './components/ui/BackButton';
import Skeleton from './components/ui/Skeleton';

import LoginView from './pages/auth/LoginView';
import RegisterView from './pages/auth/RegisterView';
import ResetPasswordView from './pages/auth/ResetPasswordView';

import ClientHome from './pages/client/ClientHome';

import AdminHome from './pages/admin/AdminHome';
import AdminSchedule from './pages/admin/AdminSchedule';
import AdminSettings from './pages/admin/AdminSettings';
import AdminRoute from './pages/admin/AdminRoute';

import ClassBooking from './features/booking/ClassBooking';
import MemberList from './features/members/MemberList';
import MemberDetail from './features/members/MemberDetail';
import QRScanner from './features/checkin/QRScanner';
import MacroCalculator from './features/tools/MacroCalculator';

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

// --- Main App Component ---


export default function App() {
  const { showAlert, showConfirm } = useGlobalModal();
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

  const [loading, setLoading] = useState(true);
  const [signupWelcomePending, setSignupWelcomePending] = useState(false);
  const [welcomeName, setWelcomeName] = useState('');
  const viewRef = useRef(view);
  viewRef.current = view;

  const processAuth = async (sessionData) => {
    setSession(sessionData);
    if (!sessionData?.user?.id) {
      setView('login');
      setLoading(false);
      return;
    }
    if (viewRef.current === 'register') {
      setSignupWelcomePending(true);
      setWelcomeName(sessionData.user?.user_metadata?.full_name || sessionData.user?.email || '회원');
      setLoading(false);
      return;
    }
    try {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', sessionData.user.id)
        .maybeSingle();
      if (!data && sessionData?.user) {
        await new Promise((r) => setTimeout(r, 600));
        const { data: retry } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', sessionData.user.id)
          .maybeSingle();
        setView(retry?.role === 'admin' ? 'admin_home' : 'client_home');
      } else {
        setView(data?.role === 'admin' ? 'admin_home' : 'client_home');
      }
    } catch {
      setView('client_home');
    } finally {
      setLoading(false);
    }
  };

  // [핵심] 앱이 켜질 때 & 로그인 상태 바뀔 때 실행됨
  useEffect(() => {
    // 1. Auto-login only if a valid session exists in storage (localStorage when rememberMe, sessionStorage otherwise)
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session check:', session);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const type = hashParams.get('type');

      if (type === 'recovery') {
        setSession(session);
        setShowResetPassword(true);
        setLoading(false);
        return;
      }

      processAuth(session);
    });

    // 2. 로그인/로그아웃 감시자 등록
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', event, session);
      
      // CRITICAL: Handle PASSWORD_RECOVERY event FIRST
      if (event === 'PASSWORD_RECOVERY') {
        setSession(session);
        setShowResetPassword(true);
        setLoading(false);
        return; // Exit early
      }
      
      if (showResetPassword) return;
      
      processAuth(session);
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
    if (!newPost.title || !newPost.content) {
      showAlert({ message: 'Please enter a title and content.' });
      return;
    }
    try {
      const { error } = await supabase.from('posts').insert([{ ...newPost, created_at: new Date() }]);
      if (error) throw error;
      showAlert({ message: 'Post saved successfully!' });
      setShowWriteModal(false);
      setNewPost({ title: '', content: '', category: 'Tip', image_url: '' });
      fetchLibraryPosts();
    } catch (err) {
      showAlert({ message: 'Error saving post: ' + err.message });
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
    <div className="bg-black min-h-[100dvh] flex flex-col font-sans selection:bg-yellow-500/30 overflow-x-hidden">
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
          {!showResetPassword && loading && !signupWelcomePending && (
            <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-zinc-950 text-white gap-4">
              <h2 className="text-xl font-serif text-yellow-500">THE COACH</h2>
              <p className="text-zinc-400">준비 중...</p>
            </div>
          )}
          {signupWelcomePending && (
            <WelcomeModal
              isOpen={true}
              userName={welcomeName}
              onStart={() => {
                setSignupWelcomePending(false);
                setView('client_home');
              }}
            />
          )}
          {!showResetPassword && !loading && !signupWelcomePending && (
            <>
              {!session && view === 'login' && <LoginView setView={setView} />}
              {!session && view === 'register' && <RegisterView setView={setView} onSignupSuccess={(name) => { setWelcomeName(name); setSignupWelcomePending(true); }} />}

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
            <div className="min-h-[100dvh] h-full max-w-full bg-zinc-950 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 p-6 pb-24" style={{ WebkitOverflowScrolling: 'touch' }}>
              <BackButton onClick={() => setView(session?.user ? 'client_home' : 'admin_home')} label="Home" />
              
              <div className="flex flex-wrap justify-between items-center gap-3 mb-6 max-w-full">
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
              <div className="flex flex-wrap gap-2 mb-4 overflow-x-auto overscroll-x-none max-w-full">
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
              <div className="flex flex-wrap gap-2 mb-6 w-full max-w-full">
                <input
                  type="text"
                  placeholder="Search posts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 min-w-0 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-yellow-500 outline-none w-full"
                />
                <button
                  onClick={handleSearch}
                  className="shrink-0 bg-yellow-600 hover:bg-yellow-500 text-black font-bold px-6 py-3 rounded-xl transition-all flex items-center gap-2"
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
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full max-w-full">
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

              </div>
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

