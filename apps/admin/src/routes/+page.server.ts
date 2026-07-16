import { redirect } from '@sveltejs/kit';

export const load = () => {
    // 어드민 메인 접속 시 무거운 대시보드 대신 피드백 화면으로 즉시 넘김
    redirect(302, '/interactions');
};
