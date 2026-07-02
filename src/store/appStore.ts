import { create } from 'zustand';
import type { UserRole, Admin, Student, ClassSession, ChatMessage, MediaItem, SpeakRequest, StreamLayout, StreamingServer } from './types';
import { generateClassCode, generatePassword } from '../utils/persian';
import {
  connectSocket, disconnectSocket, getSocket,
  emitJoinClass, emitLeaveClass, emitClassStart, emitClassEnd,
  emitSpeakRequest, emitSpeakApprove, emitSpeakReject,
  onStudentOnline, onStudentOffline, onSpeakRequest, onSpeakApproved,
  onSpeakRejected, onClassStarted, onClassEnded, onStudentKicked,
  onChatMessage, offAllListeners, emitStreamLayout, onClassOnlineUpdate,
} from '../services/socketManager';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3002';

// ─── HTTP helper ────────────────────────────────────────────────────────────
class ApiError extends Error {
  field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.field = field;
  }
}

async function api<T>(endpoint: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string> || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new ApiError(err.error || `HTTP ${res.status}`, err.field);
  }
  return res.json() as Promise<T>;
}

export interface AlertItem {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  showTimer?: boolean;
}

interface AppState {
  // Auth
  currentRole: UserRole | null;
  currentUser: string | null;
  currentUserId: string | null;
  currentClassName: string | null;
  isLoggedIn: boolean;
  isConnecting: boolean;
  authToken: string | null;
  currentSessionId: string | null;
  sessionStartMs: number | null;

  // Data
  admins: Admin[];
  students: Student[];
  classes: ClassSession[];
  streamingServers: StreamingServer[];

  // Active class state
  activeClassId: string | null;
  isClassLive: boolean;
  chatMessages: ChatMessage[];
  mediaItems: MediaItem[];
  speakRequests: SpeakRequest[];
  streamLayout: StreamLayout;
  isRecording: boolean;

  // UI state
  showChat: boolean;
  showSpeakPanel: boolean;
  alerts: AlertItem[];
  studentReadyToJoin: boolean;
  currentAttendanceId: string | null;

  // Actions
  login: (role: UserRole, code: string, password: string) => Promise<{ success: boolean; error?: string; field?: string }>;
  logout: () => void;

  // Admin actions
  addClass: (cls: Omit<ClassSession, 'id' | 'code' | 'sessionHistory' | 'usedHours'>) => Promise<void>;
  updateClass: (id: string, data: Partial<ClassSession>) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;
  toggleClassActive: (id: string) => Promise<void>;

  // Student actions
  addStudent: (student: Omit<Student, 'id' | 'isOnline' | 'cameraEnabled' | 'micEnabled' | 'kickHistory'>) => Promise<void>;
  addStudentsToClass: (classId: string, studentIds: string[]) => Promise<void>;
  removeStudentFromClass: (classId: string, studentId: string) => Promise<void>;
  updateStudent: (id: string, data: Partial<Student>) => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;
  importStudents: (students: Array<{ name: string; description: string }>, classId: string) => void;
  kickStudent: (studentId: string, classId: string, reason: string) => Promise<void>;

  // Class session actions
  startClass: (classId: string) => Promise<void>;
  endClass: () => Promise<void>;

  // Media actions
  addMediaItem: (item: Omit<MediaItem, 'id'>) => void;
  removeMediaItem: (id: string) => void;
  addToStream: (mediaId: string) => void;
  removeFromStream: (mediaId: string) => void;
  setGridSize: (size: StreamLayout['gridSize']) => void;

  // Chat actions
  sendMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;

  // Speak request actions
  requestSpeak: (studentId: string, studentName: string) => void;
  approveSpeakRequest: (studentId: string) => void;
  rejectSpeakRequest: (studentId: string) => void;
  clearAllSpeakRequests: () => void;

  // UI actions
  toggleChat: () => void;
  toggleSpeakPanel: () => void;
  setStudentReadyToJoin: (v: boolean) => void;
  setCurrentAttendanceId: (id: string | null) => void;
  addAlert: (alert: Omit<AlertItem, 'id'>) => void;
  removeAlert: (id: string) => void;
  addStreamingServer: (server: Omit<StreamingServer, 'id' | 'createdAt'>) => void;
  updateStreamingServer: (id: string, data: Partial<StreamingServer>) => void;
  deleteStreamingServer: (id: string) => void;

