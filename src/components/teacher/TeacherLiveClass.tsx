import { useState, useEffect, useRef } from 'react';
import {
  FiMic, FiMicOff, FiCamera, FiCameraOff, FiVolume2, FiVolumeX,
  FiSettings, FiMessageSquare, FiGrid, FiMonitor,
  FiLogOut, FiSquare, FiUsers, FiMinus,
  FiChevronLeft, FiChevronRight, FiRefreshCw, FiSend,
  FiSmile, FiYoutube, FiImage, FiFile, FiMusic, FiUserPlus,
  FiX, FiDownload, FiCheck, FiClock, FiAlertTriangle,
  FiTrash2, FiPlay, FiPause, FiLayers, FiEdit2, FiSkipBack, FiRepeat, FiVideo
} from 'react-icons/fi';
import { BsHandIndex, BsRecordCircle } from 'react-icons/bs';
import { useAppStore } from '../../store/appStore';
import { toPersianNum, toShamsi, getPersianWeekDay, getPersianTime } from '../../utils/persian';
import type { ClassSession } from '../../store/types';
import CircularTimer from '../CircularTimer';
import { getStreamQualityPreset, STREAM_QUALITY_PRESETS } from '../admin/AdminSettings';
import type { StreamQualityKey } from '../admin/AdminSettings';
import {
  emitStreamLayout, emitWebRTCOffer, emitWebRTCIce, onWebRTCAnswer, onWebRTCIce, onWebRTCRequest,
  onStudentOffer, emitStudentAnswer, emitStudentIce, onStudentIce
} from '../../services/socketManager';

interface Props {
  classData: ClassSession;
}

function StudentCamVideo({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />;
}

// Live camera video — receives the already-started stream so no extra getUserMedia
function LiveCamVideo({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <video ref={ref} autoPlay muted playsInline
      className="absolute inset-0 w-full h-full object-cover" />
  );
}

// helper: parse "HH:MM" → seconds from midnight
function timeToSec(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 3600 + (m || 0) * 60;
}
function tehranNowSec(): number {
  const s = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const [h, m, sec] = s.split(':').map(Number);
  return h * 3600 + m * 60 + sec;
}
function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
  return m ? m[1] : null;
}

