import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QrCode, Camera, ChevronRight, ChevronUp, BookOpen, LogOut, Plus, User, X, Search, ArrowLeft, Edit3, Save, Sparkles, MessageSquare, Calendar, Clock, ChevronLeft, Edit, Image, DollarSign, Download, Printer } from 'lucide-react';
import OneSignal from 'react-onesignal';

import { supabase, REMEMBER_ME_KEY } from './lib/supabaseClient';
import { deleteAttendanceLogsForBooking, toTime24h } from './utils/cascadeAttendance';
import { emitSessionBalanceRefresh } from './utils/sessionBalanceEvents';
import { clearBookingPwaState } from './utils/bookingPwaState';
import {
  readPersistedView,
  writePersistedView,
  clearPersistedView,
  writePwaLastVisitedPath,
} from './utils/appViewPersistence';
import { useGlobalModal } from './context/GlobalModalContext';
import CinematicIntro from './components/ui/CinematicIntro';
import LabDotBrand from './components/ui/LabDotBrand';
import ButtonPrimary from './components/ui/ButtonPrimary';
import ButtonGhost from './components/ui/ButtonGhost';
import BackButton from './components/ui/BackButton';
import Skeleton from './components/ui/Skeleton';

import LoginView from './pages/auth/LoginView';
import RegisterView from './pages/auth/RegisterView';
import ResetPasswordView from './pages/auth/ResetPasswordView';

import ClientHome from './pages/client/ClientHome';

import AdminHome from './pages/admin/AdminHome';
import AdminSettings from './pages/admin/AdminSettings';
import AdminRoute from './pages/admin/AdminRoute';
import AdminPayrollDashboard from './pages/admin/AdminPayrollDashboard';
import AdminBookingSettingsPanel from './features/admin/AdminBookingSettingsPanel';
import AdminScheduleFullCalendar from './features/admin/AdminScheduleFullCalendar';
import { buildAdminCalendarEvents } from './utils/adminScheduleCalendarEvents';

import LibraryArticleScreen from './features/library/LibraryArticleScreen';
import TrainingLogList from './features/training/TrainingLogList';
import TrainingLogDetail from './features/training/TrainingLogDetail';
import ClassBooking from './features/booking/ClassBooking';
import MemberList from './features/members/MemberList';
import MemberDetail from './features/members/MemberDetail';
import HallOfFameHub from './features/members/HallOfFameHub';
import AdminTrainingReportForm from './features/members/AdminTrainingReportForm';
import QRScanner from './features/checkin/QRScanner';
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

// --- OneSignal: VITE_ONESIGNAL_APP_ID in .env (fallback for local dev) ---
const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID || 'b11d4906-0186-462c-a90c-2d07171e6619';

// --- Main App Component ---