  // Admin management
  addAdmin: (admin: Omit<Admin, 'id' | 'createdAt'>) => void;
  deleteAdmin: (id: string) => void;

  // Internal
  _setupSocketListeners: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // ─── Initial State ──────────────────────────────────────────────────────
  currentRole: null,
  currentUser: null,
  currentUserId: null,
  currentClassName: null,
  isLoggedIn: false,
  isConnecting: false,
  authToken: null,
  currentSessionId: null,
  sessionStartMs: null,

  admins: [],
  students: [],
  classes: [],
  streamingServers: (() => {
    const stored = localStorage.getItem('streamingServers');
    const parsed: StreamingServer[] = stored ? JSON.parse(stored) : [];
    if (parsed.length > 0) return parsed;
    const defaults: StreamingServer[] = [
      { id: 'ss-default-1', name: 'سرور محلی', url: 'http://localhost', port: 3001, description: 'سرور پیش‌فرض محلی', isActive: true, createdAt: new Date().toLocaleDateString('fa-IR') },
    ];
    localStorage.setItem('streamingServers', JSON.stringify(defaults));
    return defaults;
  })(),

  activeClassId: null,
  isClassLive: false,
  chatMessages: [],
  mediaItems: [],
  speakRequests: [],
  streamLayout: {
    gridSize: 4,
    currentPage: 0,
    autoRotate: false,
    rotateInterval: 5,
    activeItems: [],
  },
  isRecording: false,

  showChat: false,
  showSpeakPanel: false,
  alerts: [],
  studentReadyToJoin: false,
  currentAttendanceId: null,

