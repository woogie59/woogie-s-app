import { supabase } from './supabaseClient';

// 1. 회원가입 (이메일, 비번 + 추가정보)
export const signUpNewUser = async (email, password, userData) => {
    // Supabase Auth에 가입 요청
    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
            // 사용자 메타데이터에 이름, 생년월일, 목표 등을 같이 저장
            data: {
                full_name: userData.name,
                dob: userData.dob,
                gender: userData.gender,
                goal: userData.goal,
                role: 'user', // 기본 권한은 'user'
            },
        },
    });
    return { data, error };
};

// 2. 로그인
export const signInUser = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    return { data, error };
};

// 3. 로그아웃
export const signOutUser = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
};

// 4. 현재 로그인 세션 확인 (새로고침 시 유지용)
export const getCurrentSession = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    return { session, error };
};