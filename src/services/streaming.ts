/**
 * ═══════════════════════════════════════════════════════════════════
 * 📹 GlassClass Streaming Service
 * اتصال به سرور WebRTC برای استریم ویدیو
 * ═══════════════════════════════════════════════════════════════════
 */

import { io, Socket } from 'socket.io-client';

const STREAMING_URL = 'http://localhost:3001';

let socket: Socket | null = null;
let sendTransport: any = null;
let recvTransport: any = null;
let producers: Map<string, any> = new Map();
let consumers: Map<string, any> = new Map();

// ═══════════════════════════════════════════════════════════════════
// Connection Management
// ═══════════════════════════════════════════════════════════════════
export function connect(): Promise<Socket> {
  return new Promise((resolve, reject) => {
    if (socket?.connected) {
      resolve(socket);
      return;
    }

    socket = io(STREAMING_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('📹 Connected to streaming server');
      resolve(socket!);
    });

    socket.on('connect_error', (error) => {
      console.error('📹 Connection error:', error);
      reject(error);
    });

    socket.on('disconnect', (reason) => {
      console.log('📹 Disconnected:', reason);
    });
  });
}

export function disconnect() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  cleanup();
}

export function getSocket(): Socket | null {
  return socket;
}

// ═══════════════════════════════════════════════════════════════════
// Room Management
// ═══════════════════════════════════════════════════════════════════
export interface JoinRoomParams {
  roomId: string;
  userId: string;
  userName: string;
  role: 'teacher' | 'student';
}

export interface JoinRoomResult {
  rtpCapabilities: any;
  peers: Array<{
    peerId: string;
    userId: string;
    userName: string;
    role: string;
  }>;
}

export function joinRoom(params: JoinRoomParams): Promise<JoinRoomResult> {
  return new Promise((resolve, reject) => {
    if (!socket) {
      reject(new Error('Not connected to streaming server'));
      return;
    }

    socket.emit('joinRoom', params, (response: any) => {
      if (response.error) {
        reject(new Error(response.error));
      } else {
        resolve(response);
      }
    });
  });
}

export function leaveRoom(roomId: string, userId: string, role: string) {
  if (socket) {
    socket.emit('leave:class', { classId: roomId, userId, role });
  }
  cleanup();
}

// ═══════════════════════════════════════════════════════════════════
// Transport Management
// ═══════════════════════════════════════════════════════════════════
export function createSendTransport(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!socket) {
      reject(new Error('Not connected'));
      return;
    }

    socket.emit('createTransport', { direction: 'send' }, (params: any) => {
      if (params.error) {
        reject(new Error(params.error));
      } else {
        resolve(params);
      }
    });
  });
}

export function createRecvTransport(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!socket) {
      reject(new Error('Not connected'));
      return;
    }

    socket.emit('createTransport', { direction: 'receive' }, (params: any) => {
      if (params.error) {
        reject(new Error(params.error));
      } else {
        resolve(params);
      }
    });
  });
}

export function connectTransport(transportId: string, dtlsParameters: any): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!socket) {
      reject(new Error('Not connected'));
      return;
    }

    socket.emit('connectTransport', { transportId, dtlsParameters }, (response: any) => {
      if (response.error) {
        reject(new Error(response.error));
      } else {
        resolve();
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// Produce (Send Media)
// ═══════════════════════════════════════════════════════════════════
export interface ProduceParams {
  transportId: string;
  kind: 'audio' | 'video';
  rtpParameters: any;
  appData?: any;
}

export function produce(params: ProduceParams): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!socket) {
      reject(new Error('Not connected'));
      return;
    }

    socket.emit('produce', params, (response: any) => {
      if (response.error) {
        reject(new Error(response.error));
      } else {
        resolve(response.producerId);
      }
    });
  });
}

export function pauseProducer(producerId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!socket) {
      reject(new Error('Not connected'));
      return;
    }

    socket.emit('pauseProducer', { producerId }, (response: any) => {
      if (response.error) {
        reject(new Error(response.error));
      } else {
        resolve();
      }
    });
  });
}

export function resumeProducer(producerId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!socket) {
      reject(new Error('Not connected'));
      return;
    }

    socket.emit('resumeProducer', { producerId }, (response: any) => {
      if (response.error) {
        reject(new Error(response.error));
      } else {
        resolve();
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// Consume (Receive Media)
// ═══════════════════════════════════════════════════════════════════
export interface ConsumeParams {
  producerId: string;
  rtpCapabilities: any;
}

export interface ConsumeResult {
  consumerId: string;
  producerId: string;
  kind: 'audio' | 'video';
  rtpParameters: any;
}

export function consume(params: ConsumeParams): Promise<ConsumeResult> {
  return new Promise((resolve, reject) => {
    if (!socket) {
      reject(new Error('Not connected'));
      return;
    }

    socket.emit('consume', params, (response: any) => {
      if (response.error) {
        reject(new Error(response.error));
      } else {
        resolve(response);
      }
    });
  });
}

export function resumeConsumer(consumerId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!socket) {
      reject(new Error('Not connected'));
      return;
    }

    socket.emit('resumeConsumer', { consumerId }, (response: any) => {
      if (response.error) {
        reject(new Error(response.error));
      } else {
        resolve();
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// Event Listeners
// ═══════════════════════════════════════════════════════════════════
export function onPeerJoined(callback: (data: any) => void) {
  socket?.on('peerJoined', callback);
}

export function onPeerLeft(callback: (data: any) => void) {
  socket?.on('peerLeft', callback);
}

export function onNewProducer(callback: (data: any) => void) {
  socket?.on('newProducer', callback);
}

export function onConsumerClosed(callback: (data: any) => void) {
  socket?.on('consumerClosed', callback);
}

export function onClassStarted(callback: (data: any) => void) {
  socket?.on('class:started', callback);
}

export function onClassEnded(callback: (data: any) => void) {
  socket?.on('class:ended', callback);
}

export function onStudentKicked(callback: (data: any) => void) {
  socket?.on('student:kicked', callback);
}

export function onSpeakRequest(callback: (data: any) => void) {
  socket?.on('speak:request', callback);
}

export function onSpeakApproved(callback: (data: any) => void) {
  socket?.on('speak:approved', callback);
}

export function onSpeakRejected(callback: (data: any) => void) {
  socket?.on('speak:rejected', callback);
}

// ═══════════════════════════════════════════════════════════════════
// Emit Events
// ═══════════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════════
// Cleanup
// ═══════════════════════════════════════════════════════════════════
function cleanup() {
  producers.forEach(producer => producer.close?.());
  consumers.forEach(consumer => consumer.close?.());
  sendTransport?.close?.();
  recvTransport?.close?.();
  
  producers.clear();
  consumers.clear();
  sendTransport = null;
  recvTransport = null;
}

// ═══════════════════════════════════════════════════════════════════
// Health Check
// ═══════════════════════════════════════════════════════════════════
export async function checkStreamingHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${STREAMING_URL}/health`);
    const data = await response.json();
    return data.status === 'ok';
  } catch {
    return false;
  }
}
