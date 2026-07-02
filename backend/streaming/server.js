/**
 * ═══════════════════════════════════════════════════════════════════
 * 📹 GlassClass Streaming Server
 * سرور WebRTC SFU با استفاده از mediasoup
 * ═══════════════════════════════════════════════════════════════════
 */

const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const mediasoup = require('mediasoup');
const { v4: uuidv4 } = require('uuid');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;
const LISTEN_IP = process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0';
const ANNOUNCED_IP = process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1';
const RTC_MIN_PORT = parseInt(process.env.RTC_MIN_PORT || '40000');
const RTC_MAX_PORT = parseInt(process.env.RTC_MAX_PORT || '40100');

// ═══════════════════════════════════════════════════════════════════
// Middleware
// ═══════════════════════════════════════════════════════════════════
app.use(cors());
app.use(express.json());

// ═══════════════════════════════════════════════════════════════════
// Mediasoup Configuration
// ═══════════════════════════════════════════════════════════════════
const mediasoupConfig = {
  worker: {
    rtcMinPort: RTC_MIN_PORT,
    rtcMaxPort: RTC_MAX_PORT,
    logLevel: 'warn',
    logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp']
  },
  router: {
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 1000
        }
      },
      {
        kind: 'video',
        mimeType: 'video/VP9',
        clockRate: 90000,
        parameters: {
          'profile-id': 2,
          'x-google-start-bitrate': 1000
        }
      },
      {
        kind: 'video',
        mimeType: 'video/H264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '42e01f',
          'level-asymmetry-allowed': 1,
          'x-google-start-bitrate': 1000
        }
      }
    ]
  },
  webRtcTransport: {
    listenIps: [
      { ip: LISTEN_IP, announcedIp: ANNOUNCED_IP }
    ],
    maxIncomingBitrate: 1500000,
    initialAvailableOutgoingBitrate: 1000000
  }
};

// ═══════════════════════════════════════════════════════════════════
// State Management
// ═══════════════════════════════════════════════════════════════════
let worker;
const rooms = new Map(); // roomId -> { router, peers }
const peers = new Map(); // peerId -> { socket, roomId, transports, producers, consumers }

// ═══════════════════════════════════════════════════════════════════
// Initialize Mediasoup Worker
// ═══════════════════════════════════════════════════════════════════
async function initializeMediasoup() {
  worker = await mediasoup.createWorker(mediasoupConfig.worker);
  
  worker.on('died', () => {
    console.error('mediasoup worker died, exiting...');
    process.exit(1);
  });
  
  console.log('✅ Mediasoup worker created');
  return worker;
}

// ═══════════════════════════════════════════════════════════════════
// Room Management
// ═══════════════════════════════════════════════════════════════════
async function getOrCreateRoom(roomId) {
  if (rooms.has(roomId)) {
    return rooms.get(roomId);
  }
  
  const router = await worker.createRouter({
    mediaCodecs: mediasoupConfig.router.mediaCodecs
  });
  
  const room = {
    id: roomId,
    router,
    peers: new Map()
  };
  
  rooms.set(roomId, room);
  console.log(`📹 Room created: ${roomId}`);
  return room;
}

async function createWebRtcTransport(router) {
  const transport = await router.createWebRtcTransport(mediasoupConfig.webRtcTransport);
  
  transport.on('dtlsstatechange', (dtlsState) => {
    if (dtlsState === 'closed') {
      transport.close();
    }
  });
  
  return {
    transport,
    params: {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters
    }
  };
}

// ═══════════════════════════════════════════════════════════════════
// Health Check
// ═══════════════════════════════════════════════════════════════════
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'streaming',
    worker: worker ? 'running' : 'not started',
    rooms: rooms.size,
    peers: peers.size,
    timestamp: new Date().toISOString()
  });
});

// ═══════════════════════════════════════════════════════════════════
// REST API
// ═══════════════════════════════════════════════════════════════════
app.get('/api/rooms', (req, res) => {
  const roomList = [];
  rooms.forEach((room, id) => {
    roomList.push({
      id,
      peersCount: room.peers.size
    });
  });
  res.json(roomList);
});

