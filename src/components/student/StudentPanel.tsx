import { useState, useEffect, useRef } from 'react';
import {
  FiMic, FiMicOff, FiCamera, FiCameraOff, FiVolume2, FiVolumeX,
  FiSettings, FiMessageSquare, FiMonitor,
  FiLogOut, FiUsers, FiSend, FiSmile,
  FiX, FiClock
} from 'react-icons/fi';
import { BsHandIndex } from 'react-icons/bs';
import { useAppStore } from '../../store/appStore';
import { toPersianNum, toShamsi, getPersianWeekDay, getPersianTime } from '../../utils/persian';
import CircularTimer from '../CircularTimer';
import {
  onWebRTCOffer, emitWebRTCAnswer, emitWebRTCIce, onWebRTCIce, emitWebRTCRequest,
  emitStudentOffer, emitStudentIce, onStudentAnswer, onStudentIce
} from '../../services/socketManager';



export default function StudentPanel() {
  const {
    currentUser, currentUserId, currentClassName, logout, activeClassId,
    classes, chatMessages, sendMessage,
    isClassLive,
    requestSpeak, addAlert
  } = useAppStore();

  const [now, setNow] = useState(new Date());
  const [classTime, setClassTime] = useState(0);
  const [chatInput, setChatInput] = useState('');
  const [micOn, setMicOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [micVolume, setMicVolume] = useState(80);
  const [speakerVolume, setSpeakerVolume] = useState(80);
  const [micLevel, setMicLevel] = useState(0);
  const liveMicStreamRef = useRef<MediaStream | null>(null);
  const liveMicRafRef = useRef<number>(0);
  const teacherVideoRef = useRef<HTMLVideoElement>(null);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [cameraSize, setCameraSize] = useState(120);
  const [cameraPosX, setCameraPosX] = useState<number | null>(null); // null = use default right:20
  const [cameraPosY, setCameraPosY] = useState(20);
  const [dragging, setDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const chatEndRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const studentCamRef = useRef<HTMLVideoElement>(null);
  const studentStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const [teacherRemoteStream, setTeacherRemoteStream] = useState<MediaStream | null>(null);

  // Start camera AND send to teacher via WebRTC — combined to avoid timing issues
  useEffect(() => {
    if (!activeClassId || !currentUserId) return;
    let sendPC: RTCPeerConnection | null = null;

    const prefCam = localStorage.getItem('pref_camera');
    const baseConstraints: MediaStreamConstraints = {
      video: prefCam ? { deviceId: { exact: prefCam } } : true,
      audio: false,
    };

    console.log('[Student WebRTC] starting — classId:', activeClassId, 'userId:', currentUserId);

    navigator.mediaDevices.getUserMedia(baseConstraints)
      .catch((e) => { console.warn('[Student cam] exact failed, fallback', e); return navigator.mediaDevices.getUserMedia({ video: true, audio: false }); })
      .then(async (stream) => {
        console.log('[Student cam] stream ready, tracks:', stream.getTracks().length);
        // Show local preview
        studentStreamRef.current = stream;
        if (studentCamRef.current) studentCamRef.current.srcObject = stream;
        setCameraOn(true);

        // Send stream to teacher
        sendPC = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

        sendPC.onicecandidate = e => {
          if (e.candidate) emitStudentIce(activeClassId, e.candidate.toJSON(), currentUserId!);
        };
        sendPC.onconnectionstatechange = () => console.log('[Student→Teacher PC]', sendPC?.connectionState);

        onStudentAnswer(({ answer, studentId }) => {
          console.log('[Student] received answer from teacher, studentId:', studentId, 'mine:', currentUserId);
          if (studentId === currentUserId) sendPC?.setRemoteDescription(new RTCSessionDescription(answer)).catch(e => console.error('[Student] setRemoteDesc error', e));
        });

        onStudentIce(({ candidate, studentId }) => {
          if (studentId === currentUserId) sendPC?.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
        });

        stream.getTracks().forEach(t => sendPC!.addTrack(t, stream));
        const offer = await sendPC.createOffer();
        await sendPC.setLocalDescription(offer);
        console.log('[Student] sending offer to teacher');
        emitStudentOffer(activeClassId, offer, currentUserId!);
      }).catch(e => console.error('[Student cam] FAILED', e));

    return () => {
      studentStreamRef.current?.getTracks().forEach(t => t.stop());
      sendPC?.close();
    };
  }, [activeClassId, currentUserId]);

  // WebRTC: receive teacher stream
  useEffect(() => {
    if (!activeClassId) return;

    const createInboundPC = () => {
      peerRef.current?.close();
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      peerRef.current = pc;

      pc.ontrack = (e) => {
        console.log('[Student] ontrack fired, streams:', e.streams.length);
        if (e.streams[0]) setTeacherRemoteStream(e.streams[0]);
      };
      pc.onicecandidate = (e) => {
        if (e.candidate) emitWebRTCIce(activeClassId, e.candidate.toJSON(), 'student');
      };
      return pc;
    };

    let pc = createInboundPC();

    onWebRTCOffer(async ({ offer }) => {
      console.log('[Student] received offer, signalingState:', peerRef.current?.signalingState);
      // If PC is not in a state to accept a new offer, recreate it
      if (peerRef.current && peerRef.current.signalingState !== 'stable' && peerRef.current.signalingState !== 'have-remote-offer') {
        pc = createInboundPC();
      }
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        emitWebRTCAnswer(activeClassId, answer);
        console.log('[Student] answer sent');
      } catch(err) { console.error('[Student] offer handling error', err); }
    });

    onWebRTCIce(({ candidate, role }) => {
      if (role === 'teacher') peerRef.current?.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    });

    console.log('[Student] emitting webrtc:request, classId:', activeClassId);
    emitWebRTCRequest(activeClassId);

    return () => { peerRef.current?.close(); peerRef.current = null; };
  }, [activeClassId]);

  // Retry WebRTC request every 5s until stream is received
  useEffect(() => {
    if (teacherRemoteStream || !activeClassId) return;
    const retry = setInterval(() => {
      if (!teacherRemoteStream && activeClassId) emitWebRTCRequest(activeClassId);
    }, 5000);
    return () => clearInterval(retry);
  }, [teacherRemoteStream, activeClassId]);

  // Log leave on panel unmount (attendanceId set by PreClass via student-join)
  useEffect(() => {
    if (!activeClassId) return;
    const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3002';
    const token = useAppStore.getState().authToken;
    const attendanceId = useAppStore.getState().currentAttendanceId;

    return () => {
      // Stop camera/mic tracks on unmount (باگ ۱۰)
      studentStreamRef.current?.getTracks().forEach(t => t.stop());
      peerRef.current?.close();

      if (!attendanceId) return;
      fetch(`${API_URL}/api/classes/${activeClassId}/sessions/student-leave/${attendanceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      }).catch(() => {});
    };
  }, [activeClassId]);

  const cls = classes.find(c => c.id === activeClassId);

  useEffect(() => {
    const t = setInterval(() => {
      setNow(new Date());
      if (isClassLive) setClassTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [isClassLive]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Mic stream + level meter
  useEffect(() => {
    const prefMic = localStorage.getItem('pref_mic');
    navigator.mediaDevices.getUserMedia({
      audio: prefMic ? { deviceId: { ideal: prefMic } } : true,
      video: false,
    }).then(stream => {
      liveMicStreamRef.current = stream;
      stream.getAudioTracks().forEach(t => { t.enabled = micOn; });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((s, v) => s + v, 0) / data.length;
        setMicLevel(Math.min(100, Math.round(avg * 2.5)));
        liveMicRafRef.current = requestAnimationFrame(tick);
      };
      tick();
    }).catch(() => {});
    return () => {
      liveMicStreamRef.current?.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(liveMicRafRef.current);
    };
  }, []);

  // Attach teacher stream to video element
  useEffect(() => {
    const el = teacherVideoRef.current;
    if (el && teacherRemoteStream) {
      el.srcObject = teacherRemoteStream;
      el.volume = speakerOn ? speakerVolume / 100 : 0;
      el.play().catch(() => {});
    }
  }, [teacherRemoteStream]);

  // Apply speaker volume whenever slider or toggle changes
  useEffect(() => {
    if (teacherVideoRef.current) {
      teacherVideoRef.current.volume = speakerOn ? speakerVolume / 100 : 0;
    }
  }, [speakerVolume, speakerOn]);

  const handleMicToggle = () => {
    const next = !micOn;
    setMicOn(next);
    liveMicStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = next; });
  };

  const handleMicVolume = (v: number) => {
    setMicVolume(v);
    if (v === 0) liveMicStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = false; });
    else if (micOn) liveMicStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = true; });
  };

  const handleSpeakerToggle = () => {
    const next = !speakerOn;
    setSpeakerOn(next);
    if (teacherVideoRef.current) teacherVideoRef.current.volume = next ? speakerVolume / 100 : 0;
  };

  const handleSpeakerVolume = (v: number) => {
    setSpeakerVolume(v);
    if (teacherVideoRef.current && speakerOn) teacherVideoRef.current.volume = v / 100;
  };

  const handleCameraToggle = () => {
    const next = !cameraOn;
    setCameraOn(next);
    studentStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = next; });
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    sendMessage({ sender: currentUser || 'دانش‌آموز', senderRole: 'student', message: chatInput, type: 'text' });
    setChatInput('');
  };

  const handleRaiseHand = () => {
    if (!handRaised) {
      requestSpeak(currentUser || '', currentUser || 'دانش‌آموز');
      addAlert({ type: 'info', title: 'درخواست صحبت', message: 'درخواست شما ارسال شد', duration: 3000 });
    }
    setHandRaised(!handRaised);
  };

  // Drag handler for floating camera
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const stream = streamRef.current;
    if (!stream) return;

    const camEl = e.currentTarget as HTMLElement;
    const camRect = camEl.getBoundingClientRect();
    const containerRect = stream.getBoundingClientRect();

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    // Use right-based positioning (RTL friendly)
    // rightOffset = distance from right edge of container to right edge of element
    const initRight = containerRect.right - camRect.right;
    const initTop = camRect.top - containerRect.top;

    setCameraPosX(initRight);
    setCameraPosY(initTop);

    // Offset from mouse to right edge of element
    dragOffsetRef.current = {
      x: containerRect.right - clientX - (containerRect.right - camRect.right),
      y: clientY - camRect.top,
    };

    setDragging(true);

    const handleMove = (ev: MouseEvent | TouchEvent) => {
      const cx = 'touches' in ev ? ev.touches[0].clientX : (ev as MouseEvent).clientX;
      const cy = 'touches' in ev ? ev.touches[0].clientY : (ev as MouseEvent).clientY;
      // right = distance from container's right to cursor, adjusted by offset
      const newRight = containerRect.right - cx - dragOffsetRef.current.x;
      const newTop = cy - containerRect.top - dragOffsetRef.current.y;
      setCameraPosX(Math.max(0, Math.min(containerRect.width - cameraSize, newRight)));
      setCameraPosY(Math.max(0, Math.min(containerRect.height - cameraSize * 0.75, newTop)));
    };
    const handleEnd = () => {
      setDragging(false);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove);
    document.addEventListener('touchend', handleEnd);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* ═══ BAR 1: Top Header ═══ */}
      <div className="glass border-b border-white/10 px-3 py-1.5 flex-shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <FiUsers size={16} className="text-white" />
            </div>
            <div className="leading-tight">
              <h1 className="text-white font-bold text-xs">سامانه کلاس‌های آموزشی سبز</h1>
              <p className="text-white/25 text-[8px]">G-Online-Edu-App</p>
              <p className="text-white/15 text-[8px]">نسخه {toPersianNum('2585/0/00')}</p>
            </div>
          </div>

          <div className="glass-dark rounded-xl px-3 py-1.5 text-center">
            <div className="flex items-center gap-3 text-xs">
              {isClassLive && (
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-red-400 font-bold text-[10px]">زنده</span>
                </div>
              )}
              {isClassLive && <CircularTimer seconds={classTime} total={3600} size={28} color="#10b981" />}
              <div className="text-white/60 text-[10px]">{currentClassName}</div>
              <div className="text-emerald-400 text-[10px]">{currentUser}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-left text-[10px]">
              <p className="text-white/50">{toShamsi(now)}</p>
              <p className="text-white/30">{getPersianWeekDay(now)} • {getPersianTime(now)}</p>
            </div>
            <button onClick={logout} className="glass-btn rounded-lg p-2 text-red-400"><FiLogOut size={14} /></button>
          </div>
        </div>
      </div>

      {/* ═══ BAR 2: Sub Header ═══ */}
      <div className="glass-dark border-b border-white/5 px-3 py-1 flex items-center justify-between flex-shrink-0">
        <div className="text-white/40 text-[10px]">
          {cls && <>درس: {cls.courseName} • معلم: {cls.teacherName}</>}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-white/30">
          <FiClock size={10} />
          {cls && <>{cls.startTime} - {cls.endTime}</>}
        </div>
      </div>

      {/* ═══ Main Stream View ═══ */}
      <div className="flex-1 relative overflow-hidden" ref={streamRef}>
        {/* Teacher stream area — single canvas stream */}
        <div className="relative h-full bg-black overflow-hidden">
          {teacherRemoteStream ? (
            <video ref={teacherVideoRef} autoPlay playsInline
              className="absolute inset-0 w-full h-full object-contain" />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-4 select-none">
              <FiMonitor size={56} className="text-white/10 mx-auto" />
              <p className="text-white/30 text-sm">در حال اتصال به کلاس...</p>
            </div>
          )}
        </div>

        {/* Floating student camera (draggable) */}
        <div
          className="absolute rounded-xl overflow-hidden border-2 border-emerald-400/40 shadow-2xl cursor-move z-10"
          style={{
            right: `${cameraPosX ?? 20}px`,
            top: `${cameraPosY}px`,
            width: `${cameraSize}px`,
            height: `${cameraSize * 0.75}px`,
            opacity: dragging ? 0.7 : 1,
            display: cameraOn ? 'block' : 'none',
          }}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          <video ref={studentCamRef} autoPlay muted playsInline
            className="w-full h-full object-cover" />
          <div className="absolute bottom-0 inset-x-0 bg-black/50 px-1.5 py-0.5">
            <p className="text-white text-[8px] text-center truncate">{currentUser}</p>
          </div>
          {/* mic indicator */}
          {micOn && (
            <div className="absolute top-1 left-1 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
              <FiMic size={8} className="text-white" />
            </div>
          )}
        </div>
      </div>

      {/* ═══ BAR 7: Footer Toolbar ═══ */}
      <div className="glass border-t border-white/10 px-3 py-1.5 flex-shrink-0">
        <div className="flex items-center justify-between">
          {/* Right: Audio/Video controls */}
          <div className="flex items-center gap-3">

            {/* ── Mic ── */}
            <div className="flex items-center gap-1.5">
              <button onClick={handleMicToggle}
                className={`glass-btn rounded-lg p-2 flex-shrink-0 ${micOn ? 'text-emerald-400' : 'text-red-400 bg-red-500/10'}`}>
                {micOn ? <FiMic size={15} /> : <FiMicOff size={15} />}
              </button>
              <div className="flex flex-col gap-0.5 w-20">
                <div className="flex gap-px h-2 items-end">
                  {Array.from({ length: 16 }).map((_, i) => {
                    const threshold = (i + 1) * 6.25;
                    const active = micOn && micLevel >= threshold;
                    const color = i < 10 ? 'bg-emerald-400' : i < 13 ? 'bg-amber-400' : 'bg-red-400';
                    return <div key={i} className={`flex-1 rounded-sm transition-all duration-75 ${active ? color : 'bg-white/10'}`} style={{ height: `${50 + i * 3}%` }} />;
                  })}
                </div>
                <input type="range" min={0} max={100} value={micVolume}
                  onChange={e => handleMicVolume(+e.target.value)}
                  disabled={!micOn}
                  className="w-full h-1 rounded-full accent-emerald-400 cursor-pointer disabled:opacity-30" />
              </div>
              <span className="text-[9px] text-white/30 w-5 text-left">{toPersianNum(micVolume)}٪</span>
            </div>

            <div className="w-px h-6 bg-white/10" />

            {/* ── Speaker ── */}
            <div className="flex items-center gap-1.5">
              <button onClick={handleSpeakerToggle}
                className={`glass-btn rounded-lg p-2 flex-shrink-0 ${speakerOn ? 'text-cyan-400' : 'text-red-400 bg-red-500/10'}`}>
                {speakerOn ? <FiVolume2 size={15} /> : <FiVolumeX size={15} />}
              </button>
              <input type="range" min={0} max={100} value={speakerVolume}
                onChange={e => handleSpeakerVolume(+e.target.value)}
                disabled={!speakerOn}
                className="w-20 h-1 rounded-full accent-cyan-400 cursor-pointer disabled:opacity-30" />
              <span className="text-[9px] text-white/30 w-5 text-left">{toPersianNum(speakerVolume)}٪</span>
            </div>

            <div className="w-px h-6 bg-white/10" />

            {/* ── Camera ── */}
            <button onClick={handleCameraToggle}
              className={`glass-btn rounded-lg p-2 ${cameraOn ? 'text-white' : 'text-red-400 bg-red-500/10'}`}>
              {cameraOn ? <FiCamera size={15} /> : <FiCameraOff size={15} />}
            </button>

          </div>

          {/* Center: Tools */}
          <div className="flex items-center gap-1.5">
            <button onClick={handleRaiseHand}
              className={`glass-btn rounded-lg px-3 py-1.5 text-xs flex items-center gap-1 ${handRaised ? 'text-amber-400 bg-amber-500/10' : 'text-white/50'}`}>
              <BsHandIndex size={14} /> {handRaised ? 'دست بالا ✋' : 'درخواست صحبت'}
            </button>
            <button onClick={() => setShowChatPanel(!showChatPanel)}
              className={`glass-btn rounded-lg px-3 py-1.5 text-xs flex items-center gap-1 ${showChatPanel ? 'text-indigo-400' : 'text-white/50'}`}>
              <FiMessageSquare size={14} /> چت
            </button>
            {/* Camera size */}
            <div className="flex items-center gap-1">
              <span className="text-white/30 text-[10px]">سایز:</span>
              <input type="range" min="60" max="240" value={cameraSize} onChange={e => setCameraSize(parseInt(e.target.value))}
                className="w-16 h-1 appearance-none bg-white/10 rounded-full" />
            </div>
          </div>

          {/* Left: Settings */}
          <div className="flex items-center gap-1.5">
            <button className="glass-btn rounded-lg p-2 text-white/60"><FiSettings size={16} /></button>
          </div>
        </div>
      </div>

      {/* Chat Overlay Panel */}
      {showChatPanel && (
        <div className="absolute bottom-16 right-2 left-2 md:right-auto md:left-4 md:w-80 z-50 glass-alert rounded-2xl overflow-hidden animate-slide-up" style={{ maxHeight: '60vh' }}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
            <h3 className="text-white/60 text-xs font-semibold flex items-center gap-1">
              <FiMessageSquare size={12} className="text-indigo-400" /> چت کلاس
            </h3>
            <button onClick={() => setShowChatPanel(false)} className="text-white/40"><FiX size={14} /></button>
          </div>
          <div className="overflow-y-auto p-2 space-y-1.5" style={{ maxHeight: 'calc(60vh - 80px)' }}>
            {chatMessages.map(msg => (
              <div key={msg.id} className={`rounded-lg p-2 ${
                msg.type === 'system' ? 'bg-indigo-500/10 text-center' :
                msg.senderRole === 'teacher' ? 'bg-cyan-500/10 mr-4' :
                msg.sender === currentUser ? 'bg-emerald-500/10 ml-4' : 'bg-white/5 ml-4'
              }`}>
                {msg.type !== 'system' && (
                  <p className="text-white/40 text-[8px] mb-0.5">
                    {msg.sender} • {msg.timestamp}
                  </p>
                )}
                <p className={`text-xs ${msg.type === 'system' ? 'text-indigo-300/60' : 'text-white/80'}`}>
                  {msg.message}
                </p>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="p-2 border-t border-white/5">
            <div className="flex gap-1">
              <button className="glass-btn rounded-lg p-1.5 text-white/30"><FiSmile size={14} /></button>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                className="glass-input flex-1 rounded-lg px-2 py-1.5 text-xs" placeholder="پیام..." />
              <button onClick={handleSendMessage}
                className="bg-indigo-500 text-white rounded-lg p-1.5"><FiSend size={14} /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
