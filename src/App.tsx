import { useEffect } from 'react';
import { useAppStore } from './store/appStore';
import LoginScreen from './components/LoginScreen';
import AdminPanel from './components/admin/AdminPanel';
import TeacherPanel from './components/teacher/TeacherPanel';
import StudentRouter from './components/student/StudentRouter';
import AlertContainer from './components/AlertContainer';

const FAVICONS: Record<string, string> = {
  admin:   '/favicon-admin.svg',
  teacher: '/favicon-teacher.svg',
  student: '/favicon-student.svg',
  default: '/favicon.svg',
};

function setFavicon(href: string) {
  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    document.head.appendChild(link);
  }
  link.href = href;
}

export default function App() {
  const { isLoggedIn, currentRole } = useAppStore();

  useEffect(() => {
    setFavicon(currentRole ? (FAVICONS[currentRole] ?? FAVICONS.default) : FAVICONS.default);
  }, [currentRole]);

  return (
    <div className="font-vazir" dir="rtl">
      <AlertContainer />
      {!isLoggedIn ? (
        <LoginScreen />
      ) : currentRole === 'admin' ? (
        <AdminPanel />
      ) : currentRole === 'teacher' ? (
        <TeacherPanel />
      ) : currentRole === 'student' ? (
        <StudentRouter />
      ) : (
        <LoginScreen />
      )}
    </div>
  );
}