export default function TeacherLiveClass({ classData }: Props) {
  const {
    currentUser, endClass,
    currentSessionId, sessionStartMs, authToken,
    students, chatMessages, sendMessage,
    speakRequests, approveSpeakRequest, rejectSpeakRequest, clearAllSpeakRequests,
    mediaItems, addMediaItem, removeMediaItem,
    streamLayout, addToStream, removeFromStream, setGridSize,
    showChat, showSpeakPanel, toggleChat, toggleSpeakPanel,
    isRecording, addAlert, kickStudent
  } = useAppStore();

  const [now, setNow] = useState(new Date());
  const [classTime, setClassTime] = useState(0);
  const [remainingSec, setRemainingSec] = useState<number>(9999);
  const [chatInput, setChatInput] = useState('');
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [streamQualityKey, setStreamQualityKey] = useState<string>(
    localStorage.getItem('stream_quality') || 'sdplus'
  );
  const [micVolume, setMicVolume] = useState(80);
  const [speakerVolume, setSpeakerVolume] = useState(80);
  const [micLevel, setMicLevel] = useState(0);
  const liveMicStreamRef = useRef<MediaStream | null>(null);
  const liveMicAnalyserRef = useRef<AnalyserNode | null>(null);
  const liveMicRafRef = useRef<number>(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [kickReason, setKickReason] = useState('');
  const [kickingStudent, setKickingStudent] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [rotateInterval, setRotateInterval] = useState(5);
  const [showWarning, setShowWarning] = useState(false);
  const [showFinalCountdown, setShowFinalCountdown] = useState(false);
  const [showMediaManager, setShowMediaManager] = useState(false);
  const [mmYoutubeUrl, setMmYoutubeUrl] = useState('');
  const [mmShowYoutube, setMmShowYoutube] = useState(false);
  const [mmPreviewItem, setMmPreviewItem] = useState<any>(null);
  const [mmEditingId, setMmEditingId] = useState<string | null>(null);
  const [mmEditingName, setMmEditingName] = useState('');
  const [mmObjectUrls, setMmObjectUrls] = useState<Record<string, string>>({});
  const mmVideoRef = useRef<HTMLInputElement>(null);
  const mmAudioRef = useRef<HTMLInputElement>(null);
  const mmImageRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const warningAlerted = useRef(false);
  const teacherTileVideoRef = useRef<HTMLVideoElement>(null);
  const teacherTileStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null); // kept for compat, not used for outbound
  const outboundPeersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const studentPeersRef = useRef<Record<string, RTCPeerConnection>>({});
  const [studentStreams, setStudentStreams] = useState<Record<string, MediaStream>>({});

  // Canvas capture refs
  const offscreenCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasStreamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  // Refs to read latest state inside RAF without recreating the loop
  const activeItemsRef = useRef(streamLayout.activeItems);
  const mediaItemsRef = useRef(mediaItems);
  const classDataRef = useRef(classData);
  // Hidden media elements for canvas drawing
  const mediaVideoMap = useRef(new Map<string, HTMLVideoElement>());
  const mediaAudioMap = useRef(new Map<string, HTMLAudioElement>());
  const mediaImgMap = useRef(new Map<string, HTMLImageElement>());
  // Playback state per media id
  const [playState, setPlayState] = useState<Record<string, { playing: boolean; currentTime: number; duration: number }>>({});
  // Refs to the visible tile video elements (for controls)
  const tileVideoRefs = useRef(new Map<string, HTMLVideoElement>());
  const [loopIds, setLoopIds] = useState<Set<string>>(new Set());
  const ytImgMap = useRef(new Map<string, HTMLImageElement>());

  // Keep refs in sync with state (used inside RAF render loop)
  useEffect(() => { activeItemsRef.current = streamLayout.activeItems; }, [streamLayout.activeItems]);
  useEffect(() => { mediaItemsRef.current = mediaItems; }, [mediaItems]);
  useEffect(() => { classDataRef.current = classData; }, [classData]);

  // Canvas stream setup — called once after mount
  useEffect(() => {
    const canvas = offscreenCanvasRef.current;
    if (!canvas) { console.warn('[Canvas] ref is null!'); return; }
    const preset = getStreamQualityPreset();
    canvas.width = preset.width;
    canvas.height = preset.height;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canvasStreamRef.current = (canvas as any).captureStream(preset.fps) as MediaStream;
    console.log(`[Canvas] quality: ${preset.label} — ${preset.width}×${preset.height}@${preset.fps}fps`);
  }, []);

  // Manage hidden media elements for active tiles
  useEffect(() => {
    const items = streamLayout.activeItems;

    items.forEach(id => {
      if (id === 'teacher-cam') return; // handled via teacherTileVideoRef directly

      if (id.startsWith('student-')) {
        const studentId = id.replace('student-', '');
        const stream = studentStreams[studentId];
        if (stream && !mediaVideoMap.current.has(id)) {
          const v = document.createElement('video');
          v.srcObject = stream;
          v.autoplay = true; v.playsInline = true; v.muted = true;
          v.play().catch(() => {});
          mediaVideoMap.current.set(id, v);
        }
        return;
      }

      const m = mediaItems.find(mi => mi.id === id);
      if (!m) return;

      if ((m.type === 'video' || m.type === 'camera') && m.url && !mediaVideoMap.current.has(id)) {
        const v = document.createElement('video');
        v.src = m.url; v.autoplay = true; v.loop = true; v.muted = true; v.playsInline = true;
        v.crossOrigin = 'anonymous';
        v.play().catch(() => {});
        mediaVideoMap.current.set(id, v);
      }

      if (m.type === 'slideshow' && m.url && !mediaImgMap.current.has(id)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = m.url;
        mediaImgMap.current.set(id, img);
      }

      if (m.type === 'youtube' && m.url && !ytImgMap.current.has(id)) {
        const match = m.url.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
        if (match) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
          ytImgMap.current.set(id, img);
        }
      }

    });

    // Clean up elements for removed tiles
    [...mediaVideoMap.current.keys()].forEach(id => {
      if (!items.includes(id)) {
        mediaVideoMap.current.get(id)!.pause();
        mediaVideoMap.current.delete(id);
      }
    });
    [...mediaAudioMap.current.keys()].forEach(id => {
      if (!items.includes(id)) {
        const a = mediaAudioMap.current.get(id)!;
        a.pause();
        if (a.parentNode) a.parentNode.removeChild(a);
        mediaAudioMap.current.delete(id);
      }
    });
    [...mediaImgMap.current.keys()].forEach(id => { if (!items.includes(id)) mediaImgMap.current.delete(id); });
    [...ytImgMap.current.keys()].forEach(id => { if (!items.includes(id)) ytImgMap.current.delete(id); });
  }, [streamLayout.activeItems, mediaItems, studentStreams]);

  // RAF render loop — composites all active tiles onto the offscreen canvas
  useEffect(() => {
    const canvas = offscreenCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false })!;
    let lastFrameTime = 0;

    const drawContain = (
      src: HTMLVideoElement | HTMLImageElement,
      x: number, y: number, w: number, h: number
    ) => {
      const sw = src instanceof HTMLVideoElement ? src.videoWidth : src.naturalWidth;
      const sh = src instanceof HTMLVideoElement ? src.videoHeight : src.naturalHeight;
      if (!sw || !sh) return;
      const scale = Math.min(w / sw, h / sh);
      const dw = sw * scale, dh = sh * scale;
      ctx.fillStyle = '#000';
      ctx.fillRect(x, y, w, h);
      try { ctx.drawImage(src as CanvasImageSource, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); } catch { /**/ }
    };

    const render = (now: number) => {
      rafRef.current = requestAnimationFrame(render);
      const W = canvas.width, H = canvas.height;
      const qKey = localStorage.getItem('stream_quality') || 'sdplus';
      const qPreset = STREAM_QUALITY_PRESETS.find(p => p.key === qKey) ?? STREAM_QUALITY_PRESETS[1];
      const FRAME_MS = 1000 / qPreset.fps;
      if (now - lastFrameTime < FRAME_MS) return;
      lastFrameTime = now;
      try {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, W, H);

      const items = activeItemsRef.current;

      if (items.length === 0) {
        // Welcome/standby screen — matches TeacherLiveClass UI exactly
        const now = new Date();
        ctx.textAlign = 'center';

        // Subtle overlay
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(0, 0, W, H);

        const cx = W / 2, cy = H / 2;

        // Persian clock (large, bold)
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = 'bold 108px Vazirmatn, Tahoma, sans-serif';
        ctx.fillText(getPersianTime(now), cx, cy - 60);

        // Persian date
        ctx.font = '38px Vazirmatn, Tahoma, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText(`${toShamsi(now)} • ${getPersianWeekDay(now)}`, cx, cy + 10);

        // Monitor icon (simple rect shape similar to FiMonitor)
        const iconSize = 52, iconX = cx - iconSize / 2, iconY = cy + 40;
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.rect(iconX, iconY, iconSize, iconSize * 0.7);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 10, iconY + iconSize * 0.7 + 6);
        ctx.lineTo(cx + 10, iconY + iconSize * 0.7 + 6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, iconY + iconSize * 0.7);
        ctx.lineTo(cx, iconY + iconSize * 0.7 + 6);
        ctx.stroke();

        // Class name
        ctx.font = 'bold 30px Vazirmatn, Tahoma, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText(`به کلاس ${classDataRef.current.name || ''} خوش آمدید`, cx, cy + 145);

        // Teacher / course
        ctx.font = '22px Vazirmatn, Tahoma, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillText(`معلم کلاس: ${classDataRef.current.teacherName || ''}  |  درس: ${classDataRef.current.courseName || ''}`, cx, cy + 185);
      } else {
        const count = items.length;
        const cols = count === 1 ? 1 : count <= 4 ? 2 : 3;
        const rows = Math.ceil(count / cols);
        const cellW = Math.floor(W / cols);
        const cellH = Math.floor(H / rows);
        const gap = 2;

        items.forEach((id, idx) => {
          const col = idx % cols;
          const row = Math.floor(idx / cols);
          const x = col * cellW + gap, y = row * cellH + gap;
          const w = cellW - gap * 2, h = cellH - gap * 2;

          ctx.fillStyle = '#1e293b';
          ctx.fillRect(x, y, w, h);

          if (id === 'teacher-cam') {
            const v = teacherTileVideoRef.current;
            if (v && v.readyState >= 2) drawContain(v, x, y, w, h);
          } else {
            const v = mediaVideoMap.current.get(id);
            const img = mediaImgMap.current.get(id) || ytImgMap.current.get(id);
            if (v && v.readyState >= 2) drawContain(v, x, y, w, h);
            else if (img && img.complete && img.naturalWidth > 0) drawContain(img, x, y, w, h);
          }

          // Label bar
          const mi = mediaItemsRef.current.find(m => m.id === id);
          const label = id === 'teacher-cam'
            ? (classDataRef.current.teacherName || 'معلم')
            : id.startsWith('student-')
              ? 'دانش‌آموز'
              : (mi?.name || id);
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.fillRect(x, y + h - 22, w, 22);
          ctx.fillStyle = 'rgba(255,255,255,0.75)';
          ctx.font = '13px sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(label, x + 8, y + h - 6);
        });
      }
      } catch (e) { console.error('[Canvas render]', e); }
    };

    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, []); // empty — reads everything via refs

  // Start camera preview in tile bar
  useEffect(() => {
    const prefCam = localStorage.getItem('pref_camera');
    const constraints: MediaStreamConstraints = {
      video: prefCam ? { deviceId: { ideal: prefCam } } : true,
      audio: false,
    };
    navigator.mediaDevices.getUserMedia(constraints).then(stream => {
      teacherTileStreamRef.current = stream;
      if (teacherTileVideoRef.current) {
        teacherTileVideoRef.current.srcObject = stream;
      }
    }).catch(() => {});
    return () => {
      teacherTileStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Live mic stream + level meter
  useEffect(() => {
    const prefMic = localStorage.getItem('pref_mic');
    navigator.mediaDevices.getUserMedia({
      audio: prefMic ? { deviceId: { ideal: prefMic } } : true,
      video: false,
    }).then(stream => {
      liveMicStreamRef.current = stream;
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      liveMicAnalyserRef.current = analyser;
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


  // Poll playback state — tile videos first, then hidden audio
  useEffect(() => {
    const t = setInterval(() => {
      const next: Record<string, { playing: boolean; currentTime: number; duration: number }> = {};
      tileVideoRefs.current.forEach((el, id) => {
        next[id] = { playing: !el.paused, currentTime: el.currentTime, duration: el.duration || 0 };
      });
      mediaAudioMap.current.forEach((el, id) => {
        next[id] = { playing: !el.paused, currentTime: el.currentTime, duration: el.duration || 0 };
      });
      setPlayState(next);
    }, 250);
    return () => clearInterval(t);
  }, []);

  const fmtTime = (s: number) => {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const getMediaEl = (id: string): HTMLVideoElement | HTMLAudioElement | null =>
    tileVideoRefs.current.get(id) || mediaAudioMap.current.get(id) || null;

  const togglePlay = (id: string) => {
    const el = getMediaEl(id);
    if (!el) return;
    el.paused ? el.play().catch(() => {}) : el.pause();
  };

  const seekTo = (id: string, time: number) => {
    const el = getMediaEl(id);
    if (el) el.currentTime = time;
  };

  const restartMedia = (id: string) => {
    const el = getMediaEl(id);
    if (el) { el.currentTime = 0; el.play().catch(() => {}); }
  };

  const toggleLoop = (id: string) => {
    setLoopIds(prev => {
      const next = new Set(prev);
      const isLoop = next.has(id);
      isLoop ? next.delete(id) : next.add(id);
      const el = getMediaEl(id);
      if (el) el.loop = !isLoop;
      return next;
    });
  };

  // WebRTC: broadcast teacher canvas stream to each student via dedicated PC
  useEffect(() => {
    if (!classData.id) return;

    const makeOfferForStudent = async (studentSocketId: string) => {
      // Close any existing outbound PC for this student
      const existing = outboundPeersRef.current.get(studentSocketId);
      if (existing) { existing.close(); outboundPeersRef.current.delete(studentSocketId); }

      const stream = canvasStreamRef.current;
      if (!stream || stream.getTracks().length === 0) {
        setTimeout(() => makeOfferForStudent(studentSocketId), 200);
        return;
      }

      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      outboundPeersRef.current.set(studentSocketId, pc);

      pc.onicecandidate = e => {
        if (e.candidate) emitWebRTCIce(classData.id, e.candidate.toJSON(), 'teacher', studentSocketId);
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          outboundPeersRef.current.delete(studentSocketId);
        }
      };

      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Apply bitrate cap from quality preset
      const qPreset = getStreamQualityPreset();
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        const params = sender.getParameters();
        if (!params.encodings) params.encodings = [{}];
        params.encodings[0].maxBitrate = qPreset.bitrate * 1000;
        await sender.setParameters(params).catch(() => {});
      }

      console.log('[Teacher] sending offer to student:', studentSocketId);
      emitWebRTCOffer(classData.id, offer, studentSocketId);

      // Send current layout so student sees current tiles immediately
      emitStreamLayout(classData.id, {
        activeItems: useAppStore.getState().streamLayout.activeItems,
        mediaItems: useAppStore.getState().mediaItems.map(m => ({ id: m.id, type: m.type, name: m.name, url: m.url })),
      });
    };

    onWebRTCRequest(({ studentSocketId }) => {
      console.log('[Teacher] webrtc:request from student socket:', studentSocketId);
      makeOfferForStudent(studentSocketId);
    });

    onWebRTCAnswer(({ answer, studentSocketId }) => {
      const pc = outboundPeersRef.current.get(studentSocketId);
      if (!pc) { console.warn('[Teacher] no PC for student', studentSocketId); return; }
      pc.setRemoteDescription(new RTCSessionDescription(answer))
        .then(() => console.log('[Teacher] remote desc set for', studentSocketId))
        .catch(e => console.error('[Teacher] setRemoteDesc error for', studentSocketId, e));
    });

    onWebRTCIce(({ candidate, role, studentSocketId }) => {
      if (role === 'student' && studentSocketId) {
        outboundPeersRef.current.get(studentSocketId)
          ?.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      }
    });

    return () => {
      outboundPeersRef.current.forEach(pc => pc.close());
      outboundPeersRef.current.clear();
    };
  }, [classData.id]);

  // WebRTC: receive student cameras
  useEffect(() => {
    if (!classData.id) return;

    onStudentOffer(async ({ offer, studentId }) => {
      // Close any existing PC for this student before creating a new one
      if (studentPeersRef.current[studentId]) {
        studentPeersRef.current[studentId].close();
        delete studentPeersRef.current[studentId];
      }
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      studentPeersRef.current[studentId] = pc;

      pc.ontrack = e => {
        if (e.streams[0]) {
          setStudentStreams(prev => ({ ...prev, [studentId]: e.streams[0] }));
        }
      };

      pc.onicecandidate = e => {
        if (e.candidate) emitStudentIce(classData.id, e.candidate.toJSON(), studentId);
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      emitStudentAnswer(classData.id, answer, studentId);
    });

    onStudentIce(({ candidate, studentId }) => {
      studentPeersRef.current[studentId]?.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    });

    return () => {
      Object.values(studentPeersRef.current).forEach(pc => pc.close());
      studentPeersRef.current = {};
    };
  }, [classData.id]);

  // Sync stream layout to students whenever activeItems or mediaItems change
  useEffect(() => {
    if (!classData.id) return;
    emitStreamLayout(classData.id, {
      activeItems: streamLayout.activeItems,
      mediaItems: mediaItems.map(m => ({ id: m.id, type: m.type, name: m.name, url: m.url })),
    });
  }, [streamLayout.activeItems, mediaItems, classData.id]);

  const classStudents = students.filter(s => classData.students.includes(s.id));
  const onlineStudents = classStudents.filter(s => s.isOnline);
  const offlineStudents = classStudents.filter(s => !s.isOnline);

  // ── Clock + remaining time based on Tehran endTime ────────────
  useEffect(() => {
    const t = setInterval(() => {
      setNow(new Date());
      setClassTime(prev => prev + 1);

      if (classData.endTime) {
        const endSec = timeToSec(classData.endTime);
        const nowSec = tehranNowSec();
        const diff = endSec - nowSec;
        setRemainingSec(diff);

        if (diff <= 600 && diff > 0 && !warningAlerted.current) {
          warningAlerted.current = true;
          setShowWarning(true);
          addAlert({ type: 'warning', title: '⏰ هشدار زمان', message: 'کمتر از ۱۰ دقیقه تا پایان کلاس باقی مانده', duration: 8000, showTimer: true });
        }
        if (diff <= 10 && diff > 0) setShowFinalCountdown(true);
        if (diff <= 0) handleEndClass();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [classData.endTime]);

  // ── beforeunload: finalize session if browser closes ────────
  useEffect(() => {
    const onUnload = () => {
      if (currentSessionId && sessionStartMs && classData.id) {
        const durationMin = Math.round((Date.now() - sessionStartMs) / 60000);
        const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3002';
        navigator.sendBeacon(
          `${API_URL}/api/classes/${classData.id}/sessions/${currentSessionId}/end`,
          JSON.stringify({ duration: durationMin })
        );
      }
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [currentSessionId, sessionStartMs, classData.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Auto rotate pages
  useEffect(() => {
    if (!autoRotate) return;
    const totalPages = Math.ceil(streamLayout.activeItems.length / streamLayout.gridSize);
    if (totalPages <= 1) return;
    const t = setInterval(() => {
      useAppStore.setState(state => ({
        streamLayout: {
          ...state.streamLayout,
          currentPage: (state.streamLayout.currentPage + 1) % totalPages,
        }
      }));
    }, rotateInterval * 1000);
    return () => clearInterval(t);
  }, [autoRotate, rotateInterval, streamLayout.activeItems.length, streamLayout.gridSize]);

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    sendMessage({ sender: currentUser || 'معلم', senderRole: 'teacher', message: chatInput, type: 'text' });
    setChatInput('');
  };

  const handleEndClass = () => {
    setShowFinalCountdown(false);
    endClass();
    addAlert({ type: 'info', title: 'کلاس پایان یافت', message: 'کلاس با موفقیت به پایان رسید', duration: 5000, showTimer: true });
  };

  const handleKick = (studentId: string) => {
    if (!kickReason.trim()) {
      addAlert({ type: 'error', title: 'خطا', message: 'لطفاً دلیل اخراج را بنویسید', duration: 3000 });
      return;
    }
    kickStudent(studentId, classData.id, kickReason);
    setKickingStudent(null);
    setKickReason('');
    addAlert({ type: 'warning', title: 'اخراج', message: 'دانش‌آموز از کلاس اخراج شد', duration: 3000 });
  };

  const handleMicToggle = () => {
    const next = !micOn;
    setMicOn(next);
    liveMicStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = next; });
  };

  const handleMicVolume = (v: number) => {
    setMicVolume(v);
    liveMicStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = micOn && v > 0; });
  };

  const applyStreamQuality = async (key: string) => {
    const preset = STREAM_QUALITY_PRESETS.find(p => p.key === key);
    if (!preset) return;
    localStorage.setItem('stream_quality', key);
    setStreamQualityKey(key);

    const canvas = offscreenCanvasRef.current;
    if (!canvas) return;

    // Resize canvas (RAF loop reads W/H from canvas at each frame)
    canvas.width = preset.width;
    canvas.height = preset.height;

    // Get new track from captureStream with new fps
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newStream = (canvas as any).captureStream(preset.fps) as MediaStream;
    const newTrack = newStream.getVideoTracks()[0];
    if (!newTrack) return;

    canvasStreamRef.current = newStream;

    // Replace track + update bitrate in all outbound peer connections
    const promises: Promise<void>[] = [];
    outboundPeersRef.current.forEach(pc => {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (!sender) return;
      promises.push(
        sender.replaceTrack(newTrack).then(async () => {
          const params = sender.getParameters();
          if (!params.encodings?.length) params.encodings = [{}];
          params.encodings[0].maxBitrate = preset.bitrate * 1000;
          await sender.setParameters(params).catch(() => {});
        }).catch(() => {})
      );
    });
    await Promise.all(promises);
    addAlert({ type: 'success', title: 'کیفیت تغییر کرد', message: preset.label, duration: 2000 });
  };

  const applyMonitorVolume = (vol: number) => {
    tileVideoRefs.current.forEach(el => { el.volume = vol; });
    mediaAudioMap.current.forEach(el => { el.volume = vol; });
  };

  // Must be called directly inside a click handler (user gesture) so browser allows autoplay
  const startAudioMonitor = (itemId: string) => {
    if (mediaAudioMap.current.has(itemId)) return;
    const m = mediaItems.find(mi => mi.id === itemId);
    if (!m || m.type !== 'audio' || !m.url) return;
    const a = document.createElement('audio');
    a.src = m.url;
    a.loop = true;
    a.volume = speakerOn ? speakerVolume / 100 : 0;
    a.style.cssText = 'display:none;position:absolute;';
    document.body.appendChild(a);
    const prefSpeaker = localStorage.getItem('pref_speaker');
    if (prefSpeaker && (a as any).setSinkId) {
      (a as any).setSinkId(prefSpeaker).catch(() => {});
    }
    a.play().catch(err => console.warn('[audio monitor] play blocked:', err));
    mediaAudioMap.current.set(itemId, a);
  };

  const addToStreamWithAudio = (itemId: string) => {
    addToStream(itemId);
    const m = mediaItems.find(mi => mi.id === itemId);
    if (m?.type === 'audio') startAudioMonitor(itemId);
  };

  const handleSpeakerToggle = () => {
    const next = !speakerOn;
    setSpeakerOn(next);
    applyMonitorVolume(next ? speakerVolume / 100 : 0);
  };

  const handleSpeakerVolume = (v: number) => {
    setSpeakerVolume(v);
    if (speakerOn) applyMonitorVolume(v / 100);
  };

  const handleCameraToggle = () => {
    const next = !cameraOn;
    setCameraOn(next);
    teacherTileStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = next; });
  };

  const handleMmAddYoutube = () => {
    if (!mmYoutubeUrl.trim()) return;
    addMediaItem({ type: 'youtube', name: 'ویدیو یوتیوب', url: mmYoutubeUrl, isActive: false });
    setMmYoutubeUrl(''); setMmShowYoutube(false);
    addAlert({ type: 'success', title: 'موفق', message: 'ویدیو یوتیوب اضافه شد', duration: 2000 });
  };

  const handleMmFileAdd = (type: 'video' | 'audio' | 'slideshow', files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      const url = URL.createObjectURL(file);
      const id = Math.random().toString(36).slice(2);
      setMmObjectUrls(prev => ({ ...prev, [id]: url }));
      addMediaItem({ type, name: file.name, url, isActive: false });
    });
  };

  const getMmYoutubeEmbed = (url: string) => {
    const m = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return m ? `https://www.youtube.com/embed/${m[1]}?autoplay=0` : url;
  };

  const mediaTypeLabel: Record<string, string> = {
    video: 'ویدیو', youtube: 'یوتیوب', audio: 'صوتی', slideshow: 'تصویر', whiteboard: 'وایت‌برد', screen: 'اشتراک صفحه',
  };

  // Media tiles
  const mediaTiles = mediaItems;

  // Current page items for stream
  const totalActiveItems = streamLayout.activeItems.length;
  const totalPages = Math.max(1, Math.ceil(totalActiveItems / streamLayout.gridSize));
  const startIdx = streamLayout.currentPage * streamLayout.gridSize;
  const currentPageItems = streamLayout.activeItems.slice(startIdx, startIdx + streamLayout.gridSize);

  // Grid class based on gridSize
  const gridClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-2 grid-rows-2',
    9: 'grid-cols-3 grid-rows-3',
    16: 'grid-cols-4 grid-rows-4',
  }[streamLayout.gridSize];

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* ── 10-minute warning banner ── */}
      {showWarning && remainingSec > 10 && remainingSec <= 600 && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[90] animate-float-in"
          style={{ minWidth: '300px' }}>
          <div className="glass rounded-xl px-4 py-3 flex items-center gap-3 border border-amber-400/30"
            style={{ background: 'rgba(245,158,11,0.12)' }}>
            <FiAlertTriangle className="text-amber-400 shrink-0" size={18} />
            <div className="flex-1">
              <p className="text-amber-300 text-sm font-bold">
                {toPersianNum(Math.floor(remainingSec / 60))} دقیقه و {toPersianNum(remainingSec % 60)} ثانیه تا پایان کلاس
              </p>
            </div>
            <button onClick={() => setShowWarning(false)} className="text-white/30 hover:text-white text-xs">✕</button>
          </div>
        </div>
      )}

      {/* ── Final 10-second overlay ── */}
      {showFinalCountdown && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(16px)' }}>
          <div className="glass rounded-3xl p-8 text-center animate-float-in" style={{ minWidth: '320px' }}>
            {/* Countdown ring */}
            <div className="relative w-36 h-36 mx-auto mb-4">
              <svg className="-rotate-90 w-36 h-36" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                <circle cx="60" cy="60" r="54" fill="none" stroke="#ef4444" strokeWidth="6"
                  strokeDasharray="339.3"
                  strokeDashoffset={339.3 * (1 - Math.max(0, remainingSec) / 10)}
                  strokeLinecap="round" className="transition-all duration-1000" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-red-400 font-bold"
                style={{ fontSize: '4rem', lineHeight: 1 }}>
                {toPersianNum(Math.max(0, remainingSec))}
              </span>
            </div>

            <p className="text-white font-bold text-lg mb-1">۱۰ ثانیه تا پایان کلاس</p>
            <p className="text-white/40 text-xs mb-6">{classData.name} • {classData.endTime}</p>

            {/* Mood / design options */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              {[
                { emoji: '🎓', label: 'موفق' },
                { emoji: '📚', label: 'آموزنده' },
                { emoji: '⭐', label: 'عالی' },
              ].map(m => (
                <button key={m.label}
                  className="glass-dark rounded-xl py-2 text-xs text-white/60 hover:text-white hover:bg-white/10 transition-all flex flex-col items-center gap-1">
                  <span className="text-xl">{m.emoji}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>

            <button onClick={handleEndClass}
              className="w-full bg-red-500 hover:bg-red-600 text-white rounded-xl py-3 font-bold flex items-center justify-center gap-2 mb-2 transition-all">
              <FiSquare size={16} /> پایان کلاس
            </button>
            <button onClick={() => setShowFinalCountdown(false)}
              className="w-full glass-btn rounded-xl py-2 text-white/50 text-xs hover:text-white transition-all">
              ادامه کلاس (تمدید)
            </button>
          </div>
        </div>
      )}

      {/* ═══ BAR 1: Top Header ═══ */}
      <div className="glass border-b border-white/10 px-3 py-1.5 flex-shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-1">
          {/* Right: Brand */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <FiMonitor size={16} className="text-white" />
            </div>
            <div className="leading-tight">
              <h1 className="text-white font-bold text-xs">سامانه کلاس‌های آموزشی سبز</h1>
              <p className="text-white/25 text-[8px]">G-Online-Edu-App</p>
              <p className="text-white/15 text-[8px]">نسخه {toPersianNum('2585/0/00')}</p>
            </div>
          </div>

          {/* Center: Live status */}
          <div className="glass-dark rounded-xl px-3 py-1.5 text-center">
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-red-400 font-bold text-[10px]">زنده</span>
              </div>
              <CircularTimer seconds={classTime} total={3600} size={32} color="#06b6d4" />
              <div className="flex items-center gap-1">
                <FiUsers size={10} className="text-emerald-400" />
                <span className="text-emerald-400 text-[10px]">{toPersianNum(onlineStudents.length)}</span>
              </div>
              <div className="text-white/60 text-[10px]">{classData.name}</div>
              <div className="text-white/40 text-[10px]">{currentUser}</div>
            </div>
          </div>

          {/* Left: Date + Actions */}
          <div className="flex items-center gap-2">
            <div className="text-left text-[10px]">
              <p className="text-white/50">{toShamsi(now)}</p>
              <p className="text-white/30">{getPersianWeekDay(now)} • {getPersianTime(now)}</p>
            </div>
            <button onClick={() => setShowInvite(!showInvite)} className="glass-btn rounded-lg px-2 py-1.5 text-xs text-cyan-400 flex items-center gap-1">
              <FiUserPlus size={12} /> دعوت
            </button>
            <button onClick={() => setShowEndConfirm(true)} className="glass-btn rounded-lg px-2 py-1.5 text-xs text-red-400 flex items-center gap-1">
              <FiLogOut size={12} /> پایان
            </button>
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div className="absolute top-14 left-4 z-50 glass-alert rounded-2xl p-4 w-80 animate-float-in">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-white font-semibold text-sm">دعوت و مدیریت</h3>
            <button onClick={() => setShowInvite(false)}><FiX className="text-white/40" /></button>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {classStudents.map(s => (
              <div key={s.id} className="glass-dark rounded-lg p-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${s.isOnline ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                  <span className="text-white text-xs">{s.name}</span>
                </div>
                <button onClick={() => { setKickingStudent(s.id); setShowInvite(false); }}
                  className="text-red-400/60 hover:text-red-400 text-[10px]">اخراج</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kick Modal */}
      {kickingStudent && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="glass-alert rounded-2xl p-5 w-96 animate-float-in">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
              <FiAlertTriangle className="text-red-400" /> اخراج دانش‌آموز
            </h3>
            <p className="text-white/50 text-xs mb-3">لطفاً دلیل اخراج را وارد کنید:</p>
            <textarea value={kickReason} onChange={e => setKickReason(e.target.value)}
              className="glass-input w-full rounded-xl px-3 py-2 text-sm h-20 resize-none" placeholder="دلیل اخراج..." />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => { setKickingStudent(null); setKickReason(''); }}
                className="glass-btn rounded-xl px-4 py-2 text-white/60 text-xs">انصراف</button>
              <button onClick={() => handleKick(kickingStudent)}
                className="bg-red-500 text-white rounded-xl px-4 py-2 text-xs">اخراج</button>
            </div>
          </div>
        </div>
      )}

      {/* End confirm */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="glass-alert rounded-2xl p-6 w-96 animate-float-in text-center">
            <FiAlertTriangle size={40} className="text-amber-400 mx-auto mb-3" />
            <h3 className="text-white font-semibold mb-2">پایان کلاس</h3>
            <p className="text-white/50 text-sm mb-2">آیا مایل به ذخیره چت به‌صورت PDF هستید؟</p>
            <div className="flex justify-center gap-2 mt-4">
              <button onClick={() => { setShowEndConfirm(false); handleEndClass(); }}
                className="glass-btn rounded-xl px-4 py-2 text-white/60 text-xs">خیر، فقط پایان</button>
              <button onClick={() => { setShowEndConfirm(false); handleEndClass(); }}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl px-4 py-2 text-xs flex items-center gap-1">
                <FiDownload size={12} /> ذخیره و پایان
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ BAR 2: Sub Header ═══ */}
      <div className="glass-dark border-b border-white/5 px-3 py-1 flex items-center justify-between flex-shrink-0">
        {/* Right: Media Manager */}
        <div className="flex items-center gap-1">
          <button onClick={() => setShowMediaManager(true)}
            className="glass-btn rounded-lg px-3 py-1 text-[10px] text-amber-400 flex items-center gap-1.5 hover:text-amber-300 border border-amber-400/20">
            <FiLayers size={12} /> مدیریت محتوا
            {mediaItems.length > 0 && (
              <span className="bg-amber-400/20 text-amber-300 rounded-full w-4 h-4 flex items-center justify-center text-[9px]">
                {toPersianNum(mediaItems.length)}
              </span>
            )}
          </button>
        </div>

        {/* Center: Warning */}
        {showWarning && (
          <div className="animate-blink bg-red-500/20 text-red-300 rounded-lg px-3 py-1 text-[10px] flex items-center gap-1">
            <FiAlertTriangle size={10} /> کمتر از ۱۰ دقیقه مانده
          </div>
        )}

        {/* Left: Quality + Panels + Record */}
        <div className="flex items-center gap-1">
          {/* Stream Quality Selector */}
          <div className="flex items-center gap-1 glass-btn rounded-lg px-2 py-1">
            <FiVideo size={11} className="text-cyan-400 flex-shrink-0" />
            <select
              value={streamQualityKey}
              onChange={e => applyStreamQuality(e.target.value)}
              className="bg-transparent text-[10px] text-cyan-300 outline-none cursor-pointer"
              style={{ direction: 'ltr' }}
            >
              {STREAM_QUALITY_PRESETS.map(p => (
                <option key={p.key} value={p.key} style={{ background: '#1e293b', color: '#e2e8f0' }}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <button onClick={toggleSpeakPanel} className={`glass-btn rounded-lg px-2 py-1 text-[10px] flex items-center gap-1 ${showSpeakPanel ? 'text-cyan-400' : 'text-white/40'}`}>
            <BsHandIndex size={12} /> صحبت
          </button>
          <button onClick={toggleChat} className={`glass-btn rounded-lg px-2 py-1 text-[10px] flex items-center gap-1 ${showChat ? 'text-indigo-400' : 'text-white/40'}`}>
            <FiMessageSquare size={12} /> چت
          </button>
          <button className={`glass-btn rounded-lg px-2 py-1 text-[10px] flex items-center gap-1 ${isRecording ? 'text-red-400' : 'text-white/40'}`}>
            {isRecording ? <><FiSquare size={10} /> توقف</> : <><BsRecordCircle size={10} /> رکورد</>}
          </button>
          <div className="flex items-center gap-1 text-[10px] text-white/30 mr-2">
            <FiClock size={10} />
            {toPersianNum(String(Math.floor(classTime / 60)).padStart(2, '0'))}:{toPersianNum(String(classTime % 60).padStart(2, '0'))}
          </div>
        </div>
      </div>

      {/* ═══ MAIN ROW: Bars 3, 4, 5 ═══ */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* ═══ BAR 3: Speak Channel (Right) ═══ */}
        {showSpeakPanel && (
          <div className="w-48 md:w-56 flex-shrink-0 glass border-l border-white/5 flex flex-col">
            <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-white/60 text-xs font-semibold flex items-center gap-1">
                <BsHandIndex size={12} className="text-amber-400" /> درخواست صحبت
              </h3>
              <div className="flex gap-1">
                <button onClick={clearAllSpeakRequests} className="text-red-400/60 hover:text-red-400 text-[10px]">بستن همه</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {speakRequests.filter(r => r.status === 'pending').map(req => (
                <div key={req.studentId} className="glass-dark rounded-lg p-2 animate-float-in">
                  <div className="flex items-center justify-between">
                    <span className="text-white text-xs">{req.studentName}</span>
                    <span className="text-white/20 text-[8px]">{req.timestamp}</span>
                  </div>
                  <div className="flex gap-1 mt-1.5">
                    <button onClick={() => approveSpeakRequest(req.studentId)}
                      className="flex-1 bg-emerald-500/20 text-emerald-400 rounded px-2 py-0.5 text-[10px] flex items-center justify-center gap-1">
                      <FiCheck size={8} /> باز
                    </button>
                    <button onClick={() => rejectSpeakRequest(req.studentId)}
                      className="flex-1 bg-red-500/20 text-red-400 rounded px-2 py-0.5 text-[10px] flex items-center justify-center gap-1">
                      <FiX size={8} /> بستن
                    </button>
                  </div>
                </div>
              ))}
              {speakRequests.filter(r => r.status === 'pending').length === 0 && (
                <p className="text-white/20 text-[10px] text-center mt-8">درخواستی وجود ندارد</p>
              )}

              {/* Approved list */}
              {speakRequests.filter(r => r.status === 'approved').length > 0 && (
                <div className="mt-3 pt-2 border-t border-white/5">
                  <p className="text-emerald-400/60 text-[10px] mb-1">در حال صحبت:</p>
                  {speakRequests.filter(r => r.status === 'approved').map(req => (
                    <div key={req.studentId} className="flex items-center justify-between py-1">
                      <span className="text-emerald-400 text-xs flex items-center gap-1">
                        <FiMic size={10} /> {req.studentName}
                      </span>
                      <button onClick={() => rejectSpeakRequest(req.studentId)} className="text-red-400/60 text-[10px]">بستن</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ BAR 4: Main Stream Area (Center) ═══ */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 p-2 relative">
            {currentPageItems.length > 0 ? (
              <div className={`grid ${gridClass} gap-1.5 h-full`}>
                {currentPageItems.map((itemId) => {
                  // Find the item info
                  const isTeacher = itemId === 'teacher-cam';
                  const isStudent = itemId.startsWith('student-');
                  const studentId = isStudent ? itemId.replace('student-', '') : null;
                  const student = studentId ? students.find(s => s.id === studentId) : null;
                  const mediaItem = mediaItems.find(m => m.id === itemId);

                  let label = '';
                  let isOnline = true;
                  let bgColor = 'from-slate-700 to-slate-800';

                  if (isTeacher) {
                    label = currentUser || 'معلم';
                    bgColor = 'from-cyan-900/50 to-blue-900/50';
                  } else if (student) {
                    label = student.name;
                    isOnline = student.isOnline;
                    bgColor = isOnline ? 'from-indigo-900/30 to-purple-900/30' : 'from-gray-800/50 to-gray-900/50';
                  } else if (mediaItem) {
                    label = mediaItem.name;
                    bgColor = mediaItem.type === 'youtube' ? 'from-red-900/30 to-red-800/30' :
                              mediaItem.type === 'audio' ? 'from-amber-900/30 to-orange-900/30' :
                              'from-slate-700/50 to-slate-800/50';
                  }

                  return (
                    <div key={itemId} className={`bg-gradient-to-br ${bgColor} rounded-xl border border-white/5 flex items-center justify-center relative overflow-hidden tile-hover`}>
                      {/* Live camera for teacher */}
                      {isTeacher && <LiveCamVideo stream={teacherTileStreamRef.current} />}

                      {/* Media content */}
                      {mediaItem?.type === 'video' && mediaItem.url && (() => {
                        const ps = playState[itemId];
                        return (
                          <>
                            <video
                              ref={el => {
                                if (el) {
                                  tileVideoRefs.current.set(itemId, el);
                                  el.volume = speakerOn ? speakerVolume / 100 : 0;
                                  const prefSpeaker = localStorage.getItem('pref_speaker');
                                  if (prefSpeaker && (el as any).setSinkId) (el as any).setSinkId(prefSpeaker).catch(() => {});
                                } else {
                                  tileVideoRefs.current.delete(itemId);
                                }
                              }}
                              src={mediaItem.url} autoPlay loop
                              className="absolute inset-0 w-full h-full object-contain bg-black" />
                            {/* Hover controls overlay */}
                            <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-200 z-20 flex flex-col justify-end"
                              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 60%)' }}>
                              <div className="px-2 pb-2 space-y-1">
                                {/* Seek bar */}
                                <input type="range" min={0} max={ps?.duration || 0} step={0.1}
                                  value={ps?.currentTime || 0}
                                  onChange={e => seekTo(itemId, +e.target.value)}
                                  onClick={e => e.stopPropagation()}
                                  className="w-full h-1 rounded-full accent-white cursor-pointer" />
                                {/* Buttons + time */}
                                <div className="flex items-center gap-1.5">
                                  <button onClick={e => { e.stopPropagation(); restartMedia(itemId); }}
                                    title="از ابتدا"
                                    className="text-white/70 hover:text-white p-1 rounded transition-colors">
                                    <FiSkipBack size={12} />
                                  </button>
                                  <button onClick={e => { e.stopPropagation(); togglePlay(itemId); }}
                                    className="bg-white/20 hover:bg-white/30 text-white rounded-full p-1.5 transition-colors">
                                    {ps?.playing ? <FiPause size={13} /> : <FiPlay size={13} />}
                                  </button>
                                  <button onClick={e => { e.stopPropagation(); toggleLoop(itemId); }}
                                    title="تکرار"
                                    className={`p-1 rounded transition-colors ${loopIds.has(itemId) ? 'text-cyan-400' : 'text-white/50 hover:text-white'}`}>
                                    <FiRepeat size={12} />
                                  </button>
                                  <span className="text-white/60 text-[9px] mr-auto font-mono">
                                    {fmtTime(ps?.currentTime || 0)} / {fmtTime(ps?.duration || 0)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                      {mediaItem?.type === 'youtube' && mediaItem.url && (() => {
                        const ytId = getYouTubeId(mediaItem.url!);
                        return ytId ? (
                          <iframe
                            src={`https://www.youtube.com/embed/${ytId}?autoplay=1&mute=0`}
                            className="absolute inset-0 w-full h-full"
                            allow="autoplay; encrypted-media"
                            allowFullScreen
                          />
                        ) : null;
                      })()}
                      {mediaItem?.type === 'slideshow' && mediaItem.url && (
                        <img src={mediaItem.url} className="absolute inset-0 w-full h-full object-contain bg-black" alt="" />
                      )}

                      {/* Live student camera via WebRTC */}
                      {isStudent && studentStreams[studentId!] && (
                        <StudentCamVideo stream={studentStreams[studentId!]} />
                      )}

                      {/* Audio tile — equalizer + always-visible controls */}
                      {mediaItem?.type === 'audio' && (() => {
                        const ps = playState[itemId];
                        return (
                        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-3">
                          <FiMusic size={24} className="text-amber-400/60 mb-2 flex-shrink-0" />
                          {/* Equalizer — paused when not playing */}
                          <div className="flex gap-1 items-end h-9 mb-2">
                            {[35,60,80,55,90,70,45,85,65,75,50,95].map((h, i) => (
                              <div key={i}
                                className="w-1.5 rounded-full bg-gradient-to-t from-orange-500 to-amber-300"
                                style={{
                                  height: `${h}%`,
                                  transformOrigin: 'bottom',
                                  animation: ps?.playing !== false
                                    ? `eqBar ${0.4 + (i % 4) * 0.15}s ease-in-out infinite alternate`
                                    : 'none',
                                  animationDelay: `${i * 0.07}s`,
                                }}
                              />
                            ))}
                          </div>
                          <p className="text-white/70 text-xs font-bold truncate max-w-full mb-3">
                            فایل صوتی از: {classData.teacherName || currentUser}
                          </p>
                          {/* Seek bar */}
                          <input type="range" min={0} max={ps?.duration || 0} step={0.1}
                            value={ps?.currentTime || 0}
                            onChange={e => seekTo(itemId, +e.target.value)}
                            onClick={e => e.stopPropagation()}
                            className="w-full h-1 rounded-full accent-amber-400 cursor-pointer mb-1.5" />
                          {/* Controls row */}
                          <div className="flex items-center gap-2 w-full">
                            <button onClick={e => { e.stopPropagation(); restartMedia(itemId); }}
                              title="از ابتدا"
                              className="text-white/60 hover:text-white transition-colors p-1">
                              <FiSkipBack size={13} />
                            </button>
                            <button onClick={e => { e.stopPropagation(); togglePlay(itemId); }}
                              className="bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 rounded-full p-2 transition-colors">
                              {ps?.playing ? <FiPause size={14} /> : <FiPlay size={14} />}
                            </button>
                            <button onClick={e => { e.stopPropagation(); toggleLoop(itemId); }}
                              title="تکرار"
                              className={`p-1 rounded transition-colors ${loopIds.has(itemId) ? 'text-amber-400' : 'text-white/40 hover:text-white/70'}`}>
                              <FiRepeat size={13} />
                            </button>
                            <span className="text-white/40 text-[9px] mr-auto font-mono">
                              {fmtTime(ps?.currentTime || 0)} / {fmtTime(ps?.duration || 0)}
                            </span>
                          </div>
                        </div>
                        );
                      })()}

                      {/* Fallback icons for non-media tiles */}
                      {!isTeacher && !mediaItem?.url && !studentStreams[studentId!] && mediaItem?.type !== 'audio' && (
                        <div className="text-center z-10">
                          {student && !isOnline && <FiCameraOff size={24} className="text-gray-500/40 mx-auto mb-1" />}
                          {student && isOnline && <FiCamera size={24} className="text-emerald-400/40 mx-auto mb-1" />}
                          {mediaItem?.type === 'whiteboard' && <FiGrid size={32} className="text-white/20 mx-auto mb-1" />}
                          {mediaItem?.type === 'screen' && <FiMonitor size={32} className="text-green-400/40 mx-auto mb-1" />}
                          {mediaItem?.type === 'youtube' && <FiYoutube size={32} className="text-red-400/40 mx-auto mb-1" />}
                          <p className="text-white/40 text-xs">{label}</p>
                        </div>
                      )}

                      {/* Name overlay */}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 z-10">
                        <p className="text-white/80 text-[10px] truncate">{label}</p>
                      </div>

                      {/* Status indicator */}
                      {student && (
                        <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                      )}

                      {/* Remove from stream button */}
                      <button onClick={() => removeFromStream(itemId)}
                        className="tile-controls absolute top-1 left-1 bg-black/40 text-white/60 rounded p-0.5 hover:text-red-400">
                        <FiMinus size={10} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  {/* Time & Date */}
                  <p className="text-white/80 font-bold mb-0.5" style={{ fontSize: '3.5rem', lineHeight: 1 }}>
                    {getPersianTime(now)}
                  </p>
                  <p className="text-white/40 font-semibold mb-6" style={{ fontSize: '1.5rem', lineHeight: 1 }}>
                    {toShamsi(now)} • {getPersianWeekDay(now)}
                  </p>

                  <FiMonitor size={48} className="text-white/10 mx-auto mb-4" />

                  <p className="text-white/50 text-lg font-semibold mb-1">
                    به کلاس {classData.name} خوش آمدید
                  </p>
                  <p className="text-white/30 text-sm">
                    معلم کلاس: {classData.teacherName} &nbsp;|&nbsp; درس: {classData.courseName}
                  </p>
                </div>
              </div>
            )}

            {/* Page navigation */}
            {totalPages > 1 && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2">
                <button onClick={() => useAppStore.setState(s => ({ streamLayout: { ...s.streamLayout, currentPage: Math.max(0, s.streamLayout.currentPage - 1) } }))}
                  className="glass-btn rounded-full p-1.5 text-white/40"><FiChevronRight size={14} /></button>
                <span className="text-white/40 text-xs">{toPersianNum(streamLayout.currentPage + 1)}/{toPersianNum(totalPages)}</span>
                <button onClick={() => useAppStore.setState(s => ({ streamLayout: { ...s.streamLayout, currentPage: Math.min(totalPages - 1, s.streamLayout.currentPage + 1) } }))}
                  className="glass-btn rounded-full p-1.5 text-white/40"><FiChevronLeft size={14} /></button>
                <button onClick={() => setAutoRotate(!autoRotate)}
                  className={`glass-btn rounded-full p-1.5 ${autoRotate ? 'text-cyan-400' : 'text-white/40'}`} title="چرخش خودکار">
                  <FiRefreshCw size={14} className={autoRotate ? 'animate-spin' : ''} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ═══ BAR 5: Chat (Left) ═══ */}
        {showChat && (
          <div className="w-56 md:w-64 flex-shrink-0 glass border-r border-white/5 flex flex-col">
            <div className="px-3 py-2 border-b border-white/5">
              <h3 className="text-white/60 text-xs font-semibold flex items-center gap-1">
                <FiMessageSquare size={12} className="text-indigo-400" /> چت کلاس
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {chatMessages.map(msg => (
                <div key={msg.id} className={`rounded-lg p-2 ${
                  msg.type === 'system' ? 'bg-indigo-500/10 text-center' :
                  msg.senderRole === 'teacher' ? 'bg-cyan-500/10 mr-4' : 'bg-white/5 ml-4'
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

      {/* ═══ BAR 6: Tiles Bar ═══ */}
      <div className="glass-dark border-t border-white/5 px-2 py-1.5 flex-shrink-0">
        <div className="flex gap-4">
          {/* Teacher tiles */}
          <div className="flex-1 min-w-0">
            <p className="text-white/20 text-[8px] mb-1">معلم و منابع</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {/* Teacher cam tile */}
              <div className="w-20 h-14 flex-shrink-0 rounded-lg relative overflow-hidden tile-hover cursor-pointer bg-slate-800"
                onClick={() => {
                  if (streamLayout.activeItems.includes('teacher-cam')) removeFromStream('teacher-cam');
                  else addToStream('teacher-cam');
                }}>
                <video ref={teacherTileVideoRef} autoPlay muted playsInline
                  className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <p className="text-white/80 text-[7px] absolute bottom-0.5 w-full text-center truncate px-0.5 drop-shadow">{currentUser}</p>
                <div className="absolute top-0.5 right-0.5">
                  {streamLayout.activeItems.includes('teacher-cam') ?
                    <span className="bg-red-500/80 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px]">−</span> :
                    <span className="bg-emerald-500/80 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px]">+</span>
                  }
                </div>
              </div>

              {/* Media tiles */}
              {mediaTiles.map(item => {
                const ytId = item.type === 'youtube' && item.url ? getYouTubeId(item.url) : null;
                const inStream = streamLayout.activeItems.includes(item.id);
                return (
                  <div key={item.id} className="w-20 h-14 flex-shrink-0 rounded-lg relative overflow-hidden tile-hover cursor-pointer bg-slate-800"
                    onClick={() => { if (inStream) removeFromStream(item.id); else addToStreamWithAudio(item.id); }}>

                    {/* Preview content */}
                    {item.type === 'video' && item.url && (
                      <video src={item.url} muted loop autoPlay playsInline
                        className="absolute inset-0 w-full h-full object-cover" />
                    )}
                    {item.type === 'youtube' && ytId && (
                      <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
                        className="absolute inset-0 w-full h-full object-cover" alt="" />
                    )}
                    {item.type === 'slideshow' && item.url && (
                      <img src={item.url} className="absolute inset-0 w-full h-full object-cover" alt="" />
                    )}
                    {item.type === 'audio' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-amber-900/40 to-orange-900/40">
                        <div className="flex gap-0.5 items-end h-6">
                          {[...Array(8)].map((_, i) => (
                            <div key={i} className="w-1 bg-gradient-to-t from-orange-500 to-amber-300 rounded-full animate-pulse"
                              style={{ height: `${Math.random() * 16 + 4}px`, animationDelay: `${i * 0.12}s` }} />
                          ))}
                        </div>
                      </div>
                    )}
                    {item.type === 'whiteboard' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/5">
                        <FiGrid size={18} className="text-white/20" />
                      </div>
                    )}
                    {item.type === 'screen' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-green-900/30 to-teal-900/30">
                        <FiMonitor size={18} className="text-green-400/40" />
                      </div>
                    )}
                    {item.type === 'youtube' && !ytId && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-red-900/30 to-red-800/30">
                        <FiYoutube size={18} className="text-red-400/40" />
                      </div>
                    )}

                    {/* Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <p className="text-white/80 text-[7px] absolute bottom-0.5 w-full text-center truncate px-0.5 drop-shadow">{item.name}</p>
                    <div className="absolute top-0.5 right-0.5">
                      {inStream ?
                        <span className="bg-red-500/80 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px]">−</span> :
                        <span className="bg-emerald-500/80 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px]">+</span>
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="w-px bg-white/10 self-stretch" />

          {/* Student tiles */}
          <div className="flex-1 min-w-0">
            <p className="text-white/20 text-[8px] mb-1">دانش‌آموزان ({toPersianNum(classStudents.length)})</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {classStudents.map(s => (
                <div key={s.id} className="w-20 h-14 flex-shrink-0 glass rounded-lg relative flex flex-col items-center justify-center tile-hover cursor-pointer overflow-hidden"
                  onClick={() => {
                    const tileId = `student-${s.id}`;
                    if (streamLayout.activeItems.includes(tileId)) removeFromStream(tileId);
                    else addToStream(tileId);
                  }}>
                  {studentStreams[s.id]
                    ? <StudentCamVideo stream={studentStreams[s.id]} />
                    : <FiCamera size={12} className={s.isOnline ? 'text-emerald-400/40' : 'text-gray-500/40'} />
                  }
                  <p className="text-white/30 text-[7px] truncate w-full text-center px-0.5 relative z-10">{s.name}</p>
                  <span className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${s.isOnline ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                  <div className="tile-controls absolute top-0.5 left-0.5 flex flex-col gap-0.5">
                    {streamLayout.activeItems.includes(`student-${s.id}`) ?
                      <span className="bg-red-500/60 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px]">−</span> :
                      <span className="bg-emerald-500/60 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px]">+</span>
                    }
                  </div>
                  <div className="tile-controls absolute bottom-0.5 right-0.5 flex gap-0.5">
                    <span className="bg-black/40 text-white/50 rounded p-0.5"><FiMicOff size={6} /></span>
                    <span className="bg-black/40 text-white/50 rounded p-0.5"><FiCameraOff size={6} /></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ BAR 7: Footer Toolbar ═══ */}
      <div className="glass border-t border-white/10 px-3 py-1.5 flex-shrink-0">
        <div className="flex items-center justify-between">
          {/* Right Fixed: Audio/Video controls */}
          <div className="flex items-center gap-3">

            {/* ── Mic ── */}
            <div className="flex items-center gap-1.5">
              <button onClick={handleMicToggle}
                className={`glass-btn rounded-lg p-2 flex-shrink-0 ${micOn ? 'text-emerald-400' : 'text-red-400 bg-red-500/10'}`}>
                {micOn ? <FiMic size={15} /> : <FiMicOff size={15} />}
              </button>
              <div className="flex flex-col gap-0.5 w-20">
                {/* Level meter */}
                <div className="flex gap-px h-2 items-end">
                  {Array.from({ length: 16 }).map((_, i) => {
                    const threshold = (i + 1) * 6.25;
                    const active = micOn && micLevel >= threshold;
                    const color = i < 10 ? 'bg-emerald-400' : i < 13 ? 'bg-amber-400' : 'bg-red-400';
                    return <div key={i} className={`flex-1 rounded-sm transition-all duration-75 ${active ? color : 'bg-white/10'}`} style={{ height: `${50 + i * 3}%` }} />;
                  })}
                </div>
                {/* Volume slider */}
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

          {/* Center Scrollable: Tools */}
          <div className="flex-1 mx-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            <div className="flex items-center gap-1.5 justify-center">
              <button onClick={() => { classStudents.forEach(s => addToStream(`student-${s.id}`)); }}
                className="glass-btn rounded-lg px-2.5 py-1.5 text-[10px] text-white/50 whitespace-nowrap flex items-center gap-1">
                <FiUsers size={10} /> همه دانش‌آموزان
              </button>
              <button onClick={() => { onlineStudents.forEach(s => addToStream(`student-${s.id}`)); }}
                className="glass-btn rounded-lg px-2.5 py-1.5 text-[10px] text-emerald-400/60 whitespace-nowrap flex items-center gap-1">
                <FiUsers size={10} /> آنلاین‌ها
              </button>
              <button onClick={() => { offlineStudents.forEach(s => addToStream(`student-${s.id}`)); }}
                className="glass-btn rounded-lg px-2.5 py-1.5 text-[10px] text-gray-400/60 whitespace-nowrap flex items-center gap-1">
                <FiUsers size={10} /> آفلاین‌ها
              </button>
              <button onClick={() => addToStream('teacher-cam')}
                className="glass-btn rounded-lg px-2.5 py-1.5 text-[10px] text-cyan-400/60 whitespace-nowrap flex items-center gap-1">
                <FiCamera size={10} /> دوربین معلم
              </button>
              <button onClick={() => { mediaItems.filter(m => m.type === 'youtube').forEach(m => addToStream(m.id)); }}
                className="glass-btn rounded-lg px-2.5 py-1.5 text-[10px] text-red-400/60 whitespace-nowrap flex items-center gap-1">
                <FiYoutube size={10} /> همه یوتیوب‌ها
              </button>
              <button onClick={() => { mediaItems.filter(m => m.type === 'video').forEach(m => addToStream(m.id)); }}
                className="glass-btn rounded-lg px-2.5 py-1.5 text-[10px] text-blue-400/60 whitespace-nowrap flex items-center gap-1">
                <FiFile size={10} /> فایل‌های ویدیویی
              </button>
              <button onClick={() => { mediaItems.filter(m => m.type === 'screen').forEach(m => addToStream(m.id)); }}
                className="glass-btn rounded-lg px-2.5 py-1.5 text-[10px] text-green-400/60 whitespace-nowrap flex items-center gap-1">
                <FiMonitor size={10} /> صفحه‌ها
              </button>
              <button onClick={() => { mediaItems.filter(m => m.type === 'whiteboard').forEach(m => addToStream(m.id)); }}
                className="glass-btn rounded-lg px-2.5 py-1.5 text-[10px] text-white/40 whitespace-nowrap flex items-center gap-1">
                <FiGrid size={10} /> وایت‌بردها
              </button>
              <button onClick={() => { mediaItems.filter(m => m.type === 'audio').forEach(m => addToStreamWithAudio(m.id)); }}
                className="glass-btn rounded-lg px-2.5 py-1.5 text-[10px] text-amber-400/60 whitespace-nowrap flex items-center gap-1">
                <FiMusic size={10} /> صوت‌ها
              </button>
            </div>
          </div>

          {/* Left Fixed: Settings */}
          <div className="flex items-center gap-1.5">
            <button onClick={() => setShowSettings(!showSettings)}
              className="glass-btn rounded-lg p-2 text-white/60"><FiSettings size={16} /></button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mt-2 glass-dark rounded-xl p-3 animate-float-in">
            <h4 className="text-white/60 text-xs mb-2">تنظیم نمایش استریم</h4>
            <div className="flex flex-wrap gap-2 mb-2">
              {([1, 2, 3, 4, 9, 16] as const).map(size => (
                <button key={size} onClick={() => setGridSize(size)}
                  className={`rounded-lg px-3 py-1.5 text-xs ${streamLayout.gridSize === size ? 'bg-indigo-500 text-white' : 'glass-btn text-white/50'}`}>
                  {toPersianNum(size)} تایی
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <label className="text-white/40 text-xs">چرخش خودکار:</label>
              <button onClick={() => setAutoRotate(!autoRotate)}
                className={`rounded-lg px-3 py-1 text-xs ${autoRotate ? 'bg-emerald-500/20 text-emerald-400' : 'glass-btn text-white/50'}`}>
                {autoRotate ? 'فعال' : 'غیرفعال'}
              </button>
              <label className="text-white/40 text-xs">هر</label>
              <input type="number" value={rotateInterval} onChange={e => setRotateInterval(parseInt(e.target.value) || 5)}
                className="glass-input w-12 rounded-lg px-2 py-1 text-xs text-center" />
              <span className="text-white/40 text-xs">ثانیه</span>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Media Manager Modal ═══ */}
      {showMediaManager && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowMediaManager(false)}>
          <div className="glass rounded-2xl p-5 w-full max-w-2xl max-h-[85vh] flex flex-col animate-float-in"
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h3 className="text-white font-bold flex items-center gap-2">
                <FiLayers className="text-amber-400" /> مدیریت محتوای کلاس
                <span className="text-white/30 text-xs font-normal">{toPersianNum(mediaItems.length)} آیتم</span>
              </h3>
              <button onClick={() => setShowMediaManager(false)} className="text-white/40 hover:text-white"><FiX size={18} /></button>
            </div>

            {/* Add buttons */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-3 flex-shrink-0">
              {[
                { label: 'ویدیو',       icon: <FiFile size={14} className="text-blue-400" />,    onClick: () => mmVideoRef.current?.click() },
                { label: 'تصویر',       icon: <FiImage size={14} className="text-pink-400" />,   onClick: () => mmImageRef.current?.click() },
                { label: 'صوتی',        icon: <FiMusic size={14} className="text-purple-400" />, onClick: () => mmAudioRef.current?.click() },
                { label: 'یوتیوب',      icon: <FiYoutube size={14} className="text-red-400" />,  onClick: () => setMmShowYoutube(v => !v), active: mmShowYoutube },
                { label: 'وایت‌برد',    icon: <FiGrid size={14} className="text-amber-400" />,   onClick: () => addMediaItem({ type: 'whiteboard', name: 'تخته وایت‌برد', isActive: false }) },
                { label: 'اشتراک صفحه', icon: <FiMonitor size={14} className="text-green-400" />,onClick: () => addMediaItem({ type: 'screen', name: 'صفحه نمایش', isActive: false }) },
              ].map((btn, i) => (
                <button key={i} onClick={btn.onClick}
                  className={`glass-btn rounded-xl py-2 flex flex-col items-center gap-1 text-[10px] transition-all ${(btn as any).active ? 'text-red-400 border-red-400/30' : 'text-white/60 hover:text-white'}`}>
                  {btn.icon} {btn.label}
                </button>
              ))}
            </div>

            {/* Hidden file inputs */}
            <input ref={mmVideoRef} type="file" accept="video/*" multiple className="hidden"
              onChange={e => handleMmFileAdd('video', e.target.files)} />
            <input ref={mmAudioRef} type="file" accept="audio/*" multiple className="hidden"
              onChange={e => handleMmFileAdd('audio', e.target.files)} />
            <input ref={mmImageRef} type="file" accept="image/*" multiple className="hidden"
              onChange={e => handleMmFileAdd('slideshow', e.target.files)} />

            {/* YouTube input */}
            {mmShowYoutube && (
              <div className="flex gap-2 mb-3 animate-float-in flex-shrink-0">
                <input value={mmYoutubeUrl} onChange={e => setMmYoutubeUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleMmAddYoutube()}
                  className="glass-input flex-1 rounded-xl px-3 py-2 text-sm" dir="ltr"
                  placeholder="https://youtube.com/watch?v=..." />
                <button onClick={handleMmAddYoutube}
                  className="bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl px-4 py-2 text-xs flex items-center gap-1">
                  <FiYoutube size={13} /> افزودن
                </button>
              </div>
            )}

            {/* Media list */}
            <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
              {mediaItems.length === 0 ? (
                <div className="text-center py-10 text-white/20 text-sm">هنوز محتوایی اضافه نشده</div>
              ) : mediaItems.map(item => {
                const iconMap: Record<string, JSX.Element> = {
                  video:      <FiFile className="text-blue-400" />,
                  youtube:    <FiYoutube className="text-red-400" />,
                  slideshow:  <FiImage className="text-pink-400" />,
                  audio:      <FiMusic className="text-purple-400" />,
                  whiteboard: <FiGrid className="text-amber-400" />,
                  screen:     <FiMonitor className="text-green-400" />,
                };
                const inStream = streamLayout.activeItems.includes(item.id);
                return (
                  <div key={item.id} className={`glass-dark rounded-xl p-3 flex items-center gap-3 transition-all ${inStream ? 'border border-cyan-400/20' : ''}`}>
                    <span className="text-lg shrink-0">{iconMap[item.type] || <FiFile />}</span>

                    {/* Name — editable */}
                    <div className="flex-1 min-w-0">
                      {mmEditingId === item.id ? (
                        <input autoFocus value={mmEditingName}
                          onChange={e => setMmEditingName(e.target.value)}
                          onBlur={() => { if (mmEditingName.trim()) (item as any).name = mmEditingName.trim(); setMmEditingId(null); }}
                          onKeyDown={e => { if (e.key === 'Enter') { if (mmEditingName.trim()) (item as any).name = mmEditingName.trim(); setMmEditingId(null); } }}
                          className="glass-input w-full rounded-lg px-2 py-1 text-xs text-white" />
                      ) : (
                        <button onClick={() => { setMmEditingId(item.id); setMmEditingName(item.name); }}
                          className="text-white text-sm truncate max-w-full block text-right hover:text-cyan-300 transition-colors"
                          title="برای ویرایش نام کلیک کنید">
                          {item.name}
                        </button>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-white/30 text-[10px]">{mediaTypeLabel[item.type] || item.type}</span>
                        {inStream && <span className="text-cyan-400 text-[9px] bg-cyan-400/10 rounded px-1">در استریم</span>}
                      </div>
                    </div>

                    {/* Edit name button */}
                    <button onClick={() => { setMmEditingId(item.id); setMmEditingName(item.name); }}
                      className="glass-btn rounded-lg p-1.5 text-white/30 hover:text-white/70 shrink-0">
                      <FiEdit2 size={12} />
                    </button>

                    {/* Add/Remove from stream */}
                    <button onClick={() => { if (inStream) removeFromStream(item.id); else addToStreamWithAudio(item.id); }}
                      className={`glass-btn rounded-lg px-2.5 py-1.5 text-[10px] shrink-0 flex items-center gap-1 ${inStream ? 'text-red-400 border-red-400/20' : 'text-cyan-400 border-cyan-400/20'}`}>
                      {inStream ? <><FiMinus size={10}/> حذف از استریم</> : <><FiPlay size={10}/> افزودن به استریم</>}
                    </button>

                    {/* Preview */}
                    {item.url && (
                      <button onClick={() => setMmPreviewItem(item)}
                        className="glass-btn rounded-lg p-1.5 text-cyan-300/60 hover:text-cyan-300 shrink-0">
                        <FiPlay size={12} />
                      </button>
                    )}

                    {/* Delete */}
                    <button onClick={() => {
                      if (mmObjectUrls[item.id]) URL.revokeObjectURL(mmObjectUrls[item.id]);
                      removeFromStream(item.id);
                      removeMediaItem(item.id);
                    }} className="text-red-400/50 hover:text-red-400 shrink-0">
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Media Preview Modal (nested inside manager) ═══ */}
      {mmPreviewItem && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={() => setMmPreviewItem(null)}>
          <div className="glass rounded-2xl p-4 w-full max-w-2xl animate-float-in"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-bold">{mmPreviewItem.name}</h3>
              <button onClick={() => setMmPreviewItem(null)} className="text-white/40 hover:text-white text-xl leading-none">✕</button>
            </div>
            {mmPreviewItem.type === 'video' && mmPreviewItem.url && (
              <video src={mmPreviewItem.url} controls className="w-full rounded-xl max-h-96" />
            )}
            {mmPreviewItem.type === 'youtube' && mmPreviewItem.url && (
              <iframe src={getMmYoutubeEmbed(mmPreviewItem.url)} className="w-full rounded-xl"
                style={{ height: '360px', border: 'none' }} allowFullScreen />
            )}
            {mmPreviewItem.type === 'audio' && mmPreviewItem.url && (
              <div className="py-6 flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <FiMusic size={36} className="text-purple-400" />
                </div>
                <audio src={mmPreviewItem.url} controls className="w-full" />
              </div>
            )}
            {mmPreviewItem.type === 'slideshow' && mmPreviewItem.url && (
              <img src={mmPreviewItem.url} alt={mmPreviewItem.name}
                className="w-full rounded-xl max-h-96 object-contain bg-black" />
            )}
          </div>
        </div>
      )}

      {/* Hidden offscreen canvas used for canvas capture stream */}
      <canvas ref={offscreenCanvasRef} width={960} height={540} style={{ display: 'none' }} aria-hidden="true" />
    </div>
  );
}
