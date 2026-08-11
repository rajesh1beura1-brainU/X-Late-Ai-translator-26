import fs from 'fs';
import path from 'path';
import { UserProfile, DeviceSession, UserPlan, AITask, ConversationSession } from '../types.js';

const DB_FILE_PATH = path.join(process.cwd(), 'storage', 'xlate_db.json');

interface DatabaseSchema {
  users: Record<string, UserProfile>;
  devices: Record<string, DeviceSession[]>; // userId -> active device list
  plans: Record<string, UserPlan>;
  tasks: Record<string, AITask[]>;
  history: Record<string, ConversationSession[]>;
}

const DEFAULT_DB: DatabaseSchema = {
  users: {},
  devices: {},
  plans: {},
  tasks: {},
  history: {}
};

class DBStore {
  private db: DatabaseSchema = DEFAULT_DB;

  constructor() {
    this.init();
  }

  private init() {
    try {
      const dir = path.dirname(DB_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(DB_FILE_PATH)) {
        const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
        this.db = JSON.parse(raw);
        // Ensure standard keys
        this.db.users = this.db.users || {};
        this.db.devices = this.db.devices || {};
        this.db.plans = this.db.plans || {};
        this.db.tasks = this.db.tasks || {};
        this.db.history = this.db.history || {};
      } else {
        this.save();
      }
    } catch (err) {
      console.error('Error initializing db store:', err);
      this.db = DEFAULT_DB;
    }
  }

