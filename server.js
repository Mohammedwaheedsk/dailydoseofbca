const fs = require("fs/promises");
const path = require("path");
const express = require("express");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = __dirname;
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(ROOT_DIR, "data");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");
const CHAT_PROFILES_FILE = path.join(DATA_DIR, "chat-profiles.json");
const CHAT_MESSAGES_FILE = path.join(DATA_DIR, "chat-messages.json");
const ADMIN_NOTIFICATIONS_FILE = path.join(DATA_DIR, "admin-notifications.json");
const NOTIFICATION_FILE = path.join(ROOT_DIR, "notification-config.json");
const SITE_CONFIG_FILE = path.join(ROOT_DIR, "site-config.json");
const CHAT_MESSAGE_TTL_MS = 24 * 60 * 60 * 1000;
const CHAT_MEDIA_MAX_BYTES = 8 * 1024 * 1024;
const db = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    })
  : null;
let chatWriteQueue = Promise.resolve();

app.disable("x-powered-by");
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true, limit: "12mb" }));

async function readJson(filePath, fallback) {
  try {
    const data = await fs.readFile(filePath, "utf8");
    if (!data.trim()) return fallback;
    return JSON.parse(data);
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`);
  await fs.rename(tempPath, filePath);
}

async function queryDb(sql, params = []) {
  if (!db) return null;
  return db.query(sql, params);
}

function contactMessageFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    subject: row.subject,
    message: row.message,
    createdAt: row.created_at
  };
}

function profileFromRow(row) {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    pin: row.pin,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function chatMessageFromRow(row) {
  return {
    id: row.id,
    profileId: row.profile_id,
    username: row.username,
    name: row.name,
    message: row.message,
    media: row.media,
    viewOnce: Boolean(row.view_once),
    seenBy: Array.isArray(row.seen_by) ? row.seen_by : [],
    createdAt: row.created_at
  };
}

function adminNotificationFromRow(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    requestedLogin: row.requested_login,
    profile: row.profile,
    read: row.read,
    createdAt: row.created_at
  };
}

async function ensureDatabase() {
  if (!db) return;
  await queryDb(`
    create table if not exists chat_profiles (
      id text primary key,
      username text not null unique,
      name text not null unique,
      pin text not null,
      created_at timestamptz not null,
      updated_at timestamptz not null
    );

    create table if not exists chat_messages (
      id text primary key,
      profile_id text not null references chat_profiles(id) on delete cascade,
      username text not null,
      name text not null,
      message text not null,
      media jsonb,
      view_once boolean default false,
      seen_by jsonb default '[]'::jsonb,
      created_at timestamptz not null
    );

    create table if not exists admin_notifications (
      id text primary key,
      type text,
      title text,
      message text,
      requested_login text,
      profile jsonb,
      read boolean default false,
      created_at timestamptz not null
    );

    create table if not exists contact_messages (
      id text primary key,
      name text not null,
      email text not null,
      subject text,
      message text not null,
      created_at timestamptz not null
    );

    create index if not exists chat_messages_created_at_idx on chat_messages(created_at);
    create index if not exists admin_notifications_created_at_idx on admin_notifications(created_at);
  `);
  await queryDb("alter table chat_messages add column if not exists media jsonb");
  await queryDb("alter table chat_messages add column if not exists view_once boolean default false");
  await queryDb("alter table chat_messages add column if not exists seen_by jsonb default '[]'::jsonb");
}

async function readContactMessages() {
  if (db) {
    const result = await queryDb("select * from contact_messages order by created_at desc limit 500");
    return result.rows.map(contactMessageFromRow);
  }
  return readJson(MESSAGES_FILE, []);
}

async function saveContactMessage(message) {
  if (db) {
    await queryDb(
      `insert into contact_messages (id, name, email, subject, message, created_at)
       values ($1, $2, $3, $4, $5, $6)`,
      [message.id, message.name, message.email, message.subject, message.message, message.createdAt]
    );
    return;
  }

  const messages = await readJson(MESSAGES_FILE, []);
  messages.unshift(message);
  await writeJson(MESSAGES_FILE, messages.slice(0, 500));
}

async function readProfiles() {
  if (db) {
    const result = await queryDb("select * from chat_profiles order by created_at desc");
    return result.rows.map(profileFromRow);
  }
  return readJson(CHAT_PROFILES_FILE, []);
}

async function writeProfiles(profiles) {
  await writeJson(CHAT_PROFILES_FILE, profiles);
}

async function upsertProfile(profile) {
  if (db) {
    await queryDb(
      `insert into chat_profiles (id, username, name, pin, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (id) do update set
         username = excluded.username,
         name = excluded.name,
         pin = excluded.pin,
         updated_at = excluded.updated_at`,
      [profile.id, profile.username, profile.name, profile.pin, profile.createdAt, profile.updatedAt]
    );
    return;
  }

  const profiles = await readProfiles();
  const existingProfile = profiles.find((item) => item.id === profile.id);
  const nextProfiles = existingProfile
    ? profiles.map((item) => (item.id === profile.id ? profile : item))
    : [profile, ...profiles];
  await writeProfiles(nextProfiles);
}

async function deleteProfileById(profileId) {
  if (db) {
    const deletedMessages = await queryDb("delete from chat_messages where profile_id = $1", [profileId]);
    const deletedProfile = await queryDb("delete from chat_profiles where id = $1", [profileId]);
    return {
      found: deletedProfile.rowCount > 0,
      deletedMessages: deletedMessages.rowCount
    };
  }

  const profiles = await readProfiles();
  const nextProfiles = profiles.filter((profile) => profile.id !== profileId);
  if (nextProfiles.length === profiles.length) {
    return { found: false, deletedMessages: 0 };
  }

  const messages = await readFreshChatMessages();
  const nextMessages = messages.filter((message) => message.profileId !== profileId);
  await writeProfiles(nextProfiles);
  await writeChatMessages(nextMessages);
  return {
    found: true,
    deletedMessages: messages.length - nextMessages.length
  };
}

async function readAdminNotifications() {
  if (db) {
    const result = await queryDb("select * from admin_notifications order by created_at desc limit 500");
    return result.rows.map(adminNotificationFromRow);
  }
  return readJson(ADMIN_NOTIFICATIONS_FILE, []);
}

async function deleteAdminNotificationById(notificationId) {
  if (db) {
    const result = await queryDb("delete from admin_notifications where id = $1", [notificationId]);
    return result.rowCount > 0;
  }

  const notifications = await readAdminNotifications();
  const nextNotifications = notifications.filter((notification) => notification.id !== notificationId);
  if (nextNotifications.length === notifications.length) return false;
  await writeJson(ADMIN_NOTIFICATIONS_FILE, nextNotifications);
  return true;
}

function requireAdminToken(req, res, next) {
  const configuredToken = process.env.ADMIN_TOKEN;
  if (!configuredToken) {
    return res.status(503).json({
      ok: false,
      error: "Admin features are disabled until ADMIN_TOKEN is configured."
    });
  }

  const header = req.get("authorization") || "";
  const providedToken = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (providedToken !== configuredToken) {
    return res.status(401).json({ ok: false, error: "Invalid admin token." });
  }

  next();
}

function cleanText(value, maxLength = 1000) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeUniqueValue(value) {
  return cleanText(value, 80).toLowerCase();
}

function cleanUsername(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
}

function cleanPin(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 4);
}

function cleanMedia(value) {
  if (!value || typeof value !== "object") return null;

  const kind = cleanText(value.kind, 20);
  const allowedKinds = new Set(["image", "video", "audio", "pdf"]);
  const name = cleanText(value.name, 140);
  const mimeType = cleanText(value.mimeType, 100);
  const data = String(value.data || "");
  const size = Number(value.size || 0);

  if (!allowedKinds.has(kind) || !name || !mimeType || !data.startsWith("data:")) {
    return null;
  }

  if (!Number.isFinite(size) || size <= 0 || size > CHAT_MEDIA_MAX_BYTES) {
    const error = new Error("Media file must be 8 MB or smaller.");
    error.statusCode = 400;
    throw error;
  }

  if (data.length > Math.ceil(CHAT_MEDIA_MAX_BYTES * 1.45)) {
    const error = new Error("Media file is too large.");
    error.statusCode = 400;
    throw error;
  }

  const allowedMime = (
    mimeType.startsWith("image/") ||
    mimeType.startsWith("video/") ||
    mimeType.startsWith("audio/") ||
    mimeType === "application/pdf"
  );

  if (!allowedMime) {
    const error = new Error("Only images, videos, audio files, and PDFs can be sent.");
    error.statusCode = 400;
    throw error;
  }

  return { kind, name, mimeType, size, data };
}

function publicProfile(profile) {
  return {
    id: profile.id,
    username: profile.username,
    name: profile.name,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt
  };
}

function adminProfile(profile) {
  return {
    ...publicProfile(profile),
    pin: profile.pin
  };
}

function adminProfileStatus(profile, activeProfileIds) {
  return {
    id: profile.id,
    username: profile.username,
    name: profile.name,
    status: activeProfileIds.has(profile.id) ? "active" : "inactive",
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt
  };
}

async function addAdminNotification(notification) {
  const nextNotification = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    read: false,
    createdAt: new Date().toISOString(),
    ...notification
  };

  if (db) {
    await queryDb(
      `insert into admin_notifications (id, type, title, message, requested_login, profile, read, created_at)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
      [
        nextNotification.id,
        nextNotification.type || null,
        nextNotification.title || null,
        nextNotification.message || null,
        nextNotification.requestedLogin || null,
        nextNotification.profile ? JSON.stringify(nextNotification.profile) : null,
        Boolean(nextNotification.read),
        nextNotification.createdAt
      ]
    );
    return nextNotification;
  }

  const notifications = await readJson(ADMIN_NOTIFICATIONS_FILE, []);
  notifications.unshift(nextNotification);
  await writeJson(ADMIN_NOTIFICATIONS_FILE, notifications.slice(0, 500));
  return nextNotification;
}

