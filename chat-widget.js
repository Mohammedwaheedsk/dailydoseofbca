(function () {
  const PROFILE_KEY = "ddobca-chat-profile";
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

      .ddobca-chat-foot {
        padding: 12px;
        border-top: 1px solid rgba(255, 255, 255, 0.12);
      }

      .ddobca-message-form {
        grid-template-columns: 1fr auto;
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
        <input name="message" maxlength="500" autocomplete="off" placeholder="Message as ${escapeHtml(state.profile.name)}" required>
        <button type="submit">Send</button>
      </form>
    `;
    document.getElementById("ddobca-message-form").addEventListener("submit", sendMessage);
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
          <input name="pin" type="password" inputmode="numeric" autocomplete="current-password" minlength="4" maxlength="4" pattern="\\d{4}" placeholder="1234" required>
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
      const response = await fetch(`/api/chat/messages?v=${Date.now()}`);
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
              <div class="ddobca-message-text">${escapeHtml(item.message)}</div>
            </article>
          `;
        }).join("");
      }

      const body = document.getElementById("ddobca-chat-body");
      body.scrollTop = body.scrollHeight;
    } catch (error) {
      messagesEl.innerHTML = `<p class="ddobca-empty">${escapeHtml(error.message)}</p>`;
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!state.profile) {
      resetProfileWithMessage("Create or login to your profile before chatting.");
      return;
    }

    const form = event.currentTarget;
    const input = form.elements.message;
    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    try {
      const response = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: state.profile.id,
          message: text
        })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Could not send message.");
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