  // ─── Login ──────────────────────────────────────────────────────────────
  login: async (role, code, password) => {
    set({ isConnecting: true });
    try {
      // Call API
      const data = await api<{
        token: string;
        isClassLive?: boolean;
        user: { id?: string; studentId?: string; classId?: string; name: string; role: string; className?: string };
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ role, code, password }),
      });

      const token = data.token;
      const user = data.user;

      // Fetch classes and students with the new token
      const [classes, students] = await Promise.all([
        api<ClassSession[]>('/api/classes', {}, token),
        api<Student[]>('/api/students', {}, token),
      ]);

      set({
        isLoggedIn: true,
        currentRole: role,
        currentUser: (user as any).name || (user as any).username || code,
        currentUserId: user.id || user.studentId || null,
        currentClassName: user.className || null,
        activeClassId: user.classId || null,
        authToken: token,
        classes,
        students,
        isConnecting: false,
        isClassLive: role === 'student' ? (data.isClassLive ?? false) : false,
      });

      // Connect socket and set up listeners
      try {
        await connectSocket();
        get()._setupSocketListeners();

        // If teacher or student, join their class room
        if (role === 'teacher' && user.classId) {
          emitJoinClass(user.classId, user.name, role);
        }
        if (role === 'student' && user.classId && user.studentId) {
          emitJoinClass(user.classId, user.studentId, role);
        }
      } catch {
        // Socket failure is non-fatal — API already connected
        console.warn('Socket connection to :3002 failed, continuing without real-time');
      }

      return { success: true };
    } catch (err: any) {
      set({ isConnecting: false });
      return { success: false, error: err.message || 'خطا در اتصال به سرور', field: err.field };
    }
  },

  // ─── Logout ─────────────────────────────────────────────────────────────
  logout: () => {
    const { activeClassId, currentUserId, currentRole, authToken } = get();

    // Leave socket room
    if (activeClassId && currentUserId && currentRole) {
      emitLeaveClass(activeClassId, currentUserId, currentRole);
    }
    offAllListeners();
    disconnectSocket();

    // Call API logout (fire and forget)
    if (authToken) {
      fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      }).catch(() => {});
    }

    set({
      currentRole: null,
      currentUser: null,
      currentUserId: null,
      currentClassName: null,
      isLoggedIn: false,
      authToken: null,
      activeClassId: null,
      isClassLive: false,
      chatMessages: [],
      mediaItems: [],
      speakRequests: [],
      isRecording: false,
      classes: [],
      students: [],
      studentReadyToJoin: false,
      currentAttendanceId: null,
    });
  },

  // ─── Socket Listeners Setup ──────────────────────────────────────────────
  _setupSocketListeners: () => {
    onStudentOnline(({ studentId }) => {
      set(s => ({
        students: s.students.map(st => st.id === studentId ? { ...st, isOnline: true } : st),
      }));
    });

    onStudentOffline(({ studentId }) => {
      set(s => ({
        students: s.students.map(st => st.id === studentId ? { ...st, isOnline: false } : st),
      }));
    });

    onClassOnlineUpdate(({ classId, onlineStudentCount }) => {
      set(s => ({
        classes: s.classes.map(c => c.id === classId ? { ...c, onlineStudentCount } : c),
      }));
    });

    onSpeakRequest(({ studentId, studentName, timestamp }) => {
      set(s => {
        const exists = s.speakRequests.some(r => r.studentId === studentId && r.status === 'pending');
        if (exists) return s;
        return {
          speakRequests: [...s.speakRequests, { studentId, studentName, timestamp, status: 'pending' }],
        };
      });
    });

    onSpeakApproved(({ studentId }) => {
      set(s => ({
        speakRequests: s.speakRequests.map(r =>
          r.studentId === studentId ? { ...r, status: 'approved' } : r
        ),
      }));
    });

    onSpeakRejected(({ studentId }) => {
      set(s => ({
        speakRequests: s.speakRequests.map(r =>
          r.studentId === studentId ? { ...r, status: 'rejected' } : r
        ),
      }));
    });

    onClassStarted(() => {
      set({ isClassLive: true });
    });

    onClassEnded(() => {
      const { currentRole } = get();
      set({ isClassLive: false, studentReadyToJoin: false });
      if (currentRole === 'student') {
        get().addAlert({
          type: 'warning',
          title: 'کلاس به پایان رسید',
          message: 'معلم کلاس را بست. به زودی از پنل خارج می‌شوید...',
          duration: 5000,
        });
        setTimeout(() => get().logout(), 5000);
      }
    });

    onStudentKicked(({ studentId }) => {
      const { currentUserId, currentRole } = get();
      // If this is the kicked student, logout
      if (currentRole === 'student' && currentUserId === studentId) {
        get().addAlert({ type: 'error', title: 'اخراج از کلاس', message: 'شما از کلاس اخراج شدید', duration: 8000, showTimer: true });
        setTimeout(() => get().logout(), 3000);
      }
    });

    onChatMessage((msg: ChatMessage) => {
      set(s => {
        // Avoid duplicate messages
        if (s.chatMessages.some(m => m.id === msg.id)) return s;
        return { chatMessages: [...s.chatMessages, msg] };
      });
    });
  },

  // ─── Admin: Class CRUD ───────────────────────────────────────────────────
  addClass: async (cls) => {
    const { authToken } = get();
    try {
      const newClass = await api<ClassSession>('/api/classes', {
        method: 'POST',
        body: JSON.stringify(cls),
      }, authToken);
      set(s => ({ classes: [...s.classes, newClass] }));
    } catch (err: any) {
      get().addAlert({ type: 'error', title: 'خطا', message: err.message, duration: 4000 });
    }
  },

  updateClass: async (id, data) => {
    const { authToken } = get();
    try {
      const updated = await api<ClassSession>(`/api/classes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }, authToken);
      // students را از DB برنمی‌گرداند — از state فعلی حفظ می‌کنیم
      set(s => ({ classes: s.classes.map(c => c.id === id ? { ...updated, students: c.students || [] } : c) }));
    } catch (err: any) {
      get().addAlert({ type: 'error', title: 'خطا', message: err.message, duration: 4000 });
    }
  },

  deleteClass: async (id) => {
    const { authToken } = get();
    try {
      await api(`/api/classes/${id}`, { method: 'DELETE' }, authToken);
      set(s => ({
        classes: s.classes.filter(c => c.id !== id),
        students: s.students.map(st => ({
          ...st,
          classIds: (st.classIds || []).filter(cid => cid !== id),
        })),
      }));
    } catch (err: any) {
      get().addAlert({ type: 'error', title: 'خطا', message: err.message, duration: 4000 });
    }
  },

  toggleClassActive: async (id) => {
    const { authToken } = get();
    try {
      const updated = await api<ClassSession>(`/api/classes/${id}/toggle-active`, { method: 'PATCH' }, authToken);
      set(s => ({ classes: s.classes.map(c => c.id === id ? updated : c) }));
    } catch (err: any) {
      get().addAlert({ type: 'error', title: 'خطا', message: err.message, duration: 4000 });
    }
  },

  // ─── Admin: Student CRUD ─────────────────────────────────────────────────
  addStudent: async (student) => {
    const { authToken } = get();
    try {
      const newStudent = await api<Student>('/api/students', {
        method: 'POST',
        body: JSON.stringify({ name: student.name, description: student.description }),
      }, authToken);
      // لینک کردن به کلاس‌ها در DB
      for (const classId of (student.classIds || [])) {
        await api(`/api/classes/${classId}/students`, {
          method: 'POST',
          body: JSON.stringify({ studentIds: [newStudent.id] }),
        }, authToken);
      }
      set(s => ({
        students: [...s.students, newStudent],
        classes: s.classes.map(c =>
          (student.classIds || []).includes(c.id)
            ? { ...c, students: [...c.students, newStudent.id] }
            : c
        ),
      }));
    } catch (err: any) {
      get().addAlert({ type: 'error', title: 'خطا', message: err.message, duration: 4000 });
    }
  },

  addStudentsToClass: async (classId, studentIds) => {
    const { authToken } = get();
    try {
      const updated = await api<ClassSession>(`/api/classes/${classId}/students`, {
        method: 'POST',
        body: JSON.stringify({ studentIds }),
      }, authToken);
      set(s => ({
        classes: s.classes.map(c => c.id === classId ? { ...c, students: updated.students } : c),
        students: s.students.map(st => studentIds.includes(st.id) ? {
          ...st,
          classIds: [...new Set([...(st.classIds || []), classId])],
        } : st),
      }));
    } catch (err: any) {
      get().addAlert({ type: 'error', title: 'خطا', message: err.message, duration: 4000 });
    }
  },

  removeStudentFromClass: async (classId, studentId) => {
    const { authToken } = get();
    try {
      await api(`/api/classes/${classId}/students/${studentId}`, { method: 'DELETE' }, authToken);
      set(s => ({
        classes: s.classes.map(c => c.id === classId ? {
          ...c, students: (c.students || []).filter(sid => sid !== studentId),
        } : c),
        students: s.students.map(st => st.id === studentId ? {
          ...st, classIds: (st.classIds || []).filter(cid => cid !== classId),
        } : st),
      }));
    } catch (err: any) {
      get().addAlert({ type: 'error', title: 'خطا', message: err.message, duration: 4000 });
    }
  },

  updateStudent: async (id, data) => {
    const { authToken } = get();
    try {
      const updated = await api<Student>(`/api/students/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }, authToken);
      set(s => ({ students: s.students.map(st => st.id === id ? updated : st) }));
    } catch (err: any) {
      get().addAlert({ type: 'error', title: 'خطا', message: err.message, duration: 4000 });
    }
  },

  deleteStudent: async (id) => {
    const { authToken } = get();
    try {
      await api(`/api/students/${id}`, { method: 'DELETE' }, authToken);
      set(s => ({
        students: s.students.filter(st => st.id !== id),
        classes: s.classes.map(c => ({ ...c, students: (c.students || []).filter(sid => sid !== id) })),
      }));
    } catch (err: any) {
      get().addAlert({ type: 'error', title: 'خطا', message: err.message, duration: 4000 });
    }
  },

  importStudents: (studentsData, classId) => {
    const { authToken } = get();
    studentsData.forEach(async (s) => {
      try {
        // ۱) ساخت دانش‌آموز در DB
        const newStudent = await api<Student>('/api/students', {
          method: 'POST',
          body: JSON.stringify({ name: s.name, description: s.description }),
        }, authToken);
        // ۲) لینک کردن به کلاس در DB
        await api(`/api/classes/${classId}/students`, {
          method: 'POST',
          body: JSON.stringify({ studentIds: [newStudent.id] }),
        }, authToken);
        // ۳) به‌روزرسانی state محلی
        set(state => ({
          students: [...state.students, newStudent],
          classes: state.classes.map(c => c.id === classId ? {
            ...c, students: [...c.students, newStudent.id],
          } : c),
        }));
      } catch {
        // silent — bulk import partial failures acceptable
      }
    });
  },

  kickStudent: async (studentId, classId, reason) => {
    const { authToken } = get();
    try {
      await api(`/api/classes/${classId}/kick/${studentId}`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }, authToken);
      // Socket broadcast is handled by server — local state update for immediate UI feedback
      set(s => ({
        students: s.students.map(st => st.id === studentId ? {
          ...st,
          isOnline: false,
          kickHistory: [...(st.kickHistory || []), {
            classId,
            className: s.classes.find(c => c.id === classId)?.name || '',
            teacherName: s.classes.find(c => c.id === classId)?.teacherName || '',
            joinTime: 'نامشخص',
            kickTime: new Date().toLocaleTimeString('fa-IR'),
            reason,
          }],
        } : st),
        classes: s.classes.map(c => c.id === classId ? {
          ...c, students: (c.students || []).filter(sid => sid !== studentId),
        } : c),
      }));
    } catch (err: any) {
      get().addAlert({ type: 'error', title: 'خطا', message: err.message, duration: 4000 });
    }
  },

  // ─── Class Session ───────────────────────────────────────────────────────
  startClass: async (classId) => {
    const { authToken } = get();
    const startMs = Date.now();

    // First confirm with backend that session is created
    let sessionId: string | null = null;
    try {
      const res = await api<{ sessionId: string }>(`/api/classes/${classId}/sessions/start`, { method: 'POST' }, authToken);
      sessionId = res.sessionId;
    } catch {
      // If API fails, still allow teacher in — session was created at login
    }

    emitClassStart(classId);

    set(s => ({
      activeClassId: classId,
      isClassLive: true,
      currentSessionId: sessionId,
      sessionStartMs: startMs,
      streamLayout: { ...s.streamLayout, activeItems: [], currentPage: 0 },
      chatMessages: [{
        id: `msg-${Date.now()}`,
        sender: 'سیستم',
        senderRole: 'admin',
        message: 'کلاس شروع شد. به همه خوش‌آمد می‌گوییم! 🎓',
        timestamp: new Date().toLocaleTimeString('fa-IR'),
        type: 'system',
      }],
    }));
  },

  endClass: async () => {
    const { activeClassId, currentSessionId, sessionStartMs, authToken } = get();
    if (activeClassId) emitClassEnd(activeClassId);
    if (currentSessionId && sessionStartMs && activeClassId) {
      const durationMin = Math.round((Date.now() - sessionStartMs) / 60000);
      try {
        await api(`/api/classes/${activeClassId}/sessions/${currentSessionId}/end`, {
          method: 'PUT',
          body: JSON.stringify({ duration: durationMin }),
        }, authToken);
      } catch {}
    }
    set(s => ({
      isClassLive: false,
      currentSessionId: null,
      sessionStartMs: null,
      chatMessages: [...s.chatMessages, {
        id: `msg-${Date.now()}`,
        sender: 'سیستم',
        senderRole: 'admin' as UserRole,
        message: 'کلاس به پایان رسید. خسته نباشید! 📚',
        timestamp: new Date().toLocaleTimeString('fa-IR'),
        type: 'system' as const,
      }],
      studentReadyToJoin: false,
    }));
  },

  // ─── Media ──────────────────────────────────────────────────────────────
  addMediaItem: (item) => set(s => ({
    mediaItems: [...s.mediaItems, { ...item, id: `media-${Date.now()}-${Math.random().toString(36).substr(2, 5)}` }],
  })),

  removeMediaItem: (id) => set(s => ({
    mediaItems: s.mediaItems.filter(m => m.id !== id),
    streamLayout: {
      ...s.streamLayout,
      activeItems: s.streamLayout.activeItems.filter(mid => mid !== id),
    },
  })),

  addToStream: (mediaId) => {
    const { activeClassId, mediaItems } = get();
    let newLayout: StreamLayout;
    set(s => {
      if (s.streamLayout.gridSize === 1) {
        newLayout = { ...s.streamLayout, activeItems: [mediaId], currentPage: 0 };
      } else {
        const already = s.streamLayout.activeItems.includes(mediaId);
        const newItems = already ? s.streamLayout.activeItems : [...s.streamLayout.activeItems, mediaId];
        const idx = newItems.indexOf(mediaId);
        const page = already ? s.streamLayout.currentPage : Math.floor(idx / s.streamLayout.gridSize);
        newLayout = { ...s.streamLayout, activeItems: newItems, currentPage: page };
      }
      return { streamLayout: newLayout };
    });
    if (activeClassId) emitStreamLayout(activeClassId, {
      activeItems: newLayout!.activeItems,
      mediaItems: mediaItems.map(m => ({ id: m.id, type: m.type, name: m.name, url: m.url })),
    });
  },

  removeFromStream: (mediaId) => {
    const { activeClassId, mediaItems } = get();
    let newItems: string[];
    set(s => {
      newItems = s.streamLayout.activeItems.filter(id => id !== mediaId);
      return { streamLayout: { ...s.streamLayout, activeItems: newItems } };
    });
    if (activeClassId) emitStreamLayout(activeClassId, {
      activeItems: newItems!,
      mediaItems: mediaItems.map(m => ({ id: m.id, type: m.type, name: m.name, url: m.url })),
    });
  },

  setGridSize: (size) => set(s => ({
    streamLayout: { ...s.streamLayout, gridSize: size, currentPage: 0 },
  })),

  // ─── Chat ────────────────────────────────────────────────────────────────
  sendMessage: (message) => {
    const { activeClassId, authToken } = get();
    const newMsg: ChatMessage = {
      ...message,
      id: `msg-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('fa-IR'),
    };

    // Update local state immediately
    set(s => ({ chatMessages: [...s.chatMessages, newMsg] }));

    // Persist to API (fire and forget — socket will broadcast to others)
    if (activeClassId && authToken) {
      api(`/api/classes/${activeClassId}/chat`, {
        method: 'POST',
        body: JSON.stringify({ message: message.message, type: message.type }),
      }, authToken).catch(() => {});
    }
  },

  // ─── Speak Requests ──────────────────────────────────────────────────────
  requestSpeak: (studentId, studentName) => {
    const { activeClassId } = get();
    if (activeClassId) {
      emitSpeakRequest(activeClassId, studentId, studentName);
    }
    set(s => ({
      speakRequests: [...s.speakRequests, {
        studentId,
        studentName,
        timestamp: new Date().toLocaleTimeString('fa-IR'),
        status: 'pending',
      }],
    }));
  },

  approveSpeakRequest: (studentId) => {
    const { activeClassId } = get();
    if (activeClassId) emitSpeakApprove(activeClassId, studentId);
    set(s => ({
      speakRequests: s.speakRequests.map(r =>
        r.studentId === studentId ? { ...r, status: 'approved' } : r
      ),
    }));
  },

  rejectSpeakRequest: (studentId) => {
    const { activeClassId } = get();
    if (activeClassId) emitSpeakReject(activeClassId, studentId);
    set(s => ({
      speakRequests: s.speakRequests.map(r =>
        r.studentId === studentId ? { ...r, status: 'rejected' } : r
      ),
    }));
  },

  clearAllSpeakRequests: () => set({ speakRequests: [] }),

  // ─── UI ──────────────────────────────────────────────────────────────────
  toggleChat: () => set(s => ({ showChat: !s.showChat })),
  toggleSpeakPanel: () => set(s => ({ showSpeakPanel: !s.showSpeakPanel })),
  setStudentReadyToJoin: (v) => set({ studentReadyToJoin: v }),
  setCurrentAttendanceId: (id) => set({ currentAttendanceId: id }),

  addAlert: (alert) => {
    const id = `alert-${Date.now()}`;
    set(s => ({ alerts: [...s.alerts, { ...alert, id }] }));
    if (alert.duration) {
      setTimeout(() => {
        set(s => ({ alerts: s.alerts.filter(a => a.id !== id) }));
      }, alert.duration);
    }
    return id;
  },

  removeAlert: (id) => set(s => ({
    alerts: s.alerts.filter(a => a.id !== id),
  })),

  // ─── Admin Management ────────────────────────────────────────────────────
  addAdmin: (admin) => set(s => ({
    admins: [...s.admins, {
      ...admin,
      id: `admin-${Date.now()}`,
      createdAt: new Date().toLocaleDateString('fa-IR'),
    }],
  })),

  deleteAdmin: (id) => set(s => ({
    admins: s.admins.filter(a => a.id !== id && a.id !== 'admin-1'),
  })),

  // ─── Streaming Servers ───────────────────────────────────────────────────
  addStreamingServer: (server) => set(s => {
    const newServer: StreamingServer = {
      ...server,
      id: `ss-${Date.now()}`,
      createdAt: new Date().toLocaleDateString('fa-IR'),
    };
    const updated = [...s.streamingServers, newServer];
    localStorage.setItem('streamingServers', JSON.stringify(updated));
    return { streamingServers: updated };
  }),

  updateStreamingServer: (id, data) => set(s => {
    const updated = s.streamingServers.map(sv => sv.id === id ? { ...sv, ...data } : sv);
    localStorage.setItem('streamingServers', JSON.stringify(updated));
    return { streamingServers: updated };
  }),

  deleteStreamingServer: (id) => set(s => {
    const updated = s.streamingServers.filter(sv => sv.id !== id);
    localStorage.setItem('streamingServers', JSON.stringify(updated));
    return { streamingServers: updated };
  }),
}));