function isExpiredMessage(message) {
  return Date.now() - Date.parse(message.createdAt || 0) >= CHAT_MESSAGE_TTL_MS;
}

async function readFreshChatMessages() {
  if (db) {
    await queryDb("delete from chat_messages where created_at < now() - interval '24 hours'");
    const result = await queryDb("select * from chat_messages order by created_at asc limit 300");
    return result.rows.map(chatMessageFromRow);
  }

  const messages = await readJson(CHAT_MESSAGES_FILE, []);
  const freshMessages = messages.filter((message) => !isExpiredMessage(message));
  if (freshMessages.length !== messages.length) {
    await writeJson(CHAT_MESSAGES_FILE, freshMessages);
  }
  return freshMessages;
}

async function writeChatMessages(messages) {
  await writeJson(CHAT_MESSAGES_FILE, messages);
}

async function saveChatMessage(message) {
  if (db) {
    await queryDb(
      `insert into chat_messages (id, profile_id, username, name, message, media, view_once, seen_by, created_at)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::jsonb, $9)`,
      [
        message.id,
        message.profileId,
        message.username,
        message.name,
        message.message,
        message.media ? JSON.stringify(message.media) : null,
        Boolean(message.viewOnce),
        JSON.stringify(message.seenBy || []),
        message.createdAt
      ]
    );
    await queryDb("delete from chat_messages where created_at < now() - interval '24 hours'");
    return;
  }

  const messages = await readFreshChatMessages();
  messages.push(message);
  await writeChatMessages(messages.slice(-300));
}