app.get('/api/rooms/:roomId', (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  const peersList = [];
  room.peers.forEach((peer, peerId) => {
    peersList.push({
      id: peerId,
      producers: peer.producers.size,
      consumers: peer.consumers.size
    });
  });
  
  res.json({
    id: room.id,
    peers: peersList
  });
});

// ═══════════════════════════════════════════════════════════════════
// Socket.IO Signaling
// ═══════════════════════════════════════════════════════════════════
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  
  const peer = {
    id: socket.id,
    socket,
    roomId: null,
    transports: new Map(),
    producers: new Map(),
    consumers: new Map()
  };
  peers.set(socket.id, peer);
  
  // ─────────────────────────────────────────────────────────────────
  // Join Room
  // ─────────────────────────────────────────────────────────────────
  socket.on('joinRoom', async ({ roomId, userId, userName, role }, callback) => {
    try {
      const room = await getOrCreateRoom(roomId);
      peer.roomId = roomId;
      peer.userId = userId;
      peer.userName = userName;
      peer.role = role;
      room.peers.set(socket.id, peer);
      
      socket.join(roomId);
      
      // Get router RTP capabilities
      const rtpCapabilities = room.router.rtpCapabilities;
      
      // Notify others
      socket.to(roomId).emit('peerJoined', {
        peerId: socket.id,
        userId,
        userName,
        role
      });
      
      callback({
        rtpCapabilities,
        peers: Array.from(room.peers.values())
          .filter(p => p.id !== socket.id)
          .map(p => ({
            peerId: p.id,
            userId: p.userId,
            userName: p.userName,
            role: p.role
          }))
      });
      
      console.log(`👤 ${userName} (${role}) joined room ${roomId}`);
    } catch (error) {
      console.error('joinRoom error:', error);
      callback({ error: error.message });
    }
  });
  
  // ─────────────────────────────────────────────────────────────────
  // Create Transport
  // ─────────────────────────────────────────────────────────────────
  socket.on('createTransport', async ({ direction }, callback) => {
    try {
      const room = rooms.get(peer.roomId);
      if (!room) throw new Error('Room not found');
      
      const { transport, params } = await createWebRtcTransport(room.router);
      
      peer.transports.set(transport.id, { transport, direction });
      
      callback(params);
    } catch (error) {
      console.error('createTransport error:', error);
      callback({ error: error.message });
    }
  });
  
  // ─────────────────────────────────────────────────────────────────
  // Connect Transport
  // ─────────────────────────────────────────────────────────────────
  socket.on('connectTransport', async ({ transportId, dtlsParameters }, callback) => {
    try {
      const transportData = peer.transports.get(transportId);
      if (!transportData) throw new Error('Transport not found');
      
      await transportData.transport.connect({ dtlsParameters });
      
      callback({ success: true });
    } catch (error) {
      console.error('connectTransport error:', error);
      callback({ error: error.message });
    }
  });
  
  // ─────────────────────────────────────────────────────────────────
  // Produce (Send media)
  // ─────────────────────────────────────────────────────────────────
  socket.on('produce', async ({ transportId, kind, rtpParameters, appData }, callback) => {
    try {
      const transportData = peer.transports.get(transportId);
      if (!transportData) throw new Error('Transport not found');
      
      const producer = await transportData.transport.produce({
        kind,
        rtpParameters,
        appData
      });
      
      peer.producers.set(producer.id, producer);
      
      producer.on('transportclose', () => {
        producer.close();
        peer.producers.delete(producer.id);
      });
      
      // Notify others about new producer
      socket.to(peer.roomId).emit('newProducer', {
        producerId: producer.id,
        peerId: socket.id,
        kind,
        appData
      });
      
      callback({ producerId: producer.id });
    } catch (error) {
      console.error('produce error:', error);
      callback({ error: error.message });
    }
  });
  
  // ─────────────────────────────────────────────────────────────────
  // Consume (Receive media)
  // ─────────────────────────────────────────────────────────────────
  socket.on('consume', async ({ producerId, rtpCapabilities }, callback) => {
    try {
      const room = rooms.get(peer.roomId);
      if (!room) throw new Error('Room not found');
      
      // Find producer
      let producer;
      for (const [, p] of room.peers) {
        if (p.producers.has(producerId)) {
          producer = p.producers.get(producerId);
          break;
        }
      }
      if (!producer) throw new Error('Producer not found');
      
      // Check if can consume
      if (!room.router.canConsume({ producerId, rtpCapabilities })) {
        throw new Error('Cannot consume');
      }
      
      // Find receive transport
      let receiveTransport;
      for (const [, t] of peer.transports) {
        if (t.direction === 'receive') {
          receiveTransport = t.transport;
          break;
        }
      }
      if (!receiveTransport) throw new Error('Receive transport not found');
      
      const consumer = await receiveTransport.consume({
        producerId,
        rtpCapabilities,
        paused: true
      });
      
      peer.consumers.set(consumer.id, consumer);
      
      consumer.on('transportclose', () => {
        consumer.close();
        peer.consumers.delete(consumer.id);
      });
      
      consumer.on('producerclose', () => {
        socket.emit('consumerClosed', { consumerId: consumer.id });
        consumer.close();
        peer.consumers.delete(consumer.id);
      });
      
      callback({
        consumerId: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters
      });
    } catch (error) {
      console.error('consume error:', error);
      callback({ error: error.message });
    }
  });
  
  // ─────────────────────────────────────────────────────────────────
  // Resume Consumer
  // ─────────────────────────────────────────────────────────────────
  socket.on('resumeConsumer', async ({ consumerId }, callback) => {
    try {
      const consumer = peer.consumers.get(consumerId);
      if (!consumer) throw new Error('Consumer not found');
      
      await consumer.resume();
      callback({ success: true });
    } catch (error) {
      console.error('resumeConsumer error:', error);
      callback({ error: error.message });
    }
  });
  
  // ─────────────────────────────────────────────────────────────────
  // Pause/Resume Producer
  // ─────────────────────────────────────────────────────────────────
  socket.on('pauseProducer', async ({ producerId }, callback) => {
    try {
      const producer = peer.producers.get(producerId);
      if (producer) await producer.pause();
      callback({ success: true });
    } catch (error) {
      callback({ error: error.message });
    }
  });
  
  socket.on('resumeProducer', async ({ producerId }, callback) => {
    try {
      const producer = peer.producers.get(producerId);
      if (producer) await producer.resume();
      callback({ success: true });
    } catch (error) {
      callback({ error: error.message });
    }
  });
  
  // ─────────────────────────────────────────────────────────────────
  // Disconnect
  // ─────────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
    
    // Clean up transports
    for (const [, t] of peer.transports) {
      t.transport.close();
    }
    
    // Remove from room
    if (peer.roomId) {
      const room = rooms.get(peer.roomId);
      if (room) {
        room.peers.delete(socket.id);
        
        // Notify others
        socket.to(peer.roomId).emit('peerLeft', {
          peerId: socket.id,
          userId: peer.userId
        });
        
        // Clean up empty room
        if (room.peers.size === 0) {
          room.router.close();
          rooms.delete(peer.roomId);
          console.log(`📹 Room closed: ${peer.roomId}`);
        }
      }
    }
    
    peers.delete(socket.id);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Start Server
// ═══════════════════════════════════════════════════════════════════
async function start() {
  try {
    await initializeMediasoup();
    
    httpServer.listen(PORT, () => {
      console.log(`
  ╔═══════════════════════════════════════════════════════════════════╗
  ║                                                                   ║
  ║   📹 GlassClass Streaming Server                                  ║
  ║                                                                   ║
  ║   Port: ${PORT}                                                      ║
  ║   Health: http://localhost:${PORT}/health                            ║
  ║   WebRTC IP: ${ANNOUNCED_IP}                                       ║
  ║   UDP Ports: 40000-40100                                          ║
  ║                                                                   ║
  ╚═══════════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
