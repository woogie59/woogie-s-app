import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// [디버깅용 안전장치] 키가 없으면 에러를 띄웁니다.
if (!supabaseUrl || !supabaseAnonKey) {
    console.error('⚠️ Supabase URL 또는 Key가 없습니다! .env 파일을 확인하세요.');
    alert('개발 설정 오류: .env 파일에서 Supabase 정보를 읽을 수 없습니다. 서버를 재시작해보세요.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)