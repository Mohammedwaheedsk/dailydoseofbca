const fs = require("fs/promises");
const path = require("path");
const express = require("express");
require("dotenv").config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");
const NOTIFICATION_FILE = path.join(ROOT_DIR, "notification-config.json");
const SITE_CONFIG_FILE = path.join(ROOT_DIR, "site-config.json");

app.disable("x-powered-by");
app.use(express.json({ limit: "80kb" }));
app.use(express.urlencoded({ extended: true, limit: "80kb" }));

async function readJson(filePath, fallback) {
  try {
    const data = await fs.readFile(filePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
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
