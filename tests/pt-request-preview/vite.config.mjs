import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 격리 더미 프리뷰 빌드 (테스트 전용, 앱 배포와 무관)
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  envDir: false,
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://dummy.invalid'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('dummy'),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
