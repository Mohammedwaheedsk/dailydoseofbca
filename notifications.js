// --- NOTIFICATION HANDLER ---
// Default is INACTIVE — the admin controls this via the admin panel.
// If both the API and the JSON file fail to load, NO notification is shown.
let NOTIFICATION_CONFIG = {
    active: false,
    message: "",
    type: "info",
    link: "#",
    expireSeconds: 5
};

let lastConfigString = "";

async function fetchConfig() {
    try {
        const response = await fetch(`/api/notifications?v=${Date.now()}`).catch(() => null);
        const fallbackResponse = response && response.ok
            ? response
            : await fetch(`notification-config.json?v=${Date.now()}`);
        if (!fallbackResponse.ok) throw new Error('Failed to fetch config');
        
        const config = await fallbackResponse.json();
        const configString = JSON.stringify(config);
        
        // If config has changed, or if it's the first load
        if (configString !== lastConfigString) {
            NOTIFICATION_CONFIG = config;
            lastConfigString = configString;
            
            const existingNotif = document.getElementById('noir-notif');
            
            // If the notification was turned off but is currently showing, remove it
            if (!config.active) {
                if (existingNotif) {
                    existingNotif.classList.remove('active');
                    setTimeout(() => existingNotif.remove(), 600);
                }
                return;
            }
            
            // If the notification element exists, we should update it
            if (existingNotif) {
                // To apply icon, link, and text changes safely, we rebuild the notification
                existingNotif.remove();
                showNoirNotification();
            } else {
                // Otherwise show it
                showNoirNotification();
            }
        }
    } catch (err) {
        console.error("Notification Error:", err);
    }
}

// --- NOTIFICATION LOGIC ---
function showNoirNotification() {
    if (!NOTIFICATION_CONFIG.active) return;
    
    // Check if user has already dismissed THIS SPECIFIC message recently
    const dismissedTime = localStorage.getItem(`noir-notif-dismissed-${NOTIFICATION_CONFIG.message}`);
    if (dismissedTime) {
        const diff = Date.now() - parseInt(dismissedTime);
        if (diff < NOTIFICATION_CONFIG.expireSeconds * 1000) return;
    }

    // Create Notification Element if it doesn't exist
    if (!document.getElementById('noir-notif')) {
        const notif = document.createElement('div');
        notif.id = 'noir-notif';
        
        // Determine icon type
        const rawIcon = NOTIFICATION_CONFIG.icon || "";
        const isEmbed = rawIcon.includes('<div');
        const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(rawIcon);
        
        // Sanitize: if icon is a long sentence (not embed/image), use only the first emoji/char
        // This prevents a full sentence accidentally entered in the Icon field from breaking layout
        let safeIcon = rawIcon;
        if (!isEmbed && !isImage && rawIcon.length > 6) {
            // Extract first emoji or first character
            const emojiMatch = rawIcon.match(/\p{Emoji}/u);
            safeIcon = emojiMatch ? emojiMatch[0] : rawIcon.charAt(0);
        }
        
        let iconHtml = "";
        if (isEmbed) {
            iconHtml = `<div class="notif-icon-embed">${rawIcon}</div>`;
        } else if (isImage) {
            iconHtml = `<img src="${rawIcon}" class="notif-icon-img" alt="icon">`;
        } else {
            iconHtml = `<span class="notif-icon">${safeIcon || "✨"}</span>`;
        }

        notif.innerHTML = `
            <div class="notif-content">
                ${iconHtml}
                <p class="notif-text">${NOTIFICATION_CONFIG.message}</p>
                ${NOTIFICATION_CONFIG.link && NOTIFICATION_CONFIG.link !== "#" ? `<a href="${NOTIFICATION_CONFIG.link}" class="notif-link">View</a>` : ""}
                <button class="notif-close" id="close-notif">×</button>
            </div>
        `;

        // Inject Styles (only if not already present)
        if (!document.getElementById('noir-notif-styles')) {
            const style = document.createElement('style');
            style.id = 'noir-notif-styles';
            style.innerHTML = `
                #noir-notif {
                    position: fixed;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%) translateY(-150%);
                    width: calc(100vw - 40px);
                    max-width: 440px;
                    z-index: 10000;
                    background: rgba(20, 20, 30, 0.85);
                    backdrop-filter: blur(50px) saturate(180%);
                    -webkit-backdrop-filter: blur(50px) saturate(180%);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    border-top: 1px solid rgba(255, 255, 255, 0.35);
                    border-radius: 20px;
                    padding: 12px 16px;
                    box-shadow: 0 15px 45px rgba(0, 0, 0, 0.6);
                    transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1.1), opacity 0.4s;
                    opacity: 0;
                    box-sizing: border-box;
                }
                #noir-notif.active {
                    transform: translateX(-50%) translateY(0);
                    opacity: 1;
                }
                .notif-content {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    position: relative;
                    width: 100%;
                    overflow: hidden;
                }
                .notif-icon {
                    font-size: 1.3rem;
                    flex-shrink: 0;
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                    line-height: 1;
                }
                .notif-icon-img {
                    width: 28px;
                    height: 28px;
                    flex-shrink: 0;
                    object-fit: cover;
                    border-radius: 50%;
                }
                .notif-icon-embed {
                    width: 28px;
                    height: 28px;
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .notif-text {
                    flex: 1;
                    min-width: 0;
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: #fff;
                    line-height: 1.45;
                    margin: 0;
                    word-break: break-word;
                    overflow-wrap: break-word;
                    white-space: normal;
                }
                .notif-link {
                    background: rgba(255, 255, 255, 0.15);
                    color: #fff;
                    text-decoration: none;
                    padding: 5px 12px;
                    border-radius: 12px;
                    font-size: 0.82rem;
                    font-weight: 600;
                    white-space: nowrap;
                    flex-shrink: 0;
                    transition: background 0.2s;
                }
                .notif-link:active {
                    background: rgba(255, 255, 255, 0.3);
                }
                .notif-close {
                    background: none;
                    border: none;
                    color: rgba(255, 255, 255, 0.5);
                    font-size: 1.5rem;
                    cursor: pointer;
                    padding: 0 4px;
                    line-height: 1;
                    flex-shrink: 0;
                    transition: color 0.2s;
                }
                .notif-close:hover {
                    color: #fff;
                }
            `;
            document.head.appendChild(style);
        }

        
        document.body.appendChild(notif);

        // Load Tenor Script if embedding
        if (isEmbed && !document.getElementById('tenor-script')) {
            const script = document.createElement('script');
            script.id = 'tenor-script';
            script.src = "https://tenor.com/embed.js";
            script.async = true;
            document.head.appendChild(script);
        }

        // Show with delay
        setTimeout(() => {
            notif.classList.add('active');
        }, 1200);

        // Close logic
        document.getElementById('close-notif').onclick = () => {
            notif.classList.remove('active');
            // Store that THIS message has been dismissed
            localStorage.setItem(`noir-notif-dismissed-${NOTIFICATION_CONFIG.message}`, Date.now());
            setTimeout(() => notif.remove(), 600);
        };
    }
}

// Initial fetch and show
if (document.readyState === 'complete') {
    fetchConfig();
} else {
    window.addEventListener('load', fetchConfig);
}

// Periodically check for new messages (e.g., every 30 seconds for a "live" feel)
setInterval(fetchConfig, 30000);
