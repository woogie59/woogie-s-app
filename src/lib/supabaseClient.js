import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// [디버깅용 안전장치] 키가 없으면 에러를 띄웁니다.
if (!supabaseUrl || !supabaseAnonKey) {
    console.error('⚠️ Supabase URL 또는 Key가 없습니다! .env 파일을 확인하세요.');
    alert('개발 설정 오류: .env 파일에서 Supabase 정보를 읽을 수 없습니다. 서버를 재시작해보세요.');
}

const REMEMBER_ME_KEY = 'rememberMePref'

function getActiveAuthStorage() {
  try {
    const pref = localStorage.getItem(REMEMBER_ME_KEY)
    return pref === 'false' ? sessionStorage : localStorage
  } catch {
    return localStorage
  }
}

const rememberMeStorage = {
  getItem(key) {
    return getActiveAuthStorage().getItem(key)
  },
  setItem(key, value) {
    const storage = getActiveAuthStorage()
    const other = storage === localStorage ? sessionStorage : localStorage
    other.removeItem(key)
    storage.setItem(key, value)
  },
  removeItem(key) {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
  },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: rememberMeStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
})

export { REMEMBER_ME_KEY }