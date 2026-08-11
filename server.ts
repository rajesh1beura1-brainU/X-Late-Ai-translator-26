import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { dbStore } from './src/server/dbStore.js';
import { geminiService } from './src/server/geminiService.js';
import { EmailService } from './src/server/emailService.js';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Security Headers Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

const SESSION_SECRET = process.env.SESSION_SECRET;

// Token generation & verification
export function generateAuthToken(userId: string, email: string): string {
  if (!SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is missing.');
  }
  const payload = Buffer.from(JSON.stringify({ u: userId, e: email, ts: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verifyAuthToken(token: string): { userId: string; email: string } | null {
  if (!token || !SESSION_SECRET) return null;
  const parts = token.split('.');
  if (parts.length === 2) {
    const [payloadB64, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('hex');
    const bufSig = Buffer.from(sig);
    const bufExpected = Buffer.from(expectedSig);
    if (bufSig.length === bufExpected.length && crypto.timingSafeEqual(bufSig, bufExpected)) {
      try {
        const json = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
        if (json && json.u && json.e) {
          return { userId: json.u, email: json.e };
        }
      } catch {
        return null;
      }
    }
  }
  return null;
}

function getAuthUser(req: Request): { userId: string; email: string } | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    return verifyAuthToken(token);
  }
  return null;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized: Valid authentication session token required.' });
    return;
  }
  (req as any).user = user;
  next();
}

// --- API ROUTES ---

// Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    product: 'X-Late — AI Live Translator',
    version: '1.0.0-master',
    timestamp: new Date().toISOString()
  });
});

