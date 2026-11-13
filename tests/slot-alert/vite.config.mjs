import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({plugins:[react()],resolve:{alias:[
 {find:/.*lib\/supabaseClient$/,replacement:path.resolve('tests/slot-alert/supabase.mock.js')},
 {find:'react-onesignal',replacement:path.resolve('tests/slot-alert/onesignal.mock.js')},
]},server:{host:'127.0.0.1',port:8473}});