async function markChatMessagesSeen(profileId) {
  if (!profileId) return;
  const profiles = await readProfiles();
  const profile = profiles.find((item) => item.id === profileId);
  if (!profile) return;

  const viewer = {
    profileId: profile.id,
    name: profile.name,
    username: profile.username,
    seenAt: new Date().toISOString()
  };

  const messages = await readFreshChatMessages();
  const updatedMessages = [];

  for (const message of messages) {
    if (message.profileId === profile.id) {
      updatedMessages.push(message);
      continue;
    }

    const seenBy = Array.isArray(message.seenBy) ? message.seenBy : [];
    if (seenBy.some((seen) => seen.profileId === profile.id)) {
      updatedMessages.push(message);
      continue;
    }

    const nextSeenBy = [...seenBy, viewer].slice(-200);
    const nextMessage = { ...message, seenBy: nextSeenBy };
    updatedMessages.push(nextMessage);

    if (db) {
      await queryDb("update chat_messages set seen_by = $1::jsonb where id = $2", [
        JSON.stringify(nextSeenBy),
        message.id
      ]);
    }
  }

  if (!db) await writeChatMessages(updatedMessages);
}

async function openViewOnceMedia(messageId, profileId) {
  if (db) {
    const result = await queryDb(
      "select media, view_once from chat_messages where id = $1 and media is not null",
      [messageId]
    );
    if (!result.rows.length) return null;
    const message = result.rows[0];
    return message.media;
  }

  const messages = await readFreshChatMessages();
  const index = messages.findIndex((message) => message.id === messageId && message.media);
  if (index === -1) return null;
  return messages[index].media;
}