// Auth Session & Device Registration (STRICT 2-DEVICE LIMIT)
app.post('/api/auth/session', (req: Request, res: Response) => {
  const existingUser = getAuthUser(req);
  const { deviceId, deviceName, os, browser } = req.body;

  const effectiveDeviceId = deviceId || `device_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const ip = req.ip || '127.0.0.1';

  const userId = existingUser ? existingUser.userId : `user_${effectiveDeviceId}`;
  const email = existingUser ? existingUser.email : `${userId}@xlate.ai`;

  const { profile, plan } = dbStore.getOrCreateUser(userId, email);
  const deviceReg = dbStore.registerDeviceSession(
    userId,
    effectiveDeviceId,
    deviceName || 'Current Device',
    os || 'Web Browser',
    browser || 'Chrome/Safari',
    ip
  );

  const token = generateAuthToken(userId, email);

  res.json({
    token,
    profile,
    plan,
    deviceId: effectiveDeviceId,
    activeDevices: deviceReg.activeDevices,
    currentDevice: deviceReg.currentDevice,
    revokedOldestDevice: deviceReg.revokedOldestDevice
  });
});

// Device Management
app.get('/api/devices', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const devices = dbStore.getActiveDevices(user.userId);
  res.json({ activeDevices: devices, maxAllowed: 2 });
});

app.post('/api/devices/revoke', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { deviceIdToRevoke } = req.body;
  if (!deviceIdToRevoke) {
    res.status(400).json({ error: 'deviceIdToRevoke is required' });
    return;
  }
  const success = dbStore.revokeDevice(user.userId, deviceIdToRevoke);
  const activeDevices = dbStore.getActiveDevices(user.userId);
  res.json({ success, activeDevices });
});

// Live Speech & Text Translation
app.post('/api/translate/live', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { text, sourceLang, targetLang, deviceId, context } = req.body;

  if (!text || typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ error: 'Text input is required for translation' });
    return;
  }

  // Device check
  if (deviceId) {
    const activeDevices = dbStore.getActiveDevices(user.userId);
    const isAllowed = activeDevices.some(d => d.deviceId === deviceId);
    if (!isAllowed && activeDevices.length >= 2) {
      // Refresh current device session which may auto-revoke oldest
      const reg = dbStore.registerDeviceSession(user.userId, deviceId, 'Mobile Client', 'Mobile', 'App', req.ip || '127.0.0.1');
      if (reg.currentDevice.revoked) {
        res.status(403).json({ error: 'Device session revoked. Maximum 2 active devices enforced.' });
        return;
      }
    }
  }

  // Consume 1 session unit
  const sessionCheck = dbStore.consumeSession(user.userId);
  if (!sessionCheck.success) {
    res.status(402).json({
      error: 'Session limit reached. Please purchase additional session pack to continue live translation.',
      remainingSessions: 0,
      plan: sessionCheck.plan
    });
    return;
  }

  try {
    const result = await geminiService.translateAndExtractIntent(
      text,
      sourceLang || 'auto',
      targetLang || 'hi-IN',
      context
    );

    // Auto save extracted tasks if any
    if (result.detectedTasks && result.detectedTasks.length > 0) {
      for (const t of result.detectedTasks) {
        dbStore.saveTask(user.userId, {
          title: t.title,
          description: t.description || `Extracted from speech: "${result.originalText}"`,
          dueDate: t.dueDate || new Date().toISOString().split('T')[0],
          dueTime: t.dueTime || '10:00',
          priority: t.priority || 'NORMAL',
          extractedFromText: result.originalText
        });
      }
    }

    res.json({
      ...result,
      remainingSessions: sessionCheck.remainingSessions
    });
  } catch (err: any) {
    console.error('Translation error:', err);
    res.status(500).json({ error: 'Failed to process live translation' });
  }
});

// Audio Blob Translation
app.post('/api/translate/audio', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { audioBase64, mimeType, sourceLang, targetLang } = req.body;

  if (!audioBase64) {
    res.status(400).json({ error: 'Audio base64 data required' });
    return;
  }

  const sessionCheck = dbStore.consumeSession(user.userId);
  if (!sessionCheck.success) {
    res.status(402).json({
      error: 'Session limit reached. Purchase additional session pack.',
      remainingSessions: 0,
      plan: sessionCheck.plan
    });
    return;
  }

  try {
    const result = await geminiService.translateAudioBlob(
      audioBase64,
      mimeType || 'audio/webm',
      sourceLang || 'auto',
      targetLang || 'hi-IN'
    );

    if (result.detectedTasks && result.detectedTasks.length > 0) {
      for (const t of result.detectedTasks) {
        dbStore.saveTask(user.userId, {
          title: t.title,
          description: t.description || `Extracted from speech audio: "${result.originalText}"`,
          dueDate: t.dueDate || new Date().toISOString().split('T')[0],
          dueTime: t.dueTime || '10:00',
          priority: t.priority || 'NORMAL',
          extractedFromText: result.originalText
        });
      }
    }

    res.json({
      ...result,
      remainingSessions: sessionCheck.remainingSessions
    });
  } catch (err: any) {
    console.error('Audio translation error:', err);
    res.status(500).json({ error: 'Failed to transcribe and translate speech audio' });
  }
});

// Live Song & Lyrics Translation Endpoint
app.post('/api/translate/lyrics', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const sessionCheck = dbStore.consumeSession(user.userId);

  const { audioBase64, mimeType, lyricsOrText, targetLangCode } = req.body;
  if (!targetLangCode) {
    res.status(400).json({ error: 'targetLangCode is required' });
    return;
  }

  try {
    const result = await geminiService.translateSongLyrics({
      audioBase64,
      mimeType,
      lyricsOrText,
      targetLangCode
    });

    res.json({
      ...result,
      remainingSessions: sessionCheck.remainingSessions || 0
    });
  } catch (err: any) {
    console.error('Song lyrics translation error:', err);
    res.status(500).json({ error: 'Failed to process song lyrics translation' });
  }
});

// History Endpoints
app.get('/api/history', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const history = dbStore.getHistory(user.userId);
  res.json(history);
});

app.post('/api/history', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const session = req.body;
  if (!session || !session.id) {
    res.status(400).json({ error: 'Valid session object required' });
    return;
  }
  const saved = dbStore.saveConversationSession(user.userId, session);
  res.json(saved);
});

app.delete('/api/history/:id', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const success = dbStore.deleteHistorySession(user.userId, req.params.id);
  res.json({ success });
});

app.delete('/api/history', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  dbStore.clearAllHistory(user.userId);
  res.json({ success: true });
});

// Tasks & Reminders Endpoints
app.get('/api/tasks', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const tasks = dbStore.getTasks(user.userId);
  res.json(tasks);
});

app.post('/api/tasks', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const saved = dbStore.saveTask(user.userId, req.body);
  res.json(saved);
});

app.patch('/api/tasks/:id/status', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { status } = req.body;
  const updated = dbStore.updateTaskStatus(user.userId, req.params.id, status || 'DONE');
  res.json(updated);
});

app.delete('/api/tasks/:id', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const success = dbStore.deleteTask(user.userId, req.params.id);
  res.json({ success });
});

app.get('/api/tasks/morning-alerts', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const alerts = dbStore.getMorningAlerts(user.userId);
  res.json(alerts);
});

app.post('/api/tasks/:id/morning-alert-ack', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  dbStore.markMorningAlertShown(user.userId, req.params.id);
  res.json({ success: true });
});

// Billing & Entitlements ($5 Pack for 20 Sessions)
app.get('/api/billing/plan', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const plan = dbStore.getUserPlan(user.userId);
  res.json(plan);
});

app.post('/api/billing/buy-pack', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { packName, price, sessionsCount } = req.body;
  const updatedPlan = dbStore.addSessionPack(
    user.userId,
    packName || '$5 Session Pack (20 Sessions)',
    sessionsCount || 20,
    price || 5.00
  );
  res.json({ success: true, plan: updatedPlan });
});

app.post('/api/billing/refresh', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  const { count } = req.body;
  const updatedPlan = dbStore.refreshUsageCredits(user.userId, count || 100);
  res.json({ success: true, plan: updatedPlan });
});

// Calendar Export Integration
app.post('/api/calendar/export', requireAuth, (req: Request, res: Response) => {
  const { title, description, dueDate, dueTime } = req.body;

  const startIso = `${dueDate || '2026-08-10'}T${(dueTime || '10:00').replace(':', '')}00Z`;

  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title || 'X-Late Reminder')}&details=${encodeURIComponent(description || '')}&dates=${startIso}/${startIso}`;

  const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(title || 'X-Late Reminder')}&body=${encodeURIComponent(description || '')}&startdt=${dueDate}T${dueTime || '10:00'}:00Z`;

  const zohoUrl = `https://calendar.zoho.com/eventreq/add?title=${encodeURIComponent(title || 'X-Late Reminder')}&description=${encodeURIComponent(description || '')}`;

  const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//X-Late//AI Live Translator Calendar//EN
BEGIN:VEVENT
SUMMARY:${title || 'X-Late AI Task'}
DESCRIPTION:${description || ''}
DTSTART:${startIso.replace(/[-:]/g, '')}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

  res.json({
    googleUrl,
    outlookUrl,
    zohoUrl,
    icsContent
  });
});

// Email Sharing
app.post('/api/email/share', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { recipientEmail, subject, htmlContent } = req.body;

  if (!recipientEmail) {
    res.status(400).json({ error: 'recipientEmail is required' });
    return;
  }

  const result = await EmailService.sendEmail(
    { sender_email: 'no-reply@xlate.ai', provider: 'SMTP' },
    {
      to: recipientEmail,
      subject: subject || 'X-Late AI Translation & Intent Summary',
      html: htmlContent || '<p>Shared transcript from X-Late AI Live Translator.</p>'
    }
  );

  res.json(result);
});

// Global Error Handler Middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Server Error]:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

// --- SERVER SETUP & VITE INTEGRATION ---

async function startServer() {
  const distPath = path.join(process.cwd(), 'dist');
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    console.log(`[Production Server] Serving static build from ${distPath}`);
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    console.log('[Development Server] Initializing Vite middleware');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`X-Late AI Live Translator running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Fatal Start Error]:', err);
});
