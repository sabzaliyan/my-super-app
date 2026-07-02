/**
 * Socket Manager - ارتباط real-time با سرور :3002
 * رویدادهای کلاس، چت، درخواست صحبت، اخراج
 */

import { io, Socket } from 'socket.io-client';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3002';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(): Promise<Socket> {
  return new Promise((resolve, reject) => {
    if (socket?.connected) {
      resolve(socket);
      return;
    }

    socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('✅ Socket connected to API :3002');
      resolve(socket!);
    });

    socket.on('connect_error', (err) => {
      console.warn('⚠️ Socket connection failed:', err.message);
      reject(err);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
    });
  });
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function emitJoinClass(classId: string, userId: string, role: string) {
  socket?.emit('join:class', { classId, userId, role });
}

export function emitLeaveClass(classId: string, userId: string, role: string) {
  socket?.emit('leave:class', { classId, userId, role });
}

export function emitClassStart(classId: string) {
  socket?.emit('class:start', { classId });
}

export function emitClassEnd(classId: string) {
  socket?.emit('class:end', { classId });
}

export function emitSpeakRequest(classId: string, studentId: string, studentName: string) {
  socket?.emit('speak:request', { classId, studentId, studentName });
}

export function emitSpeakApprove(classId: string, studentId: string) {
  socket?.emit('speak:approve', { classId, studentId });
}

export function emitSpeakReject(classId: string, studentId: string) {
  socket?.emit('speak:reject', { classId, studentId });
}

export function onStudentOnline(cb: (data: { studentId: string }) => void) {
  socket?.on('student:online', cb);
}

export function onStudentOffline(cb: (data: { studentId: string }) => void) {
  socket?.on('student:offline', cb);
}

export function onSpeakRequest(cb: (data: { studentId: string; studentName: string; timestamp: string }) => void) {
  socket?.on('speak:request', cb);
}

export function onSpeakApproved(cb: (data: { studentId: string }) => void) {
  socket?.on('speak:approved', cb);
}

export function onSpeakRejected(cb: (data: { studentId: string }) => void) {
  socket?.on('speak:rejected', cb);
}

export function onClassStarted(cb: (data: { timestamp: string }) => void) {
  socket?.on('class:started', cb);
}

export function onClassEnded(cb: (data: { timestamp: string }) => void) {
  socket?.on('class:ended', cb);
}

export function onStudentKicked(cb: (data: { studentId: string; reason: string }) => void) {
  socket?.on('student:kicked', cb);
}

export function onChatMessage(cb: (data: any) => void) {
  socket?.on('chat:message', cb);
}

export function onClassUpdated(cb: (data: any) => void) {
  socket?.on('class:updated', cb);
}

export function onStudentUpdated(cb: (data: any) => void) {
  socket?.on('student:updated', cb);
}

// Stream layout sync (teacher → students)
export function emitStreamLayout(classId: string, data: { activeItems: string[]; mediaItems: any[] }) {
  socket?.emit('stream:layout', { classId, ...data });
}
export function onStreamLayout(cb: (data: { activeItems: string[]; mediaItems: any[] }) => void) {
  socket?.on('stream:layout', cb);
}

// WebRTC signaling
export function emitWebRTCRequest(classId: string) {
  socket?.emit('webrtc:request', { classId });
}
export function onWebRTCRequest(cb: (data: { studentSocketId: string }) => void) {
  socket?.off('webrtc:request').on('webrtc:request', cb);
}

// Student → Teacher WebRTC
export function emitStudentOffer(classId: string, offer: RTCSessionDescriptionInit, studentId: string) {
  socket?.emit('webrtc:student-offer', { classId, offer, studentId });
}
export function emitStudentAnswer(classId: string, answer: RTCSessionDescriptionInit, studentId: string) {
  socket?.emit('webrtc:student-answer', { classId, answer, studentId });
}
export function emitStudentIce(classId: string, candidate: RTCIceCandidateInit, studentId: string) {
  socket?.emit('webrtc:student-ice', { classId, candidate, studentId });
}
export function onStudentOffer(cb: (data: { offer: RTCSessionDescriptionInit; studentId: string }) => void) {
  socket?.off('webrtc:student-offer').on('webrtc:student-offer', cb);
}
export function onStudentAnswer(cb: (data: { answer: RTCSessionDescriptionInit; studentId: string }) => void) {
  socket?.off('webrtc:student-answer').on('webrtc:student-answer', cb);
}
export function onStudentIce(cb: (data: { candidate: RTCIceCandidateInit; studentId: string }) => void) {
  socket?.off('webrtc:student-ice').on('webrtc:student-ice', cb);
}
export function emitWebRTCOffer(classId: string, offer: RTCSessionDescriptionInit, targetSocketId: string) {
  socket?.emit('webrtc:offer', { classId, offer, targetSocketId });
}
export function emitWebRTCAnswer(classId: string, answer: RTCSessionDescriptionInit) {
  socket?.emit('webrtc:answer', { classId, answer });
}
export function emitWebRTCIce(classId: string, candidate: RTCIceCandidateInit, role: string, targetSocketId?: string) {
  socket?.emit('webrtc:ice', { classId, candidate, role, targetSocketId });
}
export function onWebRTCOffer(cb: (data: { offer: RTCSessionDescriptionInit }) => void) {
  socket?.off('webrtc:offer').on('webrtc:offer', cb);
}
export function onWebRTCAnswer(cb: (data: { answer: RTCSessionDescriptionInit; studentSocketId: string }) => void) {
  socket?.off('webrtc:answer').on('webrtc:answer', cb);
}
export function onWebRTCIce(cb: (data: { candidate: RTCIceCandidateInit; role?: string; studentSocketId?: string }) => void) {
  socket?.off('webrtc:ice').on('webrtc:ice', cb);
}

export function onClassOnlineUpdate(cb: (data: { classId: string; onlineStudentCount: number }) => void) {
  socket?.off('class:online:update').on('class:online:update', cb);
}

export function offAllListeners() {
  if (!socket) return;
  ['student:online','student:offline','speak:request','speak:approved','speak:rejected',
   'class:started','class:ended','student:kicked','chat:message','class:updated','student:updated',
   'stream:layout','webrtc:offer','webrtc:answer','webrtc:ice','class:online:update']
    .forEach(event => socket?.off(event));
}