  private save() {
    try {
      const dir = path.dirname(DB_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(this.db, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving db store:', err);
    }
  }

  // --- USER PROFILE & AUTH ---
  public getOrCreateUser(userId: string, email: string, name?: string): { profile: UserProfile; plan: UserPlan } {
    let profile = this.db.users[userId];
    if (!profile) {
      profile = {
        userId,
        email,
        name: name || email.split('@')[0],
        preferredSourceLang: 'auto',
        preferredTargetLang: 'hi-IN',
        encryptionEnabled: true,
        autoSpeakTranslation: true,
        autoExtractTasks: true,
        morningAlertsEnabled: true
      };
      this.db.users[userId] = profile;
    }

    let plan = this.db.plans[userId];
    if (!plan) {
      plan = {
        userId,
        planType: 'FREE',
        totalSessionsAllowed: 100,
        usedSessions: 0,
        remainingSessions: 100,
        maxMinutesPerSession: 20,
        purchaseHistory: []
      };
      this.db.plans[userId] = plan;
    }

    this.save();
    return { profile, plan };
  }

  public updateUserProfile(userId: string, updates: Partial<UserProfile>): UserProfile {
    const existing = this.db.users[userId] || this.getOrCreateUser(userId, `${userId}@xlate.ai`).profile;
    const updated = { ...existing, ...updates };
    this.db.users[userId] = updated;
    this.save();
    return updated;
  }

  // --- DEVICE MANAGEMENT (STRICT 2-DEVICE LIMIT RULE) ---
  public registerDeviceSession(
    userId: string,
    deviceId: string,
    deviceName: string,
    os: string,
    browser: string,
    ip: string
  ): { activeDevices: DeviceSession[]; currentDevice: DeviceSession; revokedOldestDevice?: string } {
    this.getOrCreateUser(userId, `${userId}@xlate.ai`);
    let userDevices = this.db.devices[userId] || [];

    const now = new Date().toISOString();
    let currentDevice = userDevices.find(d => d.deviceId === deviceId);

    if (currentDevice) {
      // Refresh active status
      currentDevice.lastActive = now;
      currentDevice.deviceName = deviceName || currentDevice.deviceName;
      currentDevice.os = os || currentDevice.os;
      currentDevice.browser = browser || currentDevice.browser;
      currentDevice.ip = ip || currentDevice.ip;
      currentDevice.revoked = false;
    } else {
      currentDevice = {
        deviceId,
        deviceName: deviceName || 'Mobile / Desktop Client',
        os: os || 'Web App',
        browser: browser || 'Browser',
        ip: ip || '127.0.0.1',
        lastActive: now,
        createdAt: now,
        isCurrent: true,
        revoked: false
      };
      userDevices.push(currentDevice);
    }

    // Filter non-revoked devices
    let activeDevices = userDevices.filter(d => !d.revoked);

    let revokedOldestDeviceName: string | undefined = undefined;

    // STRICT 2-DEVICE LIMIT ENFORCEMENT:
    // If active devices count > 2, automatically revoke oldest device!
    if (activeDevices.length > 2) {
      // Sort by last active ascending (oldest first)
      activeDevices.sort((a, b) => new Date(a.lastActive).getTime() - new Date(b.lastActive).getTime());
      
      // Revoke the oldest ones until count is 2
      while (activeDevices.length > 2) {
        const oldest = activeDevices.shift();
        if (oldest) {
          oldest.revoked = true;
          revokedOldestDeviceName = oldest.deviceName;
        }
      }
    }

    this.db.devices[userId] = userDevices;
    this.save();

    return {
      activeDevices: userDevices.filter(d => !d.revoked),
      currentDevice,
      revokedOldestDevice: revokedOldestDeviceName
    };
  }

  public getActiveDevices(userId: string): DeviceSession[] {
    return (this.db.devices[userId] || []).filter(d => !d.revoked);
  }

  public revokeDevice(userId: string, deviceIdToRevoke: string): boolean {
    const userDevices = this.db.devices[userId] || [];
    const target = userDevices.find(d => d.deviceId === deviceIdToRevoke);
    if (target) {
      target.revoked = true;
      this.save();
      return true;
    }
    return false;
  }

  // --- ENTITLEMENTS & BILLING ---
  public getUserPlan(userId: string): UserPlan {
    let plan = this.db.plans[userId];
    if (!plan) {
      plan = this.getOrCreateUser(userId, `${userId}@xlate.ai`).plan;
    }
    return plan;
  }

  public consumeSession(userId: string): { success: boolean; remainingSessions: number; plan: UserPlan } {
    const plan = this.getUserPlan(userId);
    if (plan.planType !== 'UNLIMITED' && plan.remainingSessions <= 0) {
      return { success: false, remainingSessions: 0, plan };
    }

    if (plan.planType !== 'UNLIMITED') {
      plan.usedSessions += 1;
      plan.remainingSessions = Math.max(0, plan.totalSessionsAllowed - plan.usedSessions);
    }

    this.db.plans[userId] = plan;
    this.save();

    return {
      success: true,
      remainingSessions: plan.remainingSessions,
      plan
    };
  }

  public addSessionPack(userId: string, packName: string = '$5 Pack (20 Sessions)', sessionsCount: number = 20, price: number = 5.00): UserPlan {
    const plan = this.getUserPlan(userId);
    plan.totalSessionsAllowed += sessionsCount;
    plan.remainingSessions += sessionsCount;
    plan.planType = 'PAID_PACK';
    plan.purchaseHistory.push({
      id: `pack_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      date: new Date().toISOString(),
      packName,
      amount: price,
      sessionsAdded: sessionsCount
    });

    this.db.plans[userId] = plan;
    this.save();
    return plan;
  }

  public refreshUsageCredits(userId: string, count: number = 100): UserPlan {
    const plan = this.getUserPlan(userId);
    plan.remainingSessions = count;
    plan.totalSessionsAllowed = Math.max(plan.totalSessionsAllowed, count);
    plan.usedSessions = 0;
    this.db.plans[userId] = plan;
    this.save();
    return plan;
  }

  // --- TASKS & REMINDERS ENGINE ---
  public getTasks(userId: string): AITask[] {
    return this.db.tasks[userId] || [];
  }

  public saveTask(userId: string, taskInput: Partial<AITask>): AITask {
    const userTasks = this.db.tasks[userId] || [];
    const now = new Date().toISOString();

    const task: AITask = {
      id: taskInput.id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      conversationId: taskInput.conversationId,
      title: taskInput.title || 'Untitled Task',
      description: taskInput.description || '',
      dueDate: taskInput.dueDate || new Date().toISOString().split('T')[0],
      dueTime: taskInput.dueTime || '09:00',
      priority: taskInput.priority || 'NORMAL',
      status: taskInput.status || 'PENDING',
      extractedFromText: taskInput.extractedFromText || '',
      reminderIntervals: taskInput.reminderIntervals || ['1_DAY_BEFORE', 'SAME_DAY'],
      morningAlertShown: false,
      createdAt: now
    };

    userTasks.unshift(task);
    this.db.tasks[userId] = userTasks;
    this.save();
    return task;
  }

  public updateTaskStatus(userId: string, taskId: string, status: 'PENDING' | 'DONE'): AITask | null {
    const userTasks = this.db.tasks[userId] || [];
    const target = userTasks.find(t => t.id === taskId);
    if (target) {
      target.status = status;
      if (status === 'DONE') {
        target.completedAt = new Date().toISOString();
      }
      this.save();
      return target;
    }
    return null;
  }

  public deleteTask(userId: string, taskId: string): boolean {
    const userTasks = this.db.tasks[userId] || [];
    const initialLen = userTasks.length;
    const filtered = userTasks.filter(t => t.id !== taskId);
    this.db.tasks[userId] = filtered;
    this.save();
    return filtered.length < initialLen;
  }

  public getMorningAlerts(userId: string): AITask[] {
    const userTasks = this.db.tasks[userId] || [];
    const today = new Date().toISOString().split('T')[0];

    // Important tasks due today that haven't shown morning alert
    return userTasks.filter(
      t => t.dueDate === today &&
           t.priority === 'IMPORTANT' &&
           t.status === 'PENDING' &&
           !t.morningAlertShown
    );
  }

  public markMorningAlertShown(userId: string, taskId: string) {
    const userTasks = this.db.tasks[userId] || [];
    const target = userTasks.find(t => t.id === taskId);
    if (target) {
      target.morningAlertShown = true;
      this.save();
    }
  }

  // --- HISTORY SYSTEM ---
  public getHistory(userId: string): ConversationSession[] {
    return this.db.history[userId] || [];
  }

  public saveConversationSession(userId: string, session: ConversationSession): ConversationSession {
    const userHistory = this.db.history[userId] || [];
    const existingIdx = userHistory.findIndex(s => s.id === session.id);

    if (existingIdx >= 0) {
      userHistory[existingIdx] = session;
    } else {
      userHistory.unshift(session);
    }

    this.db.history[userId] = userHistory;
    this.save();
    return session;
  }

  public deleteHistorySession(userId: string, sessionId: string): boolean {
    const userHistory = this.db.history[userId] || [];
    const filtered = userHistory.filter(s => s.id !== sessionId);
    this.db.history[userId] = filtered;
    this.save();
    return filtered.length < userHistory.length;
  }

  public clearAllHistory(userId: string): void {
    this.db.history[userId] = [];
    this.save();
  }
}

export const dbStore = new DBStore();
