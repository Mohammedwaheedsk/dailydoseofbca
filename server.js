const fs = require("fs/promises");
const path = require("path");
const express = require("express");
require("dotenv").config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");
const CHAT_PROFILES_FILE = path.join(DATA_DIR, "chat-profiles.json");
const CHAT_MESSAGES_FILE = path.join(DATA_DIR, "chat-messages.json");
const NOTIFICATION_FILE = path.join(ROOT_DIR, "notification-config.json");
const SITE_CONFIG_FILE = path.join(ROOT_DIR, "site-config.json");
const CHAT_MESSAGE_TTL_MS = 24 * 60 * 60 * 1000;
let chatWriteQueue = Promise.resolve();

app.disable("x-powered-by");
app.use(express.json({ limit: "80kb" }));
app.use(express.urlencoded({ extended: true, limit: "80kb" }));

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

function cleanText(value, maxLength) {
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

function isExpiredMessage(message) {
  return Date.now() - Date.parse(message.createdAt || 0) >= CHAT_MESSAGE_TTL_MS;
}

async function readFreshChatMessages() {
  const messages = await readJson(CHAT_MESSAGES_FILE, []);
  const freshMessages = messages.filter((message) => !isExpiredMessage(message));
  if (freshMessages.length !== messages.length) {
    await writeJson(CHAT_MESSAGES_FILE, freshMessages);
  }
  return freshMessages;
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

    const messages = await readJson(MESSAGES_FILE, []);
    messages.unshift(message);
    await writeJson(MESSAGES_FILE, messages.slice(0, 500));

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

      const profiles = await readJson(CHAT_PROFILES_FILE, []);
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
      profile.updatedAt = now;

      const nextProfiles = existingProfile
        ? profiles.map((item) => (item.id === profile.id ? profile : item))
        : [profile, ...profiles];

      await writeJson(CHAT_PROFILES_FILE, nextProfiles);
      res.status(existingProfile ? 200 : 201).json({ ok: true, profile });
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/chat/messages", async (req, res, next) => {
  try {
    const messages = await readFreshChatMessages();
    res.json({ ok: true, messages });
  } catch (error) {
    next(error);
  }
});

app.post("/api/chat/messages", async (req, res, next) => {
  try {
    await withChatWriteLock(async () => {
      const profileId = cleanText(req.body.profileId, 80);
      const text = cleanText(req.body.message, 500);
      const profiles = await readJson(CHAT_PROFILES_FILE, []);
      const profile = profiles.find((item) => item.id === profileId);

      if (!profile) {
        return res.status(401).json({
          ok: false,
          error: "Create your profile before sending a message."
        });
      }

      if (!text) {
        return res.status(400).json({
          ok: false,
          error: "Message cannot be empty."
        });
      }

      const message = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        profileId: profile.id,
        username: profile.username,
        name: profile.name,
        message: text,
        createdAt: new Date().toISOString()
      };

      const messages = await readFreshChatMessages();
      messages.push(message);
      await writeJson(CHAT_MESSAGES_FILE, messages.slice(-300));
      res.status(201).json({ ok: true, message });
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/messages", requireAdminToken, async (req, res, next) => {
  try {
    const messages = await readJson(MESSAGES_FILE, []);
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
  res.status(500).json({
    ok: false,
    error: "Something went wrong on the server."
  });
});

app.listen(PORT, () => {
  console.log(`DailyDoseofBCA running at http://localhost:${PORT}`);
});