export default function App() {
  const { showAlert, showConfirm, showToast } = useGlobalModal();
  const [showIntro, setShowIntro] = useState(true);
  const [session, setSession] = useState(null); // 현재 로그인 세션
  const [view, setViewState] = useState('login');
  const [selectedMemberId, setSelectedMemberId] = useState(() => sessionStorage.getItem('hall_of_fame_member_id')); // 선택된 회원 ID
  const [trainingLogId, setTrainingLogId] = useState(null);

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

  /** Global admin quick action: training log modal */
  const [showAdminTrainingReport, setShowAdminTrainingReport] = useState(false);

  // [Smart Revenue / Dashboard State]
  const [currentRevenueDate, setCurrentRevenueDate] = useState(new Date());
  const [revenueLogs, setRevenueLogs] = useState([]);
  const [dashboardBookings, setDashboardBookings] = useState([]);
  /** Month-scoped: scheduled class count (bookings/schedules), not attendance logs */
  const [monthlyScheduledCount, setMonthlyScheduledCount] = useState(0);
  /** Month-scoped: sum of pack revenue from session_batches (price or total_count × price_per_session) */
  const [monthlyPackSalesKrw, setMonthlyPackSalesKrw] = useState(0);
  const [isRevenueLoading, setIsRevenueLoading] = useState(false);
  /** OneSignal deep link → open schedule on a specific day */
  const [scheduleCalendarSeed, setScheduleCalendarSeed] = useState(null);
  const [calendarActionModal, setCalendarActionModal] = useState(null);
  const [calendarActionBusy, setCalendarActionBusy] = useState(false);

  // Salary Configuration (Persist in LocalStorage)
  const [salaryConfig, setSalaryConfig] = useState(() => {
    const saved = localStorage.getItem('salaryConfig');
    return saved ? JSON.parse(saved) : { base: 500000, incentiveRate: 100, extra: 0 };
  });

  // Save config whenever it changes
  useEffect(() => {
    localStorage.setItem('salaryConfig', JSON.stringify(salaryConfig));
  }, [salaryConfig]);

  // [OneSignal] Initialize once on app load (True Background Push foundation)
  const [oneSignalReady, setOneSignalReady] = useState(false);
  useEffect(() => {
    OneSignal.init({
      appId: ONESIGNAL_APP_ID,
      allowLocalhostAsSecureOrigin: true,
    })
      .then(() => setOneSignalReady(true))
      .catch((e) => console.warn('[OneSignal] init:', e));
  }, []);

  // [OneSignal] Bind Supabase user id ↔ OneSignal identity; persist player id to profiles
  useEffect(() => {
    const user = session?.user;
    if (!oneSignalReady || !user?.id) return;

    const savePlayerIdToProfile = async (playerId) => {
      if (!playerId) return;
      const { error } = await supabase
        .from('profiles')
        .update({ onesignal_id: playerId })
        .eq('id', user.id);
      if (error) console.warn('[OneSignal] Failed to save onesignal_id:', error);
    };

    const run = async () => {
      try {
        await OneSignal.login(user.id);
      } catch (e) {
        console.warn('[OneSignal] login:', e);
      }

      if (OneSignal.User?.PushSubscription?.optedIn) {
        const id = OneSignal.User?.PushSubscription?.id || OneSignal.User?.onesignalId;
        if (id) await savePlayerIdToProfile(id);
      }
    };

    run();

    const onSubscriptionChange = async (event) => {
      const newId = event?.current?.id || OneSignal.User?.PushSubscription?.id;
      if (newId) await savePlayerIdToProfile(newId);
    };

    const sub = OneSignal.User?.PushSubscription;
    sub?.addEventListener?.('change', onSubscriptionChange);
    return () => {
      sub?.removeEventListener?.('change', onSubscriptionChange);
    };
  }, [oneSignalReady, session?.user?.id]);

  const [loading, setLoading] = useState(true);
  /** From `profiles.role` — used for library back nav & admin-only UI */
  const [userProfileRole, setUserProfileRole] = useState(null);

  /** Previous views for historical back navigation (custom router) */
  const viewHistoryRef = useRef([]);
  const replaceView = useCallback((next) => {
    viewHistoryRef.current = [];
    setViewState(next);
  }, []);

  const navigate = useCallback((next) => {
    setViewState((prev) => {
      if (next !== prev) {
        viewHistoryRef.current.push(prev);
      }
      return next;
    });
  }, []);

  const goBack = useCallback(() => {
    const prev = viewHistoryRef.current.pop();
    if (prev !== undefined) {
      setViewState(prev);
      return;
    }
    if (!session?.user?.id) {
      setViewState('login');
      return;
    }
    setViewState(userProfileRole === 'admin' ? 'admin_home' : 'client_home');
  }, [userProfileRole, session?.user?.id]);

  const viewRef = useRef(view);
  viewRef.current = view;

  /** PWA: localStorage 우선 + `lastVisitedPath` — 백그라운드 복귀 시 홈 강제 이동 방지 */
  useEffect(() => {
    if (!session?.user?.id) return;
    if (view === 'login' || view === 'register' || showResetPassword) return;
    writePersistedView(session.user.id, view);
    writePwaLastVisitedPath(session.user.id, view, userProfileRole === 'admin');
  }, [view, session?.user?.id, showResetPassword, userProfileRole]);

  /** Prompt push permission once per auth session when user reaches Home (client or admin) */
  const pushPromptForSessionRef = useRef(null);
  useEffect(() => {
    if (!oneSignalReady || !session?.user?.id) return;
    if (view !== 'client_home' && view !== 'admin_home') return;
    if (loading) return;
    const uid = session.user.id;
    if (pushPromptForSessionRef.current === uid) return;
    pushPromptForSessionRef.current = uid;
    OneSignal.Slidedown.promptPush().catch((e) => console.warn('[OneSignal] promptPush:', e));
  }, [oneSignalReady, session?.user?.id, view, loading]);

  /** Admin: tap 10분 전 세션 알림 → Schedule day view (Today's Timeline) */
  useEffect(() => {
    if (!oneSignalReady) return;

    const onNotificationClick = (event) => {
      let data = event?.notification?.additionalData;
      if (data != null && typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      if (!data || typeof data !== 'object') return;
      const action = data.labdot_action;
      if (action !== 'admin_timeline' && action !== 'admin_schedule') return;
      const bd = data.booking_date;
      if (typeof bd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(bd)) {
        const d = new Date(`${bd}T12:00:00`);
        if (!Number.isNaN(d.getTime())) setScheduleCalendarSeed(d);
      }
      navigate('admin_schedule');
    };

    OneSignal.Notifications.addEventListener('click', onNotificationClick);
    return () => OneSignal.Notifications.removeEventListener('click', onNotificationClick);
  }, [oneSignalReady, navigate]);

  const processAuth = async (sessionData, authEvent) => {
    setSession(sessionData);
    if (!sessionData?.user?.id) {
      setUserProfileRole(null);
      if (viewRef.current !== 'register') {
        replaceView('login');
      }
      setLoading(false);
      return;
    }

    if (authEvent === 'TOKEN_REFRESHED') {
      setLoading(false);
      return;
    }

    /** 회원가입 완료 직후: 환영 화면을 위해 자동 홈 이동 금지 (RegisterView에서만 시작하기 후 이동) */
    if (viewRef.current === 'register') {
      (async () => {
        try {
          await new Promise((r) => setTimeout(r, 300));
          let profile = null;
          for (let i = 0; i < 8; i++) {
            const { data } = await supabase
              .from('profiles')
              .select('role, name')
              .eq('id', sessionData.user.id)
              .maybeSingle();
            if (data) {
              profile = data;
              break;
            }
            await new Promise((r) => setTimeout(r, 350));
          }
          setUserProfileRole(profile?.role ?? null);
        } catch {
          setUserProfileRole(null);
        } finally {
          setLoading(false);
        }
      })();
      return;
    }

    try {
      let { data } = await supabase
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
        data = retry;
      }
      setUserProfileRole(data?.role ?? null);
      const role = data?.role ?? null;
      const def = role === 'admin' ? 'admin_home' : 'client_home';
      // SIGNED_IN: 방금 로그인 → 항상 홈. INITIAL_SESSION(새로고침/PWA 복귀) → 저장된 view 복원.
      // USER_UPDATED 등: replaceView 하지 않음(탭/예약 화면 유지).
      if (authEvent === 'SIGNED_IN') {
        replaceView(def);
      } else if (authEvent === 'INITIAL_SESSION') {
        const p = readPersistedView(sessionData.user.id, role);
        replaceView(p || def);
      }
    } catch {
      setUserProfileRole(null);
      if (authEvent === 'INITIAL_SESSION' && sessionData?.user?.id) {
        const p = readPersistedView(sessionData.user.id, null);
        replaceView(p || 'client_home');
      } else {
        replaceView('client_home');
      }
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

      processAuth(session, 'INITIAL_SESSION');
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

      // Initial load is handled by getSession() above — avoid double processAuth
      if (event === 'INITIAL_SESSION') return;
      
      processAuth(session, event);
    });

    return () => subscription.unsubscribe();
  }, [showResetPassword]);

  const handleLogout = async () => {
    const uid = session?.user?.id;
    if (uid) {
      clearBookingPwaState(uid);
      clearPersistedView(uid);
    }
    try {
      await OneSignal.logout();
    } catch (e) {
      console.warn('[OneSignal] logout:', e);
    }
    pushPromptForSessionRef.current = null;
    setUserProfileRole(null);
    await supabase.auth.signOut();
    replaceView('login');
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
    if (!session?.user?.id) {
      showAlert({ message: '로그인이 필요합니다.' });
      return;
    }
    if (!newPost.title?.trim() || !newPost.content?.trim()) {
      showAlert({ message: '제목과 내용을 입력해 주세요.' });
      return;
    }
    try {
      const { data: profileRow, error: profileErr } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();
      if (profileErr) throw profileErr;
      if (profileRow?.role !== 'admin') {
        showAlert({ message: '관리자만 글을 등록할 수 있습니다.' });
        return;
      }

      const imageUrl = newPost.image_url?.trim();
      const payload = {
        title: newPost.title.trim(),
        content: newPost.content.trim(),
        category: newPost.category || 'Tip',
        image_url: imageUrl ? imageUrl : null,
        created_at: new Date().toISOString(),
      };

      const { data: inserted, error } = await supabase.from('posts').insert([payload]).select('id');
      if (error) throw error;
      if (!inserted?.length) throw new Error('저장 응답이 비어 있습니다.');

      showToast('게시글이 저장되었습니다');
      setShowWriteModal(false);
      setNewPost({ title: '', content: '', category: 'Tip', image_url: '' });
      await fetchLibraryPosts();
    } catch (err) {
      console.error('[handleSavePost]', err);
      showAlert({ message: '저장 실패: ' + (err.message || String(err)) });
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

  const sumSessionBatchRowRevenue = (row) => {
    if (row == null) return 0;
    const rawPrice = row.price;
    if (rawPrice != null && rawPrice !== '') {
      const p = Number(rawPrice);
      if (Number.isFinite(p) && p > 0) return p;
    }
    const tc = Number(row.total_count) || 0;
    const pps = Number(row.price_per_session) || 0;
    return tc * pps;
  };

  const toDateKey = (d) => {
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  };

  const fetchRevenueData = async () => {
    if (!supabase) return;
    setIsRevenueLoading(true);
    const isAdminSchedule = view === 'admin_schedule';

    let startDate;
    let endDate;
    let startKey;
    let endKey;

    if (isAdminSchedule) {
      const a = new Date();
      a.setDate(a.getDate() - 60);
      a.setHours(0, 0, 0, 0);
      const b = new Date();
      b.setDate(b.getDate() + 180);
      b.setHours(23, 59, 59, 999);
      startDate = a;
      endDate = b;
    } else {
      const year = currentRevenueDate.getFullYear();
      const month = currentRevenueDate.getMonth();
      startDate = new Date(year, month, 1, 0, 0, 0, 0);
      endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
    }

    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();
    if (isAdminSchedule) {
      startKey = toDateKey(startDate);
      endKey = toDateKey(endDate);
    } else {
      const year = currentRevenueDate.getFullYear();
      const month = currentRevenueDate.getMonth();
      startKey = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      endKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(
        new Date(year, month + 1, 0).getDate()
      ).padStart(2, '0')}`;
    }

    try {
      const bookingsQuery = supabase
        .from('bookings')
        .select('*, profiles(name, email)')
        .gte('date', startKey)
        .lte('date', endKey)
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      const logsQuery = supabase
        .from('attendance_logs')
        .select('*, profiles(name)')
        .gte('check_in_at', startISO)
        .lte('check_in_at', endISO)
        .order('check_in_at', { ascending: false });

      if (isAdminSchedule) {
        const [bookingsRes, logsRes] = await Promise.all([bookingsQuery, logsQuery]);
        if (logsRes.error) throw logsRes.error;
        if (bookingsRes.error) throw bookingsRes.error;
        const scheduleRows = bookingsRes.data || [];
        setRevenueLogs(logsRes.data || []);
        setDashboardBookings(scheduleRows);
        setMonthlyScheduledCount((scheduleRows || []).filter((b) => b?.status !== 'cancelled').length);
      } else {
        const batchesQuery = supabase
          .from('session_batches')
          .select('total_count, price_per_session, price, created_at')
          .gte('created_at', startISO)
          .lte('created_at', endISO);

        const [bookingsRes, batchesRes, logsRes] = await Promise.all([bookingsQuery, batchesQuery, logsQuery]);

        if (logsRes.error) throw logsRes.error;
        if (bookingsRes.error) throw bookingsRes.error;
        const scheduleRows = bookingsRes.data || [];

        setRevenueLogs(logsRes.data || []);
        setDashboardBookings(scheduleRows);

        const scheduledInMonth = (scheduleRows || []).filter((b) => b?.status !== 'cancelled').length;
        setMonthlyScheduledCount(scheduledInMonth);

        if (batchesRes.error) {
          console.warn('[Dashboard] session_batches:', batchesRes.error);
          setMonthlyPackSalesKrw(0);
        } else {
          const packSales = (batchesRes.data || []).reduce((sum, row) => sum + sumSessionBatchRowRevenue(row), 0);
          setMonthlyPackSalesKrw(packSales);
        }
      }
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      setMonthlyScheduledCount(0);
      setMonthlyPackSalesKrw(0);
    } finally {
      setIsRevenueLoading(false);
    }
  };

  /** 관리자 일정(캘린더)에서 예약 삭제 */
  const openCalendarActionModal = (item) => {
    const b = item?.booking;
    if (!b?.id) return;
    setCalendarActionModal({
      bookingId: b.id,
      userName: b.profiles?.name || item?.userName || '회원',
      date: String(b.date || ''),
      time: String(b.time || ''),
      status: String(b.status || ''),
    });
  };

  const closeCalendarActionModal = () => {
    if (calendarActionBusy) return;
    setCalendarActionModal(null);
  };

  const completeBookingFromCalendar = async () => {
    const id = calendarActionModal?.bookingId;
    if (!id) return;
    setCalendarActionBusy(true);
    try {
      const { error } = await supabase.rpc('admin_update_session_status', {
        p_booking_id: id,
        p_new_status: 'completed',
      });
      if (error) throw error;
      setDashboardBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status: 'completed' } : b))
      );
      showToast('수업이 완료 처리되었습니다.');
      closeCalendarActionModal();
    } catch (e) {
      console.error('[admin_update_session_status]', e);
      showAlert({ message: e?.message ? `완료 처리 실패: ${e.message}` : '완료 처리에 실패했습니다.' });
    } finally {
      setCalendarActionBusy(false);
    }
  };

  const cancelBookingFromCalendar = async () => {
    const id = calendarActionModal?.bookingId;
    if (!id) return;
    setCalendarActionBusy(true);
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', id);
      if (error) throw error;
      setDashboardBookings((prev) => prev.filter((b) => b.id !== id));
      closeCalendarActionModal();
      showToast('일정이 취소(삭제)되었습니다.');
      emitSessionBalanceRefresh();
    } catch (e) {
      console.error('[bookings delete]', e);
      showAlert({ message: e?.message ? `일정 취소 실패: ${e.message}` : '일정 취소에 실패했습니다.' });
    } finally {
      setCalendarActionBusy(false);
    }
  };

  const changeMonth = (delta) => {
    const newDate = new Date(currentRevenueDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentRevenueDate(newDate);
  };

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
      const isCompleted = !!matchedLog || b.status === 'completed';
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

  const adminCalendarEvents = React.useMemo(
    () => buildAdminCalendarEvents(mergedItemsByDate),
    [mergedItemsByDate],
  );

  // Helper to handle input changes
  const handleConfigChange = (key, value) => {
    setSalaryConfig(prev => ({ ...prev, [key]: Number(value) }));
  };

  const fmt = (num) => num?.toLocaleString() || '0';

  /** Base + (pack sales × incentive %) + bonus — no blanket 3.3% deduction on the total */
  const grossPayoutAmount = () =>
    salaryConfig.base + monthlyPackSalesKrw * (salaryConfig.incentiveRate / 100) + salaryConfig.extra;

  const downloadPayrollCSV = () => {
    const completedCheckIns = revenueLogs.length;
    const totalSales = monthlyPackSalesKrw;
    const commission = totalSales * (salaryConfig.incentiveRate / 100);
    const totalPayout = salaryConfig.base + commission + salaryConfig.extra;

    const monthLabel = `${currentRevenueDate.getFullYear()}년 ${currentRevenueDate.getMonth() + 1}월`;
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;

    const summaryRows = [
      esc(`${monthLabel} Payroll Report`),
      esc(`Scheduled classes (month): ${monthlyScheduledCount}`),
      esc(`Pack sales (month): ₩${totalSales.toLocaleString()}`),
      esc(`Completed check-ins (month): ${completedCheckIns}`),
      esc(`Total Payout: ₩${totalPayout.toLocaleString()}`),
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

  // Macro calculator removed from client UI; normalize stale view state
  useEffect(() => {
    if (view === 'macro_calculator') replaceView('client_home');
  }, [view, replaceView]);

  useEffect(() => {
    if (view === 'client_home') setTrainingLogId(null);
  }, [view]);

  useEffect(() => {
    if (selectedMemberId) {
      sessionStorage.setItem('hall_of_fame_member_id', selectedMemberId);
    }
  }, [selectedMemberId]);

  useEffect(() => {
    if (view !== 'admin_schedule') setScheduleCalendarSeed(null);
  }, [view]);

  return (
    <div className="bg-white min-h-[100dvh] flex flex-col font-sans selection:bg-emerald-500/20 overflow-x-hidden">
      <AnimatePresence>
        {showIntro && <CinematicIntro onComplete={() => setShowIntro(false)} />}
      </AnimatePresence>

      {!showIntro && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        >
          
          {/* [PASSWORD RESET OVERRIDE] - Shows above everything else */}
          {showResetPassword && (
            <ResetPasswordView 
              onClose={() => {
                console.log('🔄 Closing reset view, returning to login');
                setShowResetPassword(false);
                replaceView('login');
              }} 
            />
          )}

          {/* Normal views - only show if NOT in password reset mode */}
          {/* 가입 플로우: 전역 loading 시 RegisterView가 언마운트되면 isSuccess가 날아가므로 register는 로딩 게이트 밖에서 렌더 */}
          {!showResetPassword && loading && view !== 'register' && (
            <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-white text-slate-900 gap-6">
              <LabDotBrand variant="header" />
              <p className="text-gray-400 text-xs tracking-[0.2em] uppercase">준비 중</p>
            </div>
          )}
          {!showResetPassword && view === 'register' && (
            <RegisterView setView={navigate} goBack={goBack} />
          )}
          {!showResetPassword && !loading && (
            <>
              {!session && view === 'login' && <LoginView setView={navigate} />}

              {/* 로그인 했을 때 보여줄 화면 (일반 회원) */}
              {session && view === 'client_home' && <ClientHome user={session.user} logout={handleLogout} setView={navigate} goBack={goBack} />}

          {/* 관리자 화면 (admin role 필수) */}
          {view === 'admin_home' && (
            <AdminRoute session={session} replaceView={replaceView}>
              <AdminHome setView={navigate} logout={handleLogout} onOpenTrainingLog={() => setShowAdminTrainingReport(true)} />
            </AdminRoute>
          )}

          {/* 회원 목록 */}
          {view === 'member_list' && (
            <AdminRoute session={session} replaceView={replaceView}>
              <MemberList setView={navigate} goBack={goBack} setSelectedMemberId={setSelectedMemberId} />
            </AdminRoute>
          )}

          {view === 'hall_of_fame_hub' && (
            <AdminRoute session={session} replaceView={replaceView}>
              <HallOfFameHub setView={navigate} goBack={goBack} setSelectedMemberId={setSelectedMemberId} />
            </AdminRoute>
          )}

          {view === 'admin_settings' && (
            <AdminRoute session={session} replaceView={replaceView}>
              <AdminSettings goBack={goBack} />
            </AdminRoute>
          )}

          {view === 'admin_payroll' && (
            <AdminRoute session={session} replaceView={replaceView}>
              <AdminPayrollDashboard goBack={goBack} />
            </AdminRoute>
          )}

          {/* 회원 상세 */}
          {view === 'member_detail' && selectedMemberId && (
            <AdminRoute session={session} replaceView={replaceView}>
              <MemberDetail selectedMemberId={selectedMemberId} goBack={goBack} />
            </AdminRoute>
          )}
          {view === 'hall_of_fame_member' && selectedMemberId && (
            <AdminRoute session={session} replaceView={replaceView}>
              <MemberDetail
                selectedMemberId={selectedMemberId}
                goBack={() => navigate('hall_of_fame_hub')}
                startInStatusMode
                onExitAthleteView={() => {
                  sessionStorage.removeItem('hall_of_fame_member_id');
                  setSelectedMemberId(null);
                  navigate('hall_of_fame_hub');
                }}
                fallbackToHub
              />
            </AdminRoute>
          )}
          {view === 'member_detail' && !selectedMemberId && (
            <AdminRoute session={session} replaceView={replaceView}>
              <div className="min-h-[100dvh] flex items-center justify-center bg-[#050505] px-6 text-zinc-300">
                <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-6 text-center backdrop-blur-xl">
                  <p className="text-sm tracking-wide">회원 상태가 유실되어 목록으로 이동합니다.</p>
                  <button
                    type="button"
                    onClick={() => navigate('member_list')}
                    className="mt-4 rounded-lg border border-white/10 bg-zinc-800/50 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-700/50"
                  >
                    회원 목록으로
                  </button>
                </div>
              </div>
            </AdminRoute>
          )}

          {/* QR 스캐너 */}
          {view === 'scanner' && (
            <AdminRoute session={session} replaceView={replaceView}>
              <QRScanner setView={navigate} goBack={goBack} />
            </AdminRoute>
          )}

          {/* Schedule: FullCalendar + embedded 예약 설정 */}
          {view === 'admin_schedule' && (
            <AdminRoute session={session} replaceView={replaceView}>
              <div className="min-h-[100dvh] bg-gradient-to-b from-white to-emerald-50/20 text-slate-900 flex flex-col overflow-y-auto pb-24">
                <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2 max-w-7xl w-full mx-auto">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <BackButton onClick={goBack} />
                      <h1 className="mt-3 text-lg sm:text-xl font-light tracking-wide text-[#064e3b]">일정 &amp; 예약</h1>
                      <p className="text-xs sm:text-sm text-slate-500 mt-0.5">50분 세션 · 예약을 누르면 작업 선택</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('admin_settings')}
                      className="shrink-0 text-[10px] sm:text-xs font-medium tracking-wider text-[#064e3b] border border-[#064e3b]/30 px-3 py-2 rounded-lg bg-white/95 hover:bg-emerald-50/90 active:scale-[0.99] min-h-[40px] transition-colors"
                    >
                      예약 설정 (전체)
                    </button>
                  </div>
                </div>
                <div className="flex-1 px-4 sm:px-6 max-w-7xl w-full mx-auto flex flex-col gap-4">
                  <AdminBookingSettingsPanel variant="embed" className="shrink-0" />
                  <div className="min-h-[min(60vh,640px)] flex-1 pb-3">
                    <AdminScheduleFullCalendar
                      key={scheduleCalendarSeed ? String(scheduleCalendarSeed.getTime()) : 'cal'}
                      events={adminCalendarEvents}
                      loading={isRevenueLoading}
                      initialDate={scheduleCalendarSeed ?? undefined}
                      onEventClick={(info) => {
                        const item = info?.event?.extendedProps?.item;
                        const dateKey = info?.event?.extendedProps?.dateKey;
                        if (!item || !dateKey) return;
                        if (item?.booking?.status === 'completed' || item?.status === 'Completed') return;
                        openCalendarActionModal(item);
                      }}
                    />
                  </div>
                </div>

                {calendarActionModal ? (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xl"
                    role="dialog"
                    aria-modal="true"
                    aria-label="일정 작업 선택"
                    onClick={closeCalendarActionModal}
                  >
                    <div
                      className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950/95 p-5 text-white shadow-[0_24px_90px_-12px_rgba(0,0,0,0.7)]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-emerald-400/80">
                            일정 관리 (Schedule Management)
                          </p>
                          <p className="mt-2 text-lg font-semibold tracking-tight text-white">
                            {calendarActionModal.userName}
                          </p>
                          <p className="mt-1 text-sm text-white/55">
                            {calendarActionModal.date} · {calendarActionModal.time}
                          </p>
                          <p className="mt-2 text-xs leading-relaxed text-white/45">
                            해당 일정의 수업을 완료(출석/노쇼) 처리하거나, 일정을 캘린더에서 취소할 수 있습니다.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={closeCalendarActionModal}
                          className="text-white/55 transition hover:text-white"
                          aria-label="모달 닫기"
                        >
                          X
                        </button>
                      </div>

                      <div className="mt-5 grid grid-cols-1 gap-3">
                        <button
                          type="button"
                          disabled={calendarActionBusy}
                          onClick={completeBookingFromCalendar}
                          className="rounded-xl border border-emerald-300/40 bg-emerald-500/30 px-4 py-3 text-sm font-black text-emerald-50 shadow-[0_0_20px_rgba(16,185,129,0.35)] transition hover:bg-emerald-500/40 disabled:opacity-40"
                        >
                          수업 완료 처리
                        </button>
                        <button
                          type="button"
                          disabled={calendarActionBusy}
                          onClick={cancelBookingFromCalendar}
                          className="rounded-xl border border-red-300/35 bg-transparent px-4 py-3 text-sm font-semibold text-red-200/90 transition hover:bg-red-500/10 disabled:opacity-40"
                        >
                          일정 취소
                        </button>
                        <button
                          type="button"
                          disabled={calendarActionBusy}
                          onClick={closeCalendarActionModal}
                          className="rounded-xl px-4 py-2 text-sm font-medium text-white/60 transition hover:text-white disabled:opacity-40"
                        >
                          닫기
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </AdminRoute>
          )}

          {/* Revenue: monthly payroll & CSV only (was Private/Manager on Schedule) */}
          {view === 'revenue' && (
            <AdminRoute session={session} replaceView={replaceView}>
              <div className="min-h-[100dvh] bg-white flex flex-col text-slate-900 overflow-y-auto pb-24">
                <div className="p-6 pb-2">
                  <BackButton onClick={goBack} />
                  <h2 className="text-2xl font-bold text-emerald-600 mt-4">REVENUE</h2>
                  <p className="text-gray-500 text-sm mt-1">Pack sales, total payout (base + incentive + bonus), and payroll export for the selected month.</p>
                </div>

                <div className="px-6 flex-1 flex flex-col">
                  <div className="flex items-center justify-center sm:justify-start gap-3 bg-gray-50 px-4 py-3 rounded-xl border border-gray-200 w-full sm:w-fit mb-6">
                    <button
                      type="button"
                      onClick={() => changeMonth(-1)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-emerald-600 transition"
                    >
                      <ChevronLeft size={24} />
                    </button>
                    <div className="flex items-center gap-2 min-w-[160px] justify-center">
                      <Calendar size={20} className="text-emerald-600" />
                      <span className="text-lg font-bold">
                        {currentRevenueDate.toLocaleDateString('en-US', { month: 'short' })} {currentRevenueDate.getFullYear()}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => changeMonth(1)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-emerald-600 transition"
                    >
                      <ChevronRight size={24} />
                    </button>
                  </div>

                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                        <span className="text-gray-600 text-xs">Total Sales</span>
                        <p className="text-xl font-bold text-emerald-600">₩ {fmt(monthlyPackSalesKrw)}</p>
                      </div>
                      <div className="bg-white rounded-xl p-4 border border-emerald-600/20 shadow-sm">
                        <span className="text-emerald-700/90 text-xs">Total Payout</span>
                        <p className="text-xl font-bold text-emerald-600">₩ {fmt(grossPayoutAmount())}</p>
                      </div>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                      <button
                        type="button"
                        onClick={downloadPayrollCSV}
                        className="flex items-center gap-2 bg-emerald-600 px-4 py-2 rounded-xl text-white font-bold text-sm"
                      >
                        Report
                      </button>
                    </div>
                    <div className="mt-4 p-4 rounded-xl border border-gray-200 bg-gray-50 grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="text-gray-600 text-xs">Base</label>
                        <input
                          type="number"
                          value={salaryConfig.base}
                          onChange={(e) => handleConfigChange('base', e.target.value)}
                          className="w-full bg-white rounded px-3 py-2 text-slate-900 border border-gray-200"
                        />
                      </div>
                      <div>
                        <label className="text-gray-600 text-xs">Incentive %</label>
                        <input
                          type="number"
                          value={salaryConfig.incentiveRate}
                          onChange={(e) => handleConfigChange('incentiveRate', e.target.value)}
                          className="w-full bg-white rounded px-3 py-2 text-emerald-700 border border-gray-200"
                        />
                      </div>
                      <div>
                        <label className="text-gray-600 text-xs">Bonus</label>
                        <input
                          type="number"
                          value={salaryConfig.extra}
                          onChange={(e) => handleConfigChange('extra', e.target.value)}
                          className="w-full bg-white rounded px-3 py-2 text-green-600 border border-gray-200"
                        />
                      </div>
                    </div>
                  </motion.div>
                </div>

                <div className="sticky bottom-0 left-0 right-0 py-3 px-6 bg-white border-t border-gray-200/70 text-center shadow-sm mt-auto">
                  <p className="text-gray-600 text-xs">
                    Total Monthly Sessions: <span className="text-emerald-600 font-semibold">{isRevenueLoading ? '—' : monthlyScheduledCount}</span>
                    <span className="ml-4">Revenue: ₩{fmt(monthlyPackSalesKrw)}</span>
                  </p>
                </div>
              </div>
            </AdminRoute>
          )}

          {/* 클래스 예약 */}
          {session && view === 'class_booking' && (
            <ClassBooking user={session.user} setView={navigate} goBack={goBack} />
          )}

          {session && view === 'training_log' && (
            <TrainingLogList
              user={session.user}
              setView={navigate}
              goBack={goBack}
              onOpenDetail={(id) => {
                setTrainingLogId(id);
                navigate('training_log_detail');
              }}
            />
          )}

          {session && view === 'training_log_detail' && trainingLogId && (
            <TrainingLogDetail user={session.user} reportId={trainingLogId} onBack={goBack} />
          )}

          {/* Library article — full-screen editorial (no modal) */}
          {session && view === 'library_article' && selectedPost && (
            <LibraryArticleScreen
              post={selectedPost}
              onBack={() => {
                setSelectedPost(null);
                goBack();
              }}
            />
          )}

          {/* 라이브러리 (지식 베이스) */}
          {(session || view === 'admin_home' || view === 'library') && view === 'library' && (
            <div className="min-h-[100dvh] h-full max-w-full bg-white flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 p-6 pb-24" style={{ WebkitOverflowScrolling: 'touch' }}>
              <BackButton onClick={goBack} />
              
              <div className="flex flex-wrap justify-between items-center gap-3 mb-6 max-w-full">
                <h2 className="text-2xl font-bold text-emerald-600">📚 KNOWLEDGE BASE</h2>
                {userProfileRole === 'admin' && (
                  <button 
                    onClick={() => setShowWriteModal(true)}
                    className="bg-emerald-600 text-white px-4 py-2 rounded font-bold hover:bg-emerald-500 transition shadow-md"
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
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-50 text-gray-600 hover:text-slate-900 border border-gray-200'
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
                  className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-slate-900 focus:border-emerald-600 outline-none w-full"
                />
                <button
                  onClick={handleSearch}
                  className="shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-3 rounded-xl transition-all flex items-center gap-2"
                >
                  <Search size={20} />
                  Search
                </button>
              </div>

              {isLibraryLoading ? (
                <div className="text-center text-gray-500 mt-10">Loading library...</div>
              ) : filteredPosts.length === 0 ? (
                <div className="text-center text-gray-600 mt-10 p-8 border border-gray-200 rounded-lg bg-white shadow-sm">
                  <p className="text-xl">No posts found.</p>
                  {userProfileRole === 'admin' && <p className="text-sm mt-2">Click "+ NEW POST" to add content.</p>}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full max-w-full">
                  {filteredPosts.map((post) => (
                    <button
                      key={post.id}
                      onClick={() => {
                        setSelectedPost(post);
                        navigate('library_article');
                      }}
                      className="bg-white rounded-xl overflow-hidden border border-gray-200 hover:border-emerald-500/40 transition-all cursor-pointer group shadow-sm"
                    >
                      {post.image_url ? (
                        <img src={post.image_url} alt={post.title} className="w-full h-32 object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <div className="w-full h-32 bg-gray-100 flex items-center justify-center text-gray-500 border-b border-gray-200">
                          <Image size={32} />
                        </div>
                      )}
                      <div className="p-3">
                        <h3 className="font-bold text-sm text-slate-900 line-clamp-2 text-left">{post.title}</h3>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              </div>

              {/* Write Modal */}
              {showWriteModal && userProfileRole === 'admin' && (
                <div className="fixed inset-0 bg-gray-900/20 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                  <div className="bg-white p-6 rounded-xl w-full max-w-lg border border-emerald-600/20 shadow-xl">
                    <h3 className="text-xl font-bold text-emerald-600 mb-6">Create New Post</h3>
                    
                    <input 
                      className="w-full bg-gray-50 p-3 rounded mb-4 text-slate-900 border border-gray-200 focus:border-emerald-600 outline-none"
                      placeholder="Title"
                      value={newPost.title}
                      onChange={(e) => setNewPost({...newPost, title: e.target.value})}
                    />
                    
                    <select 
                      className="w-full bg-gray-50 p-3 rounded mb-4 text-slate-900 border border-gray-200 outline-none"
                      value={newPost.category}
                      onChange={(e) => setNewPost({...newPost, category: e.target.value})}
                    >
                      <option value="Exercise">Exercise</option>
                      <option value="Diet">Diet</option>
                      <option value="Routine">Routine</option>
                      <option value="Tip">Tip</option>
                    </select>

                    <input 
                      className="w-full bg-gray-50 p-3 rounded mb-4 text-slate-900 border border-gray-200 focus:border-emerald-600 outline-none"
                      placeholder="Image URL (Optional)"
                      value={newPost.image_url}
                      onChange={(e) => setNewPost({...newPost, image_url: e.target.value})}
                    />

                    <textarea 
                      className="w-full bg-gray-50 p-3 rounded mb-6 text-slate-900 border border-gray-200 focus:border-emerald-600 outline-none h-32 resize-none"
                      placeholder="Content..."
                      value={newPost.content}
                      onChange={(e) => setNewPost({...newPost, content: e.target.value})}
                    />

                    <div className="flex justify-end gap-3">
                      <button 
                        onClick={() => setShowWriteModal(false)}
                        className="px-4 py-2 text-gray-600 hover:text-slate-900 font-bold"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleSavePost}
                        className="bg-emerald-600 text-white px-6 py-2 rounded font-bold hover:bg-emerald-500 transition"
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

          {showAdminTrainingReport && (
            <AdminTrainingReportForm
              onClose={() => setShowAdminTrainingReport(false)}
              onSaved={() => setShowAdminTrainingReport(false)}
            />
          )}
        </motion.div>
      )}
    </div>
  );
}

