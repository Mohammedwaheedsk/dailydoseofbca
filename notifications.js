// --- NOTIFICATION CONFIGURATION (Admin controlled) ---
const NOTIFICATION_CONFIG = {
    active: true, // Set to false to hide the notification
    message: "Site is under progress, every content from Sem 1 to Sem 4 are updated.", // Your message here
    type: "info", // info, warning, success
    link: "bca-sem4.html", // Optional link, set to "#" if not needed
    expireSeconds: 24 // How often to show it to the same user (after dismissal)
};

// --- NOTIFICATION LOGIC ---
function showNoirNotification() {
    if (!NOTIFICATION_CONFIG.active) return;
    
    // Check if user has already dismissed it
    const dismissedTime = localStorage.getItem('noir-notif-dismissed');
    if (dismissedTime) {
        const diff = Date.now() - parseInt(dismissedTime);
        if (diff < NOTIFICATION_CONFIG.expireSeconds * 1000) return;
    }

    // Create Notification Element
    const notif = document.createElement('div');
    notif.id = 'noir-notif';
    notif.innerHTML = `
        <div class="notif-content">
            <span class="notif-icon">✨</span>
            <p class="notif-text">${NOTIFICATION_CONFIG.message}</p>
            ${NOTIFICATION_CONFIG.link !== "#" ? `<a href="${NOTIFICATION_CONFIG.link}" class="notif-link">View</a>` : ""}
            <button class="notif-close" id="close-notif">×</button>
        </div>
    `;

    // Inject Styles
    const style = document.createElement('style');
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
    document.body.appendChild(notif);

    // Show with delay
    setTimeout(() => {
        notif.classList.add('active');
    }, 1200);

    // Close logic
    document.getElementById('close-notif').onclick = () => {
        notif.classList.remove('active');
        localStorage.setItem('noir-notif-dismissed', Date.now());
        setTimeout(() => notif.remove(), 600);
    };
}

// Initialize
if (document.readyState === 'complete') {
    showNoirNotification();
} else {
    window.addEventListener('load', showNoirNotification);
}
