const fs = require('fs');

const files = [
  'bca-sem1.html',
  'bca-sem2.html',
  'bca-sem3.html',
  'bca-sem4.html',
  'bca-sem5.html',
  'bca-sem6.html',
];

const CSS_VAR_INJECTION = `
    /* Keyboard Safe Area */
    :root {
      --chat-safe-area: 110px;
    }
    .chat-safe-area {
      height: var(--chat-safe-area);
      flex-shrink: 0;
      width: 100%;
      background-color: transparent;
      transition: height 0.2s ease-out;
    }
`;

const NEW_SCRIPT = `  <script>
    // Keyboard visibility handler
    (function () {
      if (!window.visualViewport) return;
      let baseHeight = window.visualViewport.height;
      let kbTimer = null;

      window.addEventListener('orientationchange', () => {
        setTimeout(() => { baseHeight = window.visualViewport.height; }, 300);
      });

      window.visualViewport.addEventListener('resize', () => {
        const nav = document.querySelector('.nav-wrapper');
        const ratio = window.visualViewport.height / baseHeight;
        const isKeyboardOpen = ratio < 0.85;

        if (isKeyboardOpen) {
          // Keyboard is open — hide nav and remove safe area
          if (nav) {
            nav.style.opacity = '0';
            nav.style.pointerEvents = 'none';
            nav.style.transform = 'translateY(20px)';
          }
          document.documentElement.style.setProperty('--chat-safe-area', '0px');
          
          // Force scroll to top so the body isn't pushed up weirdly by iOS
          window.scrollTo(0, 0);
          document.body.scrollTop = 0;
        } else {
          // Keyboard closed — restore nav and safe area
          document.documentElement.style.setProperty('--chat-safe-area', '110px');
          if (nav) {
            clearTimeout(kbTimer);
            kbTimer = setTimeout(() => {
              nav.style.opacity = '';
              nav.style.pointerEvents = '';
              nav.style.transform = '';
            }, 120);
          }
        }
      });
    })();
  </script>`;

let count = 0;
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // 1. Inject CSS for safe area
  if (!content.includes('--chat-safe-area')) {
    content = content.replace('/* ---- CHAT SLIDE STYLES ---- */', CSS_VAR_INJECTION + '    /* ---- CHAT SLIDE STYLES ---- */');
  }

  // 2. Fix CSS rules
  // Fix chat-slide
  content = content.replace(/\.chat-slide \{[\s\S]*?position: relative;\s*\}/, `.chat-slide {
      background-color: #000;
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
      padding: 0 !important;
      position: relative;
    }`);

  // Fix auth-wrap
  content = content.replace(/\.chat-auth-wrap \{[\s\S]*?gap: 14px;\s*\}/, `.chat-auth-wrap {
      flex: 1;
      overflow-y: auto;
      padding: 20px 20px 0 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }`);

  // Fix chat-send-bar
  content = content.replace(/\/\* Send bar — sticky[\s\S]*?z-index: 10;\s*\}/, `/* Send bar */
    .chat-send-bar {
      display: flex;
      gap: 10px;
      padding: 12px 16px 12px;
      flex-shrink: 0;
      border-top: 1px solid rgba(255,255,255,0.06);
      background-color: #000;
      align-items: center;
    }`);

  // 3. Inject safe area divs
  // In auth-wrap
  if (!content.includes('<div class="chat-safe-area"></div>\n        </div>\n\n        <!-- CHAT AREA -->')) {
      content = content.replace(/<\/p>\n\s*<\/div>\n\n\s*<!-- CHAT AREA -->/, `</p>\n          <div class="chat-safe-area"></div>\n        </div>\n\n        <!-- CHAT AREA -->`);
  }

  // In chat-main
  if (!content.includes('<div class="chat-safe-area"></div>\n        </div>\n      </div>\n\n    </div>')) {
      content = content.replace(/<\/svg>\n\s*<\/button>\n\s*<\/div>\n\s*<\/div>\n\s*<\/div>\n\n\s*<\/div>/, `</svg>\n            </button>\n          </div>\n          <div class="chat-safe-area"></div>\n        </div>\n      </div>\n\n    </div>`);
  }

  // 4. Update JS Script
  content = content.replace(/<script>\n\s*\/\/ Keyboard visibility handler[\s\S]*?<\/script>/, NEW_SCRIPT);
  
  // 5. Fix link for PHP notes in bca-sem5.html specifically
  if (file === 'bca-sem5.html') {
    // PHP link
    content = content.replace(
      `<a href="https://drive.google.com/file/d/1ldg0evQU-VgHqkJEBCaw6K3teLvI7pyV/view?usp=sharing" class="action-btn">Open PDF</a>\n        </div>\n        <div class="card">\n          <div class="card-header">\n            <div class="subject-group"><span class="subject">WEB</span>`,
      `<a href="#" class="action-btn">Open PDF</a>\n        </div>\n        <div class="card">\n          <div class="card-header">\n            <div class="subject-group"><span class="subject">WEB</span>`
    );
    // MM link
    content = content.replace(
      `<div class="subject-group"><span class="subject">Mobile Marketing</span></div>\n          </div>\n          <p class="description">Notes for Mobile Marketing.</p>\n          <a href="#" class="action-btn">Open PDF</a>`,
      `<div class="subject-group"><span class="subject">Mobile Marketing</span></div>\n          </div>\n          <p class="description">Notes for Mobile Marketing.</p>\n          <a href="https://drive.google.com/file/d/1ldg0evQU-VgHqkJEBCaw6K3teLvI7pyV/view?usp=sharing" class="action-btn">Open PDF</a>`
    );
  }

  fs.writeFileSync(file, content, 'utf8');
  console.log(`✅ Applied robust safe-area logic to ${file}`);
  count++;
}
console.log(`\n${count}/${files.length} files updated.`);
