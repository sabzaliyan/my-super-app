import { useState, useEffect } from 'react';
import { FiClock, FiLogOut } from 'react-icons/fi';
import { useAppStore } from '../../store/appStore';
import StudentPreClass from './StudentPreClass';
import StudentPanel from './StudentPanel';
import { toShamsi, getPersianWeekDay, getPersianTime, toPersianNum } from '../../utils/persian';

// Simple waiting screen — shown before teacher starts the class
function WaitingScreen() {
  const { activeClassId, classes, authToken, logout, currentUser } = useAppStore();
  const cls = classes.find(c => c.id === activeClassId);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Poll every 3 seconds for class live status
  useEffect(() => {
    const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3002';
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/classes/${activeClassId}/live`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const data = await res.json();
        if (data.isLive) useAppStore.setState({ isClassLive: true });
      } catch {}
    }, 8000);
    return () => clearInterval(poll);
  }, [activeClassId, authToken]);

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 gap-6">
      {/* Logout */}
      <div className="absolute top-4 left-4">
        <button onClick={logout} className="glass-btn rounded-lg px-3 py-2 text-red-400 flex items-center gap-1 text-xs">
          <FiLogOut size={14} /> خروج
        </button>
      </div>

      {/* Clock */}
      <div className="text-center">
        <p className="text-white font-bold" style={{ fontSize: '7rem', lineHeight: 1, letterSpacing: '0.05em' }}>
          {getPersianTime(now)}
        </p>
        <p className="text-white/40 text-xl mt-1">
          {toShamsi(now)} • {getPersianWeekDay(now)}
        </p>
      </div>

      {/* Info card */}
      <div className="glass rounded-3xl p-8 text-center max-w-sm w-full mx-4 animate-float-in">
        <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto mb-4">
          <FiClock size={32} className="text-indigo-400 animate-pulse" />
        </div>
        <h2 className="text-white font-bold text-xl mb-2">
          {cls?.name || 'کلاس'}
        </h2>
        <p className="text-white/50 text-sm mb-1">
          درس: {cls?.courseName} &nbsp;|&nbsp; معلم: {cls?.teacherName}
        </p>
        <p className="text-white/30 text-xs mb-5">
          ساعت برگزاری: {cls?.startTime} — {cls?.endTime}
        </p>
        <div className="bg-indigo-500/10 border border-indigo-400/20 rounded-xl px-4 py-3">
          <p className="text-indigo-300 text-sm font-semibold">در انتظار شروع کلاس توسط معلم</p>
          <p className="text-white/30 text-xs mt-1">به محض شروع، صفحه تست دستگاه و ورود به کلاس باز می‌شود</p>
        </div>
        <p className="text-white/20 text-xs mt-4">خوش آمدید، {currentUser}</p>
      </div>

      {/* Live dots animation */}
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <span key={i} className="w-2 h-2 rounded-full bg-indigo-400/40 animate-pulse"
            style={{ animationDelay: `${i * 0.3}s` }} />
        ))}
      </div>
    </div>
  );
}

export default function StudentRouter() {
  const { isClassLive, activeClassId, classes, studentReadyToJoin } = useAppStore();
  const cls = classes.find(c => c.id === activeClassId);

  if (!cls) return (
    <div className="min-h-screen flex items-center justify-center text-white">کلاس یافت نشد</div>
  );

  // Class not live yet → waiting room
  if (!isClassLive) return <WaitingScreen />;

  // Class is live, student entered → StudentPanel
  if (studentReadyToJoin) return <StudentPanel />;

  // Class is live, student not yet entered → PreClass (device test + enter button)
  return <StudentPreClass classData={cls} />;
}
