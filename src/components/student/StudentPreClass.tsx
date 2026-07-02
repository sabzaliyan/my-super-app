import { useState, useEffect, useRef } from 'react';
import {
  FiCamera, FiMic, FiVolume2, FiLogOut, FiMonitor, FiCalendar,
  FiUsers, FiClock, FiHash, FiCheckCircle, FiAlertCircle,
  FiBarChart2, FiBookOpen, FiChevronDown, FiUser, FiKey,
} from 'react-icons/fi';
import { useAppStore } from '../../store/appStore';
import { toPersianNum, toShamsi, getPersianWeekDay, getPersianTime } from '../../utils/persian';
import type { ClassSession } from '../../store/types';

interface Props {
  classData: ClassSession;
}

export default function StudentPreClass({ classData }: Props) {
  const { logout, students, currentUser, currentUserId, addAlert, isClassLive, setStudentReadyToJoin, setCurrentAttendanceId, authToken } = useAppStore();
  const studentId = currentUserId;
  const [now, setNow] = useState(new Date());
  const [countdownActive, setCountdownActive] = useState(false);
  const [countdown, setCountdown] = useState(5);

  // ── Device ────────────────────────────────────────────────
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState(() => localStorage.getItem('pref_camera') || '');
  const [selectedMic, setSelectedMic] = useState(() => localStorage.getItem('pref_mic') || '');
  const [selectedSpeaker, setSelectedSpeaker] = useState(() => localStorage.getItem('pref_speaker') || '');
  const [cameraOk, setCameraOk] = useState(false);
  const [micOk, setMicOk] = useState(false);
  const [speakerOk, setSpeakerOk] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [micVolume, setMicVolume] = useState(80);
  const [speakerVolume, setSpeakerVolume] = useState(80);
  const videoRef = useRef<HTMLVideoElement>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micRafRef = useRef<number>(0);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // isClassLive از socket می‌آید (appStore._setupSocketListeners) — polling اضافه نیست

  // 5-second countdown then enter class
  useEffect(() => {
    if (!countdownActive) return;
    if (countdown <= 0) {
      const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3002';
      (async () => {
        try {
          const res = await fetch(`${API_URL}/api/classes/${classData.id}/sessions/student-join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({ studentId, joinedAt: new Date().toISOString() }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'خطا در ورود به کلاس' }));
            addAlert({ type: 'error', title: 'خطای ورود', message: err.error || 'کلاس در دسترس نیست', duration: 5000 });
            setCountdownActive(false);
            setCountdown(5);
            return;
          }
          const data = await res.json();
          setCurrentAttendanceId(data.attendanceId || null);
          setStudentReadyToJoin(true);
        } catch {
          addAlert({ type: 'error', title: 'خطای اتصال', message: 'ارتباط با سرور برقرار نشد', duration: 5000 });
          setCountdownActive(false);
          setCountdown(5);
        }
      })();
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdownActive, countdown, classData.id, authToken, studentId]);

  const handleEnterClass = () => {
    setCountdown(5);
    setCountdownActive(true);
  };

  // ── student data ──────────────────────────────────────────
  const student = students.find(s => s.id === currentUserId);
  const classStudents = students.filter(s => (classData.students || []).includes(s.id));
  const onlineCount = classStudents.filter(s => s.isOnline).length;

  const totalSessions = (classData.sessions || []).length;
  const usedHours = Math.round((classData.sessions || []).reduce((sum, s) => sum + (s.duration || 0), 0) / 60 * 10) / 10;
  const remainingHours = Math.max(0, (classData.totalHours || 0) - usedHours);
  const usedPercent = classData.totalHours ? Math.min(100, Math.round(usedHours / classData.totalHours * 100)) : 0;

  const dayNames: Record<string, string> = {
    saturday: 'شنبه', sunday: 'یکشنبه', monday: 'دوشنبه',
    tuesday: 'سه‌شنبه', wednesday: 'چهارشنبه', thursday: 'پنجشنبه', friday: 'جمعه',
  };

  // ── Enumerate devices ─────────────────────────────────────
  const enumerateDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter(d => d.kind === 'videoinput');
      const microphones = devices.filter(d => d.kind === 'audioinput');
      const spkrs = devices.filter(d => d.kind === 'audiooutput');
      setCameras(cams);
      setMics(microphones);
      setSpeakers(spkrs);
      const savedCam = localStorage.getItem('pref_camera');
      const savedMic = localStorage.getItem('pref_mic');
      const savedSpk = localStorage.getItem('pref_speaker');
      if (cams.length) setSelectedCamera(c => (savedCam && cams.find(d => d.deviceId === savedCam)) ? savedCam : c || cams[0].deviceId);
      if (microphones.length) setSelectedMic(c => (savedMic && microphones.find(d => d.deviceId === savedMic)) ? savedMic : c || microphones[0].deviceId);
      if (spkrs.length) setSelectedSpeaker(c => (savedSpk && spkrs.find(d => d.deviceId === savedSpk)) ? savedSpk : c || spkrs[0].deviceId);
    } catch {}
  };

  useEffect(() => {
    enumerateDevices();
    navigator.mediaDevices.addEventListener('devicechange', enumerateDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', enumerateDevices);
  }, []);

  const testCamera = async () => {
    try {
      camStreamRef.current?.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: selectedCamera ? { deviceId: { exact: selectedCamera } } : true,
      });
      camStreamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      await enumerateDevices();
      setCameraOk(true);
      addAlert({ type: 'success', title: 'دوربین', message: 'دوربین با موفقیت تست شد', duration: 2000 });
    } catch {
      addAlert({ type: 'error', title: 'خطا', message: 'دسترسی به دوربین رد شد', duration: 3000 });
    }
  };

  const testMic = async () => {
    try {
      micStreamRef.current?.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(micRafRef.current);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
      });
      micStreamRef.current = stream;
      await enumerateDevices();
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        setMicLevel(Math.min(100, Math.round(data.reduce((s, v) => s + v, 0) / data.length * 2.5)));
        micRafRef.current = requestAnimationFrame(tick);
      };
      tick();
      setMicOk(true);
      addAlert({ type: 'success', title: 'میکروفون', message: 'میکروفون با موفقیت تست شد', duration: 2000 });
    } catch {
      addAlert({ type: 'error', title: 'خطا', message: 'دسترسی به میکروفون رد شد', duration: 3000 });
    }
  };

  const testSpeaker = async () => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      gain.gain.value = speakerVolume / 100 * 0.3;
      osc.frequency.value = 880;
      osc.start(); setTimeout(() => { osc.stop(); ctx.close(); }, 600);
      setSpeakerOk(true);
      addAlert({ type: 'success', title: 'اسپیکر', message: 'صدای تست پخش شد', duration: 2000 });
    } catch {
      addAlert({ type: 'error', title: 'خطا', message: 'خطا در پخش صدا', duration: 3000 });
    }
  };

  useEffect(() => () => {
    camStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    cancelAnimationFrame(micRafRef.current);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="glass border-b border-white/10 px-4 py-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <FiUsers size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-sm leading-tight">سامانه کلاس‌های آموزشی سبز</h1>
              <p className="text-white/30 text-[10px]">G-Online-Edu-App</p>
            </div>
          </div>

          <div className="glass-dark rounded-xl px-4 py-2 text-center">
            <p className="text-white font-semibold text-sm">پنل دانش‌آموز • آماده‌سازی</p>
            <p className="text-white/40 text-xs">{classData.name} • {classData.courseName}</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-left">
              <p className="text-white/60 text-xs">{toShamsi(now)}</p>
              <p className="text-white/40 text-[10px]">{getPersianWeekDay(now)}</p>
              <p className="text-white/50 text-xs">{getPersianTime(now)}</p>
            </div>
            <button onClick={logout} className="glass-btn rounded-lg p-2 text-red-400"><FiLogOut size={16} /></button>
          </div>
        </div>
      </div>

      {/* Entry banner — always visible */}
      <div className={`border-b px-4 py-2 flex items-center justify-center gap-3 transition-all ${
        isClassLive
          ? 'bg-emerald-500/10 border-emerald-400/20'
          : 'bg-white/5 border-white/10'
      }`}>
        {isClassLive
          ? <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          : <span className="w-2 h-2 rounded-full bg-white/20 shrink-0" />
        }
        <p className={`text-sm ${isClassLive ? 'text-emerald-300 font-semibold' : 'text-white/40'}`}>
          {isClassLive ? 'کلاس شروع شده — آماده ورود هستید' : 'کلاس هنوز شروع نشده'}
        </p>
        <button onClick={handleEnterClass}
          className={`mr-2 rounded-lg px-4 py-1 text-sm font-bold transition-all ${
            isClassLive
              ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
              : 'bg-white/10 hover:bg-white/20 text-white/50'
          }`}>
          ورود به کلاس
        </button>
      </div>

      <div className="flex-1 p-4 overflow-auto">
        <div className="max-w-4xl mx-auto space-y-4">

          {/* Student info card */}
          <div className="glass rounded-2xl p-5 animate-float-in">
            <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <FiUser className="text-emerald-400" /> اطلاعات شما
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="glass-dark rounded-xl p-3">
                <p className="text-white/40 text-xs flex items-center gap-1"><FiUser size={10} /> نام</p>
                <p className="text-white text-sm font-bold mt-1">{student?.name || currentUser}</p>
              </div>
              <div className="glass-dark rounded-xl p-3">
                <p className="text-white/40 text-xs flex items-center gap-1"><FiKey size={10} /> رمز عبور</p>
                <p className="text-white/60 text-sm font-mono mt-1" dir="ltr">{student?.password || '—'}</p>
              </div>
              <div className="glass-dark rounded-xl p-3">
                <p className="text-white/40 text-xs">وضعیت</p>
                <p className="text-emerald-400 text-sm font-bold mt-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" /> آنلاین
                </p>
              </div>
            </div>
          </div>

          {/* Class Info */}
          <div className="glass rounded-2xl p-5 animate-float-in">
            <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <FiCalendar className="text-cyan-400" /> اطلاعات کلاس
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div className="glass-dark rounded-xl p-3">
                <p className="text-white/40 text-xs flex items-center gap-1"><FiBookOpen size={10} /> نام کلاس / درس</p>
                <p className="text-white text-sm font-bold mt-1">{classData.name}</p>
                <p className="text-white/40 text-xs mt-0.5">{classData.courseName}</p>
              </div>
              <div className="glass-dark rounded-xl p-3">
                <p className="text-white/40 text-xs flex items-center gap-1"><FiHash size={10} /> کد کلاس</p>
                <p className="text-cyan-300 text-sm font-mono font-bold mt-1 tracking-wider" dir="ltr">{classData.code}</p>
              </div>
              <div className="glass-dark rounded-xl p-3">
                <p className="text-white/40 text-xs flex items-center gap-1"><FiCalendar size={10} /> تاریخ برگزاری</p>
                <p className="text-white text-xs font-medium mt-1" dir="ltr">{classData.startDate} ← {classData.endDate}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(classData.scheduleDays || []).map(d => (
                    <span key={d} className="text-[10px] bg-cyan-500/10 text-cyan-300 rounded px-1">{dayNames[d] || d}</span>
                  ))}
                </div>
              </div>
              <div className="glass-dark rounded-xl p-3">
                <p className="text-white/40 text-xs flex items-center gap-1"><FiClock size={10} /> ساعت کلاس</p>
                <p className="text-white text-sm font-bold mt-1" dir="ltr">{classData.startTime} — {classData.endTime}</p>
                <p className="text-white/40 text-xs mt-0.5">معلم: {classData.teacherName}</p>
              </div>
            </div>

            {/* Students row */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="glass-dark rounded-xl p-3 text-center">
                <p className="text-white/40 text-[11px] mb-1">ثبت‌نام‌شده</p>
                <p className="text-white text-xl font-bold leading-none">{toPersianNum(classStudents.length)}</p>
                <p className="text-white/30 text-xs mt-1">از {toPersianNum(classData.capacity || 0)}</p>
              </div>
              <div className="glass-dark rounded-xl p-3 text-center">
                <p className="text-white/40 text-[11px] mb-1">آنلاین</p>
                <p className="text-green-400 text-xl font-bold leading-none">{toPersianNum(onlineCount)}</p>
                <div className="flex justify-center mt-1"><div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /></div>
              </div>
              <div className="glass-dark rounded-xl p-3 text-center">
                <p className="text-white/40 text-[11px] mb-1">جلسات</p>
                <p className="text-indigo-400 text-xl font-bold leading-none">{toPersianNum(totalSessions)}</p>
                <p className="text-white/30 text-xs mt-1">برگزارشده</p>
              </div>
            </div>

            {/* Hours bar */}
            <div className="glass-dark rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white/60 text-xs flex items-center gap-1"><FiBarChart2 size={12} /> ساعات کلاس</p>
                <p className="text-white/40 text-xs">{toPersianNum(usedHours)} از {toPersianNum(classData.totalHours || 0)} ساعت</p>
              </div>
              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden mb-3">
                <div className={`h-full rounded-full transition-all ${usedPercent > 80 ? 'bg-red-400' : usedPercent > 50 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                  style={{ width: `${usedPercent}%` }} />
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-white/40 text-[10px]">کل</p>
                  <p className="text-white text-lg font-bold">{toPersianNum(classData.totalHours || 0)}<span className="text-white/30 text-xs"> ساعت</span></p>
                </div>
                <div>
                  <p className="text-white/40 text-[10px]">مصرف‌شده</p>
                  <p className="text-amber-400 text-lg font-bold">{toPersianNum(usedHours)}<span className="text-white/30 text-xs"> ساعت</span></p>
                </div>
                <div>
                  <p className="text-white/40 text-[10px]">باقی‌مانده</p>
                  <p className={`text-lg font-bold ${remainingHours <= 2 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {toPersianNum(remainingHours)}<span className="text-white/30 text-xs"> ساعت</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Device Test */}
          <div className="glass rounded-2xl p-5 animate-float-in">
            <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <FiCamera className="text-emerald-400" /> تست دستگاه‌ها
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* Camera */}
              <div className="glass-dark rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cameraOk ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/30'}`}>
                    <FiCamera size={16} />
                  </div>
                  <span className="text-white text-sm font-medium">دوربین</span>
                  {cameraOk && <span className="text-emerald-400 text-xs mr-auto">✓ فعال</span>}
                </div>
                <div className="relative">
                  <select value={selectedCamera}
                    onChange={e => { setSelectedCamera(e.target.value); localStorage.setItem('pref_camera', e.target.value); setCameraOk(false); }}
                    className="glass-input w-full rounded-lg px-3 py-2 text-xs text-white appearance-none pr-7" dir="rtl">
                    {cameras.length === 0 && <option value="">دوربین یافت نشد</option>}
                    {cameras.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `دوربین ${cameras.indexOf(d) + 1}`}</option>)}
                  </select>
                  <FiChevronDown size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                </div>
                <div className="rounded-lg overflow-hidden bg-black" style={{ aspectRatio: '16/9', width: '100%' }}>
                  <video ref={videoRef} muted playsInline
                    className={cameraOk ? '' : 'hidden'}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                  {!cameraOk && (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FiCamera size={28} className="text-white/10" />
                    </div>
                  )}
                </div>
                <button onClick={testCamera}
                  className={`rounded-lg py-2 text-xs w-full ${cameraOk ? 'bg-emerald-500/20 text-emerald-400' : 'glass-btn text-white/60 hover:text-white'}`}>
                  {cameraOk ? '✓ تست موفق — تست مجدد' : 'تست دوربین'}
                </button>
              </div>

              {/* Microphone */}
              <div className="glass-dark rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${micOk ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/30'}`}>
                    <FiMic size={16} />
                  </div>
                  <span className="text-white text-sm font-medium">میکروفون</span>
                  {micOk && <span className="text-emerald-400 text-xs mr-auto">✓ فعال</span>}
                </div>
                <div className="relative">
                  <select value={selectedMic}
                    onChange={e => { setSelectedMic(e.target.value); localStorage.setItem('pref_mic', e.target.value); setMicOk(false); setMicLevel(0); }}
                    className="glass-input w-full rounded-lg px-3 py-2 text-xs text-white appearance-none pr-7" dir="rtl">
                    {mics.length === 0 && <option value="">میکروفون یافت نشد</option>}
                    {mics.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `میکروفون ${mics.indexOf(d) + 1}`}</option>)}
                  </select>
                  <FiChevronDown size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                </div>
                <div>
                  <p className="text-white/40 text-[10px] mb-1">سطح صدا</p>
                  <div className="flex gap-0.5 h-5 items-end">
                    {Array.from({ length: 20 }).map((_, i) => {
                      const active = micLevel >= (i + 1) * 5;
                      const color = i < 12 ? 'bg-emerald-400' : i < 16 ? 'bg-amber-400' : 'bg-red-400';
                      return <div key={i} className={`flex-1 rounded-sm transition-all duration-75 ${active ? color : 'bg-white/10'}`} style={{ height: `${40 + i * 3}%` }} />;
                    })}
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <p className="text-white/40 text-[10px]">حساسیت میکروفون</p>
                    <p className="text-white/60 text-[10px]">{toPersianNum(micVolume)}٪</p>
                  </div>
                  <input type="range" min={0} max={100} value={micVolume} onChange={e => setMicVolume(+e.target.value)}
                    className="w-full h-1.5 rounded-full accent-emerald-400 cursor-pointer" />
                </div>
                <button onClick={testMic}
                  className={`rounded-lg py-2 text-xs w-full ${micOk ? 'bg-emerald-500/20 text-emerald-400' : 'glass-btn text-white/60 hover:text-white'}`}>
                  {micOk ? '✓ تست موفق — تست مجدد' : 'تست میکروفون'}
                </button>
              </div>

              {/* Speaker */}
              <div className="glass-dark rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${speakerOk ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/30'}`}>
                    <FiVolume2 size={16} />
                  </div>
                  <span className="text-white text-sm font-medium">اسپیکر</span>
                  {speakerOk && <span className="text-emerald-400 text-xs mr-auto">✓ فعال</span>}
                </div>
                <div className="relative">
                  <select value={selectedSpeaker}
                    onChange={e => { setSelectedSpeaker(e.target.value); localStorage.setItem('pref_speaker', e.target.value); setSpeakerOk(false); }}
                    className="glass-input w-full rounded-lg px-3 py-2 text-xs text-white appearance-none pr-7" dir="rtl">
                    {speakers.length === 0 && <option value="">اسپیکر یافت نشد</option>}
                    {speakers.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `اسپیکر ${speakers.indexOf(d) + 1}`}</option>)}
                  </select>
                  <FiChevronDown size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                </div>
                <div className="flex items-center justify-center gap-1 h-16">
                  {Array.from({ length: 7 }).map((_, i) => {
                    const h = [30, 55, 75, 100, 75, 55, 30][i];
                    return <div key={i} className={`w-2 rounded-full transition-all ${speakerOk ? 'bg-emerald-400' : 'bg-white/15'}`}
                      style={{ height: `${h}%`, animation: speakerOk ? `pulse 0.8s ease-in-out ${i * 80}ms infinite alternate` : 'none' }} />;
                  })}
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <p className="text-white/40 text-[10px]">میزان صدای اسپیکر</p>
                    <p className="text-white/60 text-[10px]">{toPersianNum(speakerVolume)}٪</p>
                  </div>
                  <input type="range" min={0} max={100} value={speakerVolume} onChange={e => setSpeakerVolume(+e.target.value)}
                    className="w-full h-1.5 rounded-full accent-cyan-400 cursor-pointer" />
                </div>
                <button onClick={testSpeaker}
                  className={`rounded-lg py-2 text-xs w-full ${speakerOk ? 'bg-emerald-500/20 text-emerald-400' : 'glass-btn text-white/60 hover:text-white'}`}>
                  {speakerOk ? '✓ تست موفق — پخش مجدد' : 'تست اسپیکر'}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 5-second countdown overlay */}
      {countdownActive && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(14px)' }}>
          <div className="relative w-44 h-44 mb-6">
            <svg className="-rotate-90 w-44 h-44" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
              <circle cx="60" cy="60" r="54" fill="none" stroke="#10b981" strokeWidth="6"
                strokeDasharray="339.3"
                strokeDashoffset={339.3 * (1 - countdown / 5)}
                strokeLinecap="round" className="transition-all duration-1000" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-emerald-400 font-bold"
              style={{ fontSize: '5rem', lineHeight: 1 }}>
              {toPersianNum(countdown)}
            </span>
          </div>
          <p className="text-white font-bold text-2xl mb-2">در حال ورود به کلاس...</p>
          <p className="text-white/40 text-sm">{classData.name} • {classData.teacherName}</p>
        </div>
      )}
    </div>
  );
}
