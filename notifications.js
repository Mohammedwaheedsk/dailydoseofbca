// --- NOTIFICATION HANDLER ---
let NOTIFICATION_CONFIG = {
    active: true,
    message: "Site is under progress, every content from Sem 1 to Sem 4 are updated.",
    type: "info",
    link: "bca-sem4.html",
    expireSeconds: 24
};

let lastMessage = "";

async function fetchConfig() {
    try {
        // Fetch with a cache-busting timestamp so we always get the freshest version
        const response = await fetch(`notification-config.json?v=${Date.now()}`);
        if (!response.ok) throw new Error('Failed to fetch config');
        
        const config = await response.json();
        
        // If message has changed, or if it's the first load
        if (config.message !== lastMessage) {
            NOTIFICATION_CONFIG = config;
            lastMessage = config.message;
            
            // If the notification element exists, we should update it or resh-show it
            const existingNotif = document.getElementById('noir-notif');
            if (existingNotif) {
                // If it's active but the message changed, update text
                const textElem = existingNotif.querySelector('.notif-text');
                if (textElem) textElem.textContent = config.message;
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
        const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(NOTIFICATION_CONFIG.icon || "");
        const iconHtml = isImage 
            ? `<img src="${NOTIFICATION_CONFIG.icon}" class="notif-icon-img" alt="icon">` 
            : `<span class="notif-icon">${NOTIFICATION_CONFIG.icon || "✨"}</span>`;

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
                    top: 25px;
                    left: 50%;
                    transform: translateX(-50%) translateY(-150%);
                    width: calc(100% - 40px);
                    max-width: 450px;
                    z-index: 10000;
                    background: rgba(255, 255, 255, 0.08);
                    backdrop-filter: blur(50px) saturate(180%);
                    -webkit-backdrop-filter: blur(50px) saturate(180%);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    border-top: 1px solid rgba(255, 255, 255, 0.35);
                    border-radius: 20px;
                    padding: 12px 18px;
                    box-shadow: 0 15px 45px rgba(0, 0, 0, 0.6), inset 0 0 0 1px rgba(255, 255, 255, 0.05);
                    transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1.1), opacity 0.4s;
                    opacity: 0;
                }
                #noir-notif.active {
                    transform: translateX(-50%) translateY(0);
                    opacity: 1;
                }
                .notif-content {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    position: relative;
                }
                .notif-icon {
                    font-size: 1.2rem;
                }
                .notif-icon-img {
                    width: 24px;
                    height: 24px;
                    object-fit: contain;
                    border-radius: 6px;
                }
                .notif-text {
                    flex: 1;
                    font-size: 0.95rem;
                    font-weight: 500;
                    color: #fff;
                    line-height: 1.4;
                    margin: 0;
                    padding-right: 20px;
                }
                .notif-link {
                    background: rgba(255, 255, 255, 0.15);
                    color: #fff;
                    text-decoration: none;
                    padding: 5px 12px;
                    border-radius: 12px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    white-space: nowrap;
                    transition: background 0.2s;
                }
                .notif-link:active {
                    background: rgba(255, 255, 255, 0.3);
                }
                .notif-close {
                    background: none;
                    border: none;
                    color: rgba(255, 255, 255, 0.5);
                    font-size: 1.6rem;
                    cursor: pointer;
                    padding: 0 5px;
                    line-height: 1;
                    transition: color 0.2s;
                }
                .notif-close:hover {
                    color: #fff;
                }
            `;
            document.head.appendChild(style);
        }

        
        document.body.appendChild(notif);

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