async function deleteChatMessageById(messageId) {
  if (db) {
    const result = await queryDb("delete from chat_messages where id = $1", [messageId]);
    return result.rowCount > 0;
  }

  const messages = await readFreshChatMessages();
  const nextMessages = messages.filter((message) => message.id !== messageId);
  if (nextMessages.length === messages.length) return false;
  await writeChatMessages(nextMessages);
  return true;
}

async function withChatWriteLock(task) {
  const runTask = chatWriteQueue.then(task, task);
  chatWriteQueue = runTask.catch(() => {});
  return runTask;
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    name: "DailyDoseofBCA",
    uptime: Math.round(process.uptime())
  });
});

app.get("/api/notifications", async (req, res, next) => {
  try {
    const config = await readJson(NOTIFICATION_FILE, {
      active: false,
      message: "",
      type: "info",
      link: "#",
      expireSeconds: 5
    });
    res.json(config);
  } catch (error) {
    next(error);
  }
});

app.put("/api/notifications", requireAdminToken, async (req, res, next) => {
  try {
    const config = {
      active: Boolean(req.body.active),
      message: cleanText(req.body.message, 240),
      type: cleanText(req.body.type || "info", 30),
      link: cleanText(req.body.link || "#", 240),
      icon: cleanText(req.body.icon || "", 240),
      expireSeconds: Math.max(5, Math.min(Number(req.body.expireSeconds) || 5, 604800))
    };

    await writeJson(NOTIFICATION_FILE, config);
    res.json({ ok: true, config });
  } catch (error) {
    next(error);
  }
});

