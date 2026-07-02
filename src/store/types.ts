export type UserRole = 'admin' | 'teacher' | 'student';

export interface StreamingServer {
  id: string;
  name: string;
  url: string;
  port: number;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Admin {
  id: string;
  username: string;
  password: string;
  name: string;
  createdAt: string;
}

export interface Student {
  id: string;
  name: string;
  description: string;
  password: string;
  isOnline: boolean;
  classIds: string[];
  cameraEnabled: boolean;
  micEnabled: boolean;
  kickHistory: KickRecord[];
}

export interface KickRecord {
  classId: string;
  className: string;
  teacherName: string;
  joinTime: string;
  kickTime: string;
  reason: string;
}

export interface ClassSession {
  id: string;
  code: string;
  name: string;
  teacherName: string;
  teacherPassword: string;
  courseName: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  scheduleDays: string[];
  capacity: number;
  isActive: boolean;
  totalHours: number;
  usedHours: number;
  streamingServerId: string | null;
  students: string[];
  sessionHistory: SessionRecord[];
  isLive?: boolean;
  onlineStudentCount?: number;
  sessionCount?: number;
}

export interface SessionRecord {
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  attendees: string[];
  chatLog: ChatMessage[];
  recordings: string[];
}

export interface ChatMessage {
  id: string;
  sender: string;
  senderRole: UserRole;
  message: string;
  timestamp: string;
  type: 'text' | 'sticker' | 'system';
}

export interface MediaItem {
  id: string;
  type: 'camera' | 'video' | 'youtube' | 'screen' | 'whiteboard' | 'slideshow' | 'audio';
  name: string;
  url?: string;
  file?: string;
  isActive: boolean;
  owner?: string;
}

export interface SpeakRequest {
  studentId: string;
  studentName: string;
  timestamp: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface StreamLayout {
  gridSize: 1 | 2 | 3 | 4 | 9 | 16;
  currentPage: number;
  autoRotate: boolean;
  rotateInterval: number;
  activeItems: string[];
}
