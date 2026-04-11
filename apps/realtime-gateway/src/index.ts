import { Server } from 'socket.io';
import { createServer } from 'http';
import { createHmac } from 'crypto';
import Redis from 'ioredis';

const http = createServer();
const io = new Server(http, { cors: { origin: '*' }, transports: ['websocket', 'polling'] });
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const sub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const jwtSecret = process.env.JWT_SECRET || 'change-me-in-production-min-32-chars!!';

type JwtPayload = {
  sub?: string;
  role?: string;
  exp?: number;
};

function decodeBase64Url(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function verifyToken(token: string): JwtPayload {
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) {
    throw new Error('Malformed token');
  }

  const expectedSignature = createHmac('sha256', jwtSecret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  if (signature !== expectedSignature) {
    throw new Error('Invalid token signature');
  }

  const decodedPayload = JSON.parse(decodeBase64Url(payload)) as JwtPayload;
  if (!decodedPayload.sub) {
    throw new Error('Token subject missing');
  }

  if (decodedPayload.exp && decodedPayload.exp * 1000 <= Date.now()) {
    throw new Error('Token expired');
  }

  return decodedPayload;
}

function extractToken(rawToken: unknown) {
  if (typeof rawToken !== 'string' || rawToken.trim().length === 0) {
    throw new Error('Auth required');
  }

  return rawToken.startsWith('Bearer ') ? rawToken.slice(7) : rawToken;
}

io.use(async (socket, next) => {
  try {
    const payload = verifyToken(extractToken(socket.handshake.auth?.token));
    socket.data.userId = payload.sub;
    socket.data.role = payload.role;
    next();
  } catch (error) {
    next(new Error(error instanceof Error ? error.message : 'Invalid token'));
  }
});

io.on('connection', (socket) => {
  const uid = socket.data.userId;
  console.log(`[WS] Connected: ${uid}`);
  redis.setex(`ws:presence:user:${uid}`, 70, 'connected');
  socket.join(`user:${uid}`);

  socket.on('join', ({ channel }: { channel: string }) => { socket.join(channel); });
  socket.on('leave', ({ channel }: { channel: string }) => { socket.leave(channel); });
  socket.on('app:foreground', () => { redis.setex(`app:fg:user:${uid}`, 90, '1'); });

  const hb = setInterval(() => redis.setex(`ws:presence:user:${uid}`, 70, 'connected'), 30000);
  socket.on('disconnect', () => { clearInterval(hb); redis.del(`ws:presence:user:${uid}`); });
});

sub.subscribe('ws:broadcast');
sub.on('message', (_ch: string, msg: string) => {
  try { const e = JSON.parse(msg); if (e.channel) io.to(e.channel).emit(e.type, e.data); } catch {}
});

const port = process.env.WS_PORT || 3001;
http.listen(port, () => console.log(`Realtime Gateway on :${port}`));