app.post("/api/contact", async (req, res, next) => {
  try {
    const message = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: cleanText(req.body.name, 80),
      email: cleanText(req.body.email, 120),
      subject: cleanText(req.body.subject, 120),
      message: cleanText(req.body.message, 1200),
      createdAt: new Date().toISOString()
    };

    if (!message.name || !message.email || !message.message) {
      return res.status(400).json({
        ok: false,
        error: "Name, email, and message are required."
      });
    }

    await saveContactMessage(message);

    res.status(201).json({
      ok: true,
      message: "Thanks. Your message has been saved."
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/site-config", async (req, res, next) => {
  try {
    const config = await readJson(SITE_CONFIG_FILE, {
      landingPage: "bca-sem5.html"
    });
    res.json(config);
  } catch (error) {
    next(error);
  }
});

app.put("/api/site-config", requireAdminToken, async (req, res, next) => {
  try {
    const landingPage = cleanText(req.body.landingPage || "bca-sem5.html", 120);
    if (!/^[a-zA-Z0-9._/-]+\.html$/.test(landingPage) || landingPage.includes("..")) {
      return res.status(400).json({
        ok: false,
        error: "Landing page must be a local .html file."
      });
    }

    const config = { landingPage };
    await writeJson(SITE_CONFIG_FILE, config);
    res.json({ ok: true, config });
  } catch (error) {
    next(error);
  }
});

app.post("/api/chat/profile", async (req, res, next) => {
  try {
    await withChatWriteLock(async () => {
      const username = cleanUsername(req.body.username);
      const name = cleanText(req.body.name, 80);
      const pin = cleanPin(req.body.pin);
      const storedProfileId = cleanText(req.body.profileId, 80);

      if (!/^[a-z0-9_]{3,24}$/.test(username)) {
        return res.status(400).json({
          ok: false,
          error: "Username must be 3-24 characters using letters, numbers, or underscore."
        });
      }

      if (name.length < 2) {
        return res.status(400).json({
          ok: false,
          error: "Name must be at least 2 characters."
        });
      }

      if (!/^\d{4}$/.test(pin)) {
        return res.status(400).json({
          ok: false,
          error: "PIN must be exactly 4 digits."
        });
      }

      const profiles = await readProfiles();
      const normalizedName = normalizeUniqueValue(name);
      const existingProfile = profiles.find((profile) => profile.id === storedProfileId);

      const usernameOwner = profiles.find((profile) => profile.username === username);
      const nameOwner = profiles.find((profile) => normalizeUniqueValue(profile.name) === normalizedName);

      if (usernameOwner && usernameOwner.id !== storedProfileId) {
        return res.status(409).json({
          ok: false,
          error: "That username is already taken."
        });
      }

      if (nameOwner && nameOwner.id !== storedProfileId) {
        return res.status(409).json({
          ok: false,
          error: "That name is already taken."
        });
      }

      const now = new Date().toISOString();
      const profile = existingProfile || {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        createdAt: now
      };

      profile.username = username;
      profile.name = name;
      profile.pin = pin;
      profile.updatedAt = now;

      await upsertProfile(profile);
      if (!existingProfile) {
        await addAdminNotification({
          type: "profile_created",
          title: "New profile created",
          message: "A user created a chat profile.",
          profile: adminProfile(profile)
        });
      }
      res.status(existingProfile ? 200 : 201).json({ ok: true, profile: publicProfile(profile) });
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/chat/login", async (req, res, next) => {
  try {
    const login = normalizeUniqueValue(req.body.login || req.body.username || req.body.name);
    const pin = cleanPin(req.body.pin);

    if (!login || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({
        ok: false,
        error: "Enter your username/name and 4-digit PIN."
      });
    }

    const profiles = await readProfiles();
    const profile = profiles.find((item) => (
      item.username === login || normalizeUniqueValue(item.name) === login
    ));

    if (!profile || profile.pin !== pin) {
      return res.status(401).json({
        ok: false,
        error: "Profile not found or PIN is incorrect."
      });
    }

    res.json({ ok: true, profile: publicProfile(profile) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/chat/forgot-pin", async (req, res, next) => {
  try {
    const login = normalizeUniqueValue(req.body.login || req.body.username || req.body.name);

    if (!login) {
      return res.status(400).json({
        ok: false,
        error: "Enter your username or name."
      });
    }

    const profiles = await readProfiles();
    const profile = profiles.find((item) => (
      item.username === login || normalizeUniqueValue(item.name) === login
    ));

    await addAdminNotification({
      type: "forgot_pin",
      title: "Forgot PIN request",
      message: profile
        ? "A registered user requested PIN help."
        : "An unknown profile requested PIN help.",
      requestedLogin: login,
      profile: profile ? adminProfile(profile) : null
    });

    res.json({
      ok: true,
      message: "Admin has been notified. Please contact DailyDoseofBCA for your PIN."
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/chat/messages", async (req, res, next) => {
  try {
    const profileId = cleanText(req.query.profileId, 80);
    await withChatWriteLock(async () => {
      await markChatMessagesSeen(profileId);
      const messages = await readFreshChatMessages();
      res.json({ ok: true, messages });
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/chat/messages", async (req, res, next) => {
  try {
    await withChatWriteLock(async () => {
      const profileId = cleanText(req.body.profileId, 80);
      const text = cleanText(req.body.message, 500);
      const media = cleanMedia(req.body.media);
      const viewOnce = Boolean(req.body.viewOnce);
      const profiles = await readProfiles();
      const profile = profiles.find((item) => item.id === profileId);

      if (!profile) {
        return res.status(401).json({
          ok: false,
          error: "Create your profile before sending a message."
        });
      }

      if (!text && !media) {
        return res.status(400).json({
          ok: false,
          error: "Message or media is required."
        });
      }

      const message = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        profileId: profile.id,
        username: profile.username,
        name: profile.name,
        message: text,
        media,
        viewOnce,
        seenBy: [],
        createdAt: new Date().toISOString()
      };

      await saveChatMessage(message);
      res.status(201).json({ ok: true, message });
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/chat/messages/:messageId/open-media", async (req, res, next) => {
  try {
    const messageId = cleanText(req.params.messageId, 80);
    const profileId = cleanText(req.body.profileId, 80);
    const media = await openViewOnceMedia(messageId, profileId);
    if (!media) {
      return res.status(404).json({
        ok: false,
        error: "Media is no longer available."
      });
    }
    res.json({ ok: true, media });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/chat", requireAdminToken, async (req, res, next) => {
  try {
    const profiles = await readProfiles();
    const messages = await readFreshChatMessages();
    const notifications = await readAdminNotifications();
    const activeProfileIds = new Set(messages.map((message) => message.profileId));
    const profileStatuses = profiles.map((profile) => adminProfileStatus(profile, activeProfileIds));
    res.json({
      ok: true,
      profileCount: profiles.length,
      activeProfileCount: profileStatuses.filter((profile) => profile.status === "active").length,
      inactiveProfileCount: profileStatuses.filter((profile) => profile.status === "inactive").length,
      profiles: profileStatuses,
      messages,
      notifications: notifications.map((notification) => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        read: notification.read,
        createdAt: notification.createdAt
      }))
    });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/notifications/:notificationId", requireAdminToken, async (req, res, next) => {
  try {
    const notificationId = cleanText(req.params.notificationId, 80);
    const deleted = await deleteAdminNotificationById(notificationId);

    if (!deleted) {
      return res.status(404).json({
        ok: false,
        error: "Notification not found."
      });
    }

    res.json({ ok: true, deletedId: notificationId });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/chat/profiles/:profileId", requireAdminToken, async (req, res, next) => {
  try {
    await withChatWriteLock(async () => {
      const profileId = cleanText(req.params.profileId, 80);
      const deletion = await deleteProfileById(profileId);

      if (!deletion.found) {
        return res.status(404).json({
          ok: false,
          error: "Profile not found."
        });
      }

      res.json({
        ok: true,
        deletedId: profileId,
        deletedMessages: deletion.deletedMessages
      });
    });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/chat/messages/:messageId", requireAdminToken, async (req, res, next) => {
  try {
    await withChatWriteLock(async () => {
      const messageId = cleanText(req.params.messageId, 80);
      const deleted = await deleteChatMessageById(messageId);

      if (!deleted) {
        return res.status(404).json({
          ok: false,
          error: "Message not found."
        });
      }

      res.json({ ok: true, deletedId: messageId });
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/messages", requireAdminToken, async (req, res, next) => {
  try {
    const messages = await readContactMessages();
    res.json({ ok: true, messages });
  } catch (error) {
    next(error);
  }
});

app.use(
  express.static(ROOT_DIR, {
    extensions: ["html"],
    setHeaders(res, filePath) {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    }
  })
);

app.use((req, res) => {
  res.status(404).sendFile(path.join(ROOT_DIR, "index.html"));
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.statusCode || 500).json({
    ok: false,
    error: error.statusCode ? error.message : "Something went wrong on the server."
  });
});

ensureDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`DailyDoseofBCA running at http://localhost:${PORT}`);
      console.log(db ? "Using Supabase/Postgres storage." : `Using JSON storage at ${DATA_DIR}.`);
    });
  })
  .catch((error) => {
    console.error("Could not start DailyDoseofBCA:", error);
    process.exit(1);
  });
