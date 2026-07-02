/**
 * ═══════════════════════════════════════════════════════════════════
 * 🔌 GlassClass API Service
 * اتصال به سرور API برای مدیریت داده‌ها
 * ═══════════════════════════════════════════════════════════════════
 */

const API_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) || 'http://localhost:3002';

// Token Management
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

// ═══════════════════════════════════════════════════════════════════
// HTTP Client
// ═══════════════════════════════════════════════════════════════════
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (authToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'خطای ناشناخته' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// ═══════════════════════════════════════════════════════════════════
// Auth API
// ═══════════════════════════════════════════════════════════════════
export interface LoginResponse {
  token: string;
  user: {
    id?: string;
    studentId?: string;
    classId?: string;
    name: string;
    role: 'admin' | 'teacher' | 'student';
    className?: string;
  };
}

export async function login(
  role: 'admin' | 'teacher' | 'student',
  code: string,
  password: string
): Promise<LoginResponse> {
  const data = await request<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ role, code, password }),
  });
  setAuthToken(data.token);
  return data;
}

export async function logout(): Promise<void> {
  try {
    await request('/api/auth/logout', { method: 'POST' });
  } finally {
    setAuthToken(null);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Classes API
// ═══════════════════════════════════════════════════════════════════
export interface ClassData {
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
  students: string[];
  sessionHistory: any[];
}

export async function getClasses(): Promise<ClassData[]> {
  return request<ClassData[]>('/api/classes');
}

export async function getClass(id: string): Promise<ClassData> {
  return request<ClassData>(`/api/classes/${id}`);
}

export async function createClass(data: Partial<ClassData>): Promise<ClassData> {
  return request<ClassData>('/api/classes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateClass(id: string, data: Partial<ClassData>): Promise<ClassData> {
  return request<ClassData>(`/api/classes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteClass(id: string): Promise<void> {
  await request(`/api/classes/${id}`, { method: 'DELETE' });
}

export async function toggleClassActive(id: string): Promise<ClassData> {
  return request<ClassData>(`/api/classes/${id}/toggle-active`, {
    method: 'PATCH',
  });
}

// ═══════════════════════════════════════════════════════════════════
// Students API
// ═══════════════════════════════════════════════════════════════════
export interface StudentData {
  id: string;
  name: string;
  description: string;
  password: string;
  isOnline: boolean;
  classIds: string[];
  cameraEnabled: boolean;
  micEnabled: boolean;
  kickHistory: any[];
}

export async function getStudents(): Promise<StudentData[]> {
  return request<StudentData[]>('/api/students');
}

export async function getClassStudents(classId: string): Promise<StudentData[]> {
  return request<StudentData[]>(`/api/classes/${classId}/students`);
}

export async function createStudent(data: Partial<StudentData>): Promise<StudentData> {
  return request<StudentData>('/api/students', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateStudent(id: string, data: Partial<StudentData>): Promise<StudentData> {
  return request<StudentData>(`/api/students/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteStudent(id: string): Promise<void> {
  await request(`/api/students/${id}`, { method: 'DELETE' });
}

export async function addStudentsToClass(classId: string, studentIds: string[]): Promise<void> {
  await request(`/api/classes/${classId}/students`, {
    method: 'POST',
    body: JSON.stringify({ studentIds }),
  });
}

export async function removeStudentFromClass(classId: string, studentId: string): Promise<void> {
  await request(`/api/classes/${classId}/students/${studentId}`, {
    method: 'DELETE',
  });
}

export async function kickStudent(classId: string, studentId: string, reason: string): Promise<void> {
  await request(`/api/classes/${classId}/kick/${studentId}`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

// ═══════════════════════════════════════════════════════════════════
// Chat API
// ═══════════════════════════════════════════════════════════════════
export interface ChatMessage {
  id: string;
  classId: string;
  sender: string;
  senderRole: string;
  message: string;
  timestamp: string;
  type: 'text' | 'sticker' | 'system';
}

export async function getChatMessages(classId: string): Promise<ChatMessage[]> {
  return request<ChatMessage[]>(`/api/classes/${classId}/chat`);
}

export async function sendChatMessage(classId: string, message: string, type = 'text'): Promise<ChatMessage> {
  return request<ChatMessage>(`/api/classes/${classId}/chat`, {
    method: 'POST',
    body: JSON.stringify({ message, type }),
  });
}

// ═══════════════════════════════════════════════════════════════════
// Backup API
// ═══════════════════════════════════════════════════════════════════
export interface BackupData {
  timestamp: string;
  admins: any[];
  students: StudentData[];
  classes: ClassData[];
  chatMessages: ChatMessage[];
}

export async function getBackup(): Promise<BackupData> {
  return request<BackupData>('/api/backup');
}

export async function restoreBackup(data: Partial<BackupData>): Promise<void> {
  await request('/api/restore', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ═══════════════════════════════════════════════════════════════════
// Health Check
// ═══════════════════════════════════════════════════════════════════
export async function checkHealth(): Promise<{ status: string; service: string }> {
  return request('/health');
}
