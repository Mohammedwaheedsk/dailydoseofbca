(function () {
  const PROFILE_KEY = "ddobca-chat-profile";
  const VIEWED_MEDIA_KEY = "ddobca-viewed-media";
  const MAX_MEDIA_BYTES = 8 * 1024 * 1024;
  const POLL_MS = 8000;
  let pollTimer = null;

  const state = {
    profile: readProfile(),
    authMode: "login",
    isOpen: false
  };

  function readProfile() {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_KEY) || "null");
    } catch (error) {
      return null;
    }
  }

  function saveProfile(profile) {
    state.profile = profile;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }

  function readViewedMedia() {
    try {
      return JSON.parse(localStorage.getItem(VIEWED_MEDIA_KEY) || "[]");
    } catch (error) {
      return [];
    }
  }

  function markMediaViewed(messageId) {
    const viewed = new Set(readViewedMedia());
    viewed.add(messageId);
    localStorage.setItem(VIEWED_MEDIA_KEY, JSON.stringify([...viewed].slice(-500)));
  }

  function hasViewedMedia(messageId) {
    return readViewedMedia().includes(messageId);
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[character]);
  }

  function formatTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function createWidget() {
    if (document.getElementById("ddobca-chat")) return;

    const style = document.createElement("style");
    style.textContent = `
      #ddobca-chat-button {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 9998;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 999px;
        padding: 12px 16px;
        background: rgba(12, 18, 28, 0.86);
        color: #fff;
        box-shadow: 0 16px 42px rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        font: 700 0.95rem system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        cursor: pointer;
      }

      #ddobca-chat {
        position: fixed;
        right: 18px;
        bottom: 76px;
        z-index: 9999;
        width: min(380px, calc(100vw - 28px));
        height: min(580px, calc(100vh - 112px));
        display: none;
        grid-template-rows: auto 1fr auto;
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 8px;
        overflow: hidden;
        background: rgba(13, 17, 25, 0.96);
        color: #f8fafc;
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.56);
        backdrop-filter: blur(28px);
        -webkit-backdrop-filter: blur(28px);
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      #ddobca-chat.open {
        display: grid;
      }

      .ddobca-chat-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        padding: 13px 14px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      }

      .ddobca-chat-title {
        display: grid;
        gap: 2px;
      }

      .ddobca-chat-title strong {
        font-size: 0.98rem;
      }

      .ddobca-chat-title span {
        color: #a8b0bf;
        font-size: 0.78rem;
      }

      .ddobca-chat-actions {
        display: flex;
        align-items: center;
        gap: 7px;
      }

      .ddobca-chat-logout {
        display: none;
        min-height: 34px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.07);
        color: #fff;
        padding: 0 10px;
        font: 800 0.78rem system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        cursor: pointer;
      }

      #ddobca-chat.has-profile .ddobca-chat-logout {
        display: inline-flex;
        align-items: center;
      }

      .ddobca-chat-close {
        width: 34px;
        height: 34px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.07);
        color: #fff;
        font-size: 1.2rem;
        cursor: pointer;
      }

      .ddobca-chat-body {
        min-height: 0;
        overflow: auto;
        padding: 14px;
      }

      .ddobca-profile-form,
      .ddobca-message-form {
        display: grid;
        gap: 10px;
      }

      .ddobca-auth-tabs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-bottom: 12px;
      }

      .ddobca-auth-tab {
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.06);
        color: #fff;
        padding: 10px;
        font: 800 0.88rem system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        cursor: pointer;
      }

      .ddobca-auth-tab.active {
        background: rgba(56, 189, 248, 0.18);
        border-color: rgba(56, 189, 248, 0.36);
      }

      .ddobca-profile-form label {
        display: grid;
        gap: 6px;
        color: #a8b0bf;
        font-size: 0.82rem;
        font-weight: 700;
      }

      .ddobca-profile-form input,
      .ddobca-message-form input {
        width: 100%;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 8px;
        background: rgba(0, 0, 0, 0.28);
        color: #fff;
        padding: 11px 12px;
        font: inherit;
        outline: none;
      }

      .ddobca-profile-form button,
      .ddobca-message-form button {
        border: 0;
        border-radius: 8px;
        padding: 11px 13px;
        background: linear-gradient(135deg, #38bdf8, #86efac);
        color: #061018;
        font-weight: 800;
        cursor: pointer;
      }

      .ddobca-profile-form .ddobca-secondary-button {
        border: 1px solid rgba(255, 255, 255, 0.16);
        background: rgba(255, 255, 255, 0.07);
        color: #f8fafc;
      }

      .ddobca-chat-status {
        margin: 0;
        min-height: 18px;
        color: #fb7185;
        font-size: 0.82rem;
      }

      .ddobca-messages {
        display: grid;
        align-content: end;
        gap: 10px;
        min-height: 100%;
      }

      .ddobca-message {
        display: grid;
        gap: 3px;
        padding: 10px 11px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      .ddobca-message.mine {
        background: rgba(56, 189, 248, 0.16);
        border-color: rgba(56, 189, 248, 0.24);
      }

      .ddobca-message-meta {
        color: #a8b0bf;
        font-size: 0.74rem;
        overflow-wrap: anywhere;
      }

      .ddobca-message-text {
        color: #fff;
        line-height: 1.4;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
      }

      .ddobca-seen {
        justify-self: end;
        max-width: 100%;
        color: #a8b0bf;
        font-size: 0.7rem;
        line-height: 1.25;
        overflow-wrap: anywhere;
        text-align: right;
      }

      .ddobca-media {
        display: grid;
        gap: 8px;
        margin-top: 8px;
      }

      .ddobca-media img,
      .ddobca-media video {
        width: 100%;
        max-height: 220px;
        border-radius: 8px;
        object-fit: contain;
        background: rgba(0, 0, 0, 0.28);
      }

      .ddobca-media audio {
        width: 100%;
      }

      .ddobca-media-button {
        border: 1px solid rgba(56, 189, 248, 0.28);
        border-radius: 8px;
        padding: 9px 10px;
        background: rgba(56, 189, 248, 0.12);
        color: #7dd3fc;
        font-weight: 800;
        text-align: center;
        text-decoration: none;
        cursor: pointer;
      }

      .ddobca-view-once-note {
        color: #fbbf24;
        font-size: 0.74rem;
      }

      .ddobca-chat-foot {
        padding: 12px;
        border-top: 1px solid rgba(255, 255, 255, 0.12);
      }

      .ddobca-message-form {
        grid-template-columns: auto auto 1fr auto;
        align-items: center;
      }

      .ddobca-attach-button,
      .ddobca-camera-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 42px;
        height: 42px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.07);
        color: #fff;
        font-weight: 900;
        cursor: pointer;
      }

      .ddobca-message-form input[type="file"] {
        position: absolute;
        width: 1px;
        height: 1px;
        opacity: 0;
        pointer-events: none;
      }

      .ddobca-send-options {
        grid-column: 1 / -1;
        display: none;
        gap: 10px;
        color: #a8b0bf;
        font-size: 0.78rem;
      }

      .ddobca-send-options.has-file {
        display: grid;
      }

      .ddobca-media-preview {
        display: grid;
        gap: 8px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 8px;
        padding: 9px;
        background: rgba(255, 255, 255, 0.06);
      }

      .ddobca-media-preview img,
      .ddobca-media-preview video {
        width: 100%;
        max-height: 150px;
        border-radius: 8px;
        object-fit: contain;
        background: rgba(0, 0, 0, 0.24);
      }

      .ddobca-media-preview audio {
        width: 100%;
      }

      .ddobca-preview-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .ddobca-preview-name {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .ddobca-view-once-toggle {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
      }

      .ddobca-empty {
        color: #a8b0bf;
        text-align: center;
        margin: auto;
        line-height: 1.5;
      }

      @media (max-width: 520px) {
        #ddobca-chat {
          right: 12px;
          bottom: 70px;
          width: calc(100vw - 24px);
          height: min(560px, calc(100vh - 96px));
        }

        #ddobca-chat-button {
          right: 12px;
          bottom: 12px;
        }
      }
    `;
    document.head.appendChild(style);

    const button = document.createElement("button");
    button.id = "ddobca-chat-button";
    button.type = "button";
    button.textContent = "Messages";

    const widget = document.createElement("aside");
    widget.id = "ddobca-chat";
    widget.setAttribute("aria-label", "DailyDoseofBCA messages");
    widget.innerHTML = `
      <div class="ddobca-chat-head">
        <div class="ddobca-chat-title">
          <strong>Messages</strong>
          <span>Public chat, messages clear after 24 hours</span>
        </div>
        <div class="ddobca-chat-actions">
          <button class="ddobca-chat-logout" type="button">Logout</button>
          <button class="ddobca-chat-close" type="button" aria-label="Close messages">x</button>
        </div>
      </div>
      <div class="ddobca-chat-body" id="ddobca-chat-body"></div>
      <div class="ddobca-chat-foot" id="ddobca-chat-foot"></div>
    `;

    document.body.appendChild(button);
    document.body.appendChild(widget);

    button.addEventListener("click", () => {
      state.isOpen = !state.isOpen;
      widget.classList.toggle("open", state.isOpen);
      render();
      if (state.isOpen && state.profile) loadMessages();
    });

    widget.querySelector(".ddobca-chat-close").addEventListener("click", () => {
      state.isOpen = false;
      widget.classList.remove("open");
    });

    widget.querySelector(".ddobca-chat-logout").addEventListener("click", logoutProfile);

    render();
    pollTimer = window.setInterval(() => {
      if (state.isOpen && state.profile) loadMessages();
    }, POLL_MS);
  }

  function render() {
    const body = document.getElementById("ddobca-chat-body");
    const foot = document.getElementById("ddobca-chat-foot");
    const widget = document.getElementById("ddobca-chat");
    if (!body || !foot) return;
    if (widget) widget.classList.toggle("has-profile", Boolean(state.profile));

    if (!state.profile) {
      const isSignup = state.authMode === "signup";
      body.innerHTML = `
        <div class="ddobca-auth-tabs" role="tablist" aria-label="Chat account">
          <button class="ddobca-auth-tab ${!isSignup ? "active" : ""}" type="button" data-auth-mode="login">Login</button>
          <button class="ddobca-auth-tab ${isSignup ? "active" : ""}" type="button" data-auth-mode="signup">Signup</button>
        </div>
        ${isSignup ? signupFormHtml() : loginFormHtml()}
      `;
      foot.innerHTML = "";
      body.querySelectorAll("[data-auth-mode]").forEach((button) => {
        button.addEventListener("click", () => {
          state.authMode = button.dataset.authMode;
          render();
        });
      });
      const authForm = document.getElementById("ddobca-profile-form");
      authForm.addEventListener("submit", isSignup ? createProfile : loginProfile);
      const forgotPinButton = document.getElementById("ddobca-forgot-pin");
      if (forgotPinButton) forgotPinButton.addEventListener("click", forgotPin);
      return;
    }

    body.innerHTML = '<div class="ddobca-messages" id="ddobca-messages"><p class="ddobca-empty">Loading messages...</p></div>';
    foot.innerHTML = `
      <form class="ddobca-message-form" id="ddobca-message-form">
        <label class="ddobca-attach-button" title="Attach file">
          +
          <input name="media" type="file" accept="image/*,video/*,audio/*,application/pdf">
        </label>
        <label class="ddobca-camera-button" title="Take photo">
          Cam
          <input name="camera" type="file" accept="image/*" capture="environment">
        </label>
        <input name="message" maxlength="500" autocomplete="off" placeholder="Message as ${escapeHtml(state.profile.name)}">
        <button type="submit">Send</button>
        <div class="ddobca-send-options" id="ddobca-send-options">
          <div class="ddobca-media-preview" id="ddobca-media-preview"></div>
          <label class="ddobca-view-once-toggle"><input name="viewOnce" type="checkbox"> View once</label>
        </div>
      </form>
    `;
    const messageForm = document.getElementById("ddobca-message-form");
    messageForm.addEventListener("submit", sendMessage);
    messageForm.elements.media.addEventListener("change", updateSelectedFileName);
    messageForm.elements.camera.addEventListener("change", updateSelectedFileName);
  }

  function loginFormHtml() {
    return `
      <form class="ddobca-profile-form" id="ddobca-profile-form">
        <label>
          Username or name
          <input name="login" autocomplete="username" maxlength="80" placeholder="username or Name" required>
        </label>
        <label>
          4-digit PIN
          <input name="pin" type="password" inputmode="numeric" autocomplete="current-password" minlength="4" maxlength="4" pattern="\\d{4}" placeholder="<PIN>" required>
        </label>
        <button type="submit">Login</button>
        <button class="ddobca-secondary-button" id="ddobca-forgot-pin" type="button">Forgot PIN?</button>
        <p class="ddobca-chat-status" id="ddobca-profile-status"></p>
      </form>
    `;
  }

  function signupFormHtml() {
    return `
      <form class="ddobca-profile-form" id="ddobca-profile-form">
        <label>
          Username
          <input name="username" autocomplete="username" minlength="3" maxlength="24" pattern="[a-zA-Z0-9_]+" placeholder="username" required>
        </label>
        <label>
          Name
          <input name="name" autocomplete="name" maxlength="80" placeholder="Your name" required>
        </label>
        <label>
          4-digit PIN
          <input name="pin" type="password" inputmode="numeric" autocomplete="new-password" minlength="4" maxlength="4" pattern="\\d{4}" placeholder="<PIN>" required>
        </label>
        <button type="submit">Create profile</button>
        <p class="ddobca-chat-status" id="ddobca-profile-status"></p>
      </form>
    `;
  }

  async function createProfile(event) {
    event.preventDefault();
    const status = document.getElementById("ddobca-profile-status");
    status.textContent = "Creating...";

    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (state.profile && state.profile.id) payload.profileId = state.profile.id;

    try {
      const response = await fetch("/api/chat/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Could not create profile.");
      saveProfile(data.profile);
      render();
      await loadMessages();
    } catch (error) {
      status.textContent = error.message;
    }
  }

  async function loginProfile(event) {
    event.preventDefault();
    const status = document.getElementById("ddobca-profile-status");
    status.textContent = "Logging in...";

    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());

    try {
      const response = await fetch("/api/chat/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Could not login.");
      saveProfile(data.profile);
      render();
      await loadMessages();
    } catch (error) {
      status.textContent = error.message;
    }
  }

  async function forgotPin() {
    const form = document.getElementById("ddobca-profile-form");
    const status = document.getElementById("ddobca-profile-status");
    const login = form && form.elements.login ? form.elements.login.value.trim() : "";
    if (!status) return;

    if (!login) {
      status.textContent = "Enter your username or name first.";
      return;
    }

    status.textContent = "Notifying admin...";
    try {
      const response = await fetch("/api/chat/forgot-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Could not notify admin.");
      status.textContent = data.message || "Admin has been notified.";
    } catch (error) {
      status.textContent = error.message;
    }
  }

  function logoutProfile() {
    localStorage.removeItem(PROFILE_KEY);
    state.profile = null;
    state.authMode = "login";
    render();
  }

  function resetProfileWithMessage(message) {
    localStorage.removeItem(PROFILE_KEY);
    state.profile = null;
    state.authMode = "login";
    render();
    const status = document.getElementById("ddobca-profile-status");
    if (status) status.textContent = message;
  }

  async function loadMessages() {
    if (!state.profile) return;
    const messagesEl = document.getElementById("ddobca-messages");
    if (!messagesEl) return;

    try {
      const response = await fetch(`/api/chat/messages?profileId=${encodeURIComponent(state.profile.id)}&v=${Date.now()}`);
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Could not load messages.");

      if (!data.messages.length) {
        messagesEl.innerHTML = '<p class="ddobca-empty">No messages yet. Start the chat.</p>';
      } else {
        messagesEl.innerHTML = data.messages.map((item) => {
          const mine = item.profileId === state.profile.id ? " mine" : "";
          return `
            <article class="ddobca-message${mine}">
              <div class="ddobca-message-meta">${escapeHtml(item.name)} (@${escapeHtml(item.username)}) - ${escapeHtml(formatTime(item.createdAt))}</div>
              ${item.message ? `<div class="ddobca-message-text">${escapeHtml(item.message)}</div>` : ""}
              ${mediaHtml(item)}
              ${seenHtml(item)}
            </article>
          `;
        }).join("");

        messagesEl.querySelectorAll("[data-open-media]").forEach((button) => {
          button.addEventListener("click", () => openMedia(button.dataset.openMedia));
        });
      }

      const body = document.getElementById("ddobca-chat-body");
      body.scrollTop = body.scrollHeight;
    } catch (error) {
      messagesEl.innerHTML = `<p class="ddobca-empty">${escapeHtml(error.message)}</p>`;
    }
  }

  function updateSelectedFileName(event) {
    const options = document.getElementById("ddobca-send-options");
    const preview = document.getElementById("ddobca-media-preview");
    const file = event.currentTarget.files && event.currentTarget.files[0];
    const form = document.getElementById("ddobca-message-form");
    if (file && form) {
      const otherInputName = event.currentTarget.name === "camera" ? "media" : "camera";
      if (form.elements[otherInputName]) form.elements[otherInputName].value = "";
    }
    renderSelectedMediaPreview(file, options, preview);
  }

  function renderSelectedMediaPreview(file, options, preview) {
    if (!options || !preview) return;
    if (!file) {
      options.classList.remove("has-file");
      preview.innerHTML = "";
      return;
    }

    options.classList.add("has-file");
    const kind = mediaKind(file);
    const objectUrl = URL.createObjectURL(file);
    const name = escapeHtml(file.name);
    let previewMedia = `<a class="ddobca-media-button" href="${objectUrl}" target="_blank" rel="noopener">Preview ${name}</a>`;

    if (kind === "image") {
      previewMedia = `<img src="${objectUrl}" alt="${name}">`;
    } else if (kind === "video") {
      previewMedia = `<video src="${objectUrl}" controls></video>`;
    } else if (kind === "audio") {
      previewMedia = `<audio src="${objectUrl}" controls></audio>`;
    } else if (kind === "pdf") {
      previewMedia = `<a class="ddobca-media-button" href="${objectUrl}" target="_blank" rel="noopener">Preview PDF</a>`;
    }

    preview.innerHTML = `
      ${previewMedia}
      <div class="ddobca-preview-meta">
        <span class="ddobca-preview-name">${name}</span>
        <span>${Math.max(1, Math.round(file.size / 1024))} KB</span>
      </div>
    `;
  }

  function mediaKind(file) {
    if (!file) return "";
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("audio/")) return "audio";
    if (file.type === "application/pdf") return "pdf";
    return "";
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Could not read the selected file."));
      reader.readAsDataURL(file);
    });
  }

  async function selectedMediaPayload(file) {
    if (!file) return null;
    const kind = mediaKind(file);
    if (!kind) throw new Error("Only images, videos, audio files, and PDFs can be sent.");
    if (file.size > MAX_MEDIA_BYTES) throw new Error("Media file must be 8 MB or smaller.");
    return {
      kind,
      name: file.name,
      mimeType: file.type,
      size: file.size,
      data: await fileToDataUrl(file)
    };
  }

  function mediaHtml(item) {
    const media = item.media;
    if (!media) return "";
    if (item.viewOnce && hasViewedMedia(item.id)) {
      return '<div class="ddobca-view-once-note">View-once media already opened on this device.</div>';
    }

    if (item.viewOnce) {
      return `
        <div class="ddobca-media">
          <button class="ddobca-media-button" type="button" data-open-media="${escapeHtml(item.id)}">Open view-once ${escapeHtml(media.kind || "media")}</button>
          <span class="ddobca-view-once-note">This media can be opened once.</span>
        </div>
      `;
    }

    if (media.kind === "image") {
      return `<div class="ddobca-media"><img src="${escapeHtml(media.data)}" alt="${escapeHtml(media.name)}"></div>`;
    }

    if (media.kind === "video") {
      return `<div class="ddobca-media"><video src="${escapeHtml(media.data)}" controls></video></div>`;
    }

    if (media.kind === "audio") {
      return `<div class="ddobca-media"><audio src="${escapeHtml(media.data)}" controls></audio></div>`;
    }

    if (media.kind === "pdf") {
      return `<div class="ddobca-media"><a class="ddobca-media-button" href="${escapeHtml(media.data)}" target="_blank" rel="noopener">Open PDF: ${escapeHtml(media.name)}</a></div>`;
    }

    return "";
  }

  function seenHtml(item) {
    const seenBy = (Array.isArray(item.seenBy) ? item.seenBy : [])
      .filter((seen) => seen && seen.profileId !== item.profileId && seen.name);
    if (!seenBy.length) return "";

    const names = [...new Map(seenBy.map((seen) => [seen.profileId, seen.name])).values()];
    let label = "";
    if (names.length === 1) {
      label = names[0];
    } else if (names.length <= 3) {
      label = names.join(", ");
    } else {
      label = `${names[0]}, ${names[1]} +${names.length - 2}`;
    }

    return `<div class="ddobca-seen">Seen by ${escapeHtml(label)}</div>`;
  }

  async function openMedia(messageId) {
    try {
      const response = await fetch(`/api/chat/messages/${encodeURIComponent(messageId)}/open-media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: state.profile ? state.profile.id : "" })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Media is no longer available.");
      markMediaViewed(messageId);
      const media = data.media;
      const opened = window.open("", "_blank", "noopener");
      if (opened) {
        opened.document.write(mediaDocument(media));
        opened.document.close();
      } else {
        window.location.href = media.data;
      }
      await loadMessages();
    } catch (error) {
      const messagesEl = document.getElementById("ddobca-messages");
      if (messagesEl) messagesEl.innerHTML = `<p class="ddobca-empty">${escapeHtml(error.message)}</p>`;
    }
  }

  function mediaDocument(media) {
    const title = escapeHtml(media.name || "Media");
    let body = `<a href="${escapeHtml(media.data)}" download="${title}">Download ${title}</a>`;
    if (media.kind === "image") body = `<img src="${escapeHtml(media.data)}" alt="${title}">`;
    if (media.kind === "video") body = `<video src="${escapeHtml(media.data)}" controls autoplay></video>`;
    if (media.kind === "audio") body = `<audio src="${escapeHtml(media.data)}" controls autoplay></audio>`;
    if (media.kind === "pdf") body = `<iframe src="${escapeHtml(media.data)}" title="${title}"></iframe>`;
    return `
      <!doctype html>
      <html>
        <head>
          <title>${title}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #05070a; color: #fff; font-family: system-ui, sans-serif; }
            img, video { max-width: 100%; max-height: 100vh; }
            audio { width: min(560px, calc(100vw - 32px)); }
            iframe { width: 100vw; height: 100vh; border: 0; background: #fff; }
            a { color: #7dd3fc; font-weight: 800; }
          </style>
        </head>
        <body>${body}</body>
      </html>
    `;
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!state.profile) {
      resetProfileWithMessage("Create or login to your profile before chatting.");
      return;
    }

    const form = event.currentTarget;
    const input = form.elements.message;
    const fileInput = form.elements.media.files[0] ? form.elements.media : form.elements.camera;
    const text = input.value.trim();
    const file = fileInput.files && fileInput.files[0];
    if (!text && !file) return;

    input.value = "";
    try {
      const media = await selectedMediaPayload(file);
      const response = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: state.profile.id,
          message: text,
          media,
          viewOnce: Boolean(form.elements.viewOnce.checked)
        })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Could not send message.");
      form.elements.media.value = "";
      form.elements.camera.value = "";
      form.elements.viewOnce.checked = false;
      renderSelectedMediaPreview(
        null,
        document.getElementById("ddobca-send-options"),
        document.getElementById("ddobca-media-preview")
      );
      await loadMessages();
    } catch (error) {
      input.value = text;
      if (/create your profile/i.test(error.message)) {
        resetProfileWithMessage("Please login again to send messages.");
      } else {
        const messagesEl = document.getElementById("ddobca-messages");
        if (messagesEl) {
          messagesEl.innerHTML = `<p class="ddobca-empty">${escapeHtml(error.message)}</p>`;
        }
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createWidget);
  } else {
    createWidget();
  }

  window.addEventListener("beforeunload", () => {
    if (pollTimer) window.clearInterval(pollTimer);
  });
})();
