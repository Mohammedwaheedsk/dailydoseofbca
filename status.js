document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch(`/api/config/subjects?v=${Date.now()}`).catch(() => null);
    const fallbackResponse = response && response.ok
        ? response
        : await fetch(`subjects-config.json?v=${Date.now()}`);
        
    if (!fallbackResponse.ok) throw new Error('Failed to load subjects config');
    
    const config = await fallbackResponse.json();
    const availableSubjects = config.availableSubjects || [];
    
    const cards = document.querySelectorAll('.card');
    
    cards.forEach(card => {
      const subjectEl = card.querySelector('.subject');
      if (!subjectEl) return;
      
      const subjectName = subjectEl.textContent.trim();
      const isAvailable = availableSubjects.some(s => s.toLowerCase() === subjectName.toLowerCase());
      
      // Create badge
      const badge = document.createElement('span');
      if (isAvailable) {
        badge.className = 'status-badge status-available';
        badge.textContent = 'Available';
      } else {
        badge.className = 'status-badge status-incomplete';
        badge.textContent = 'Incomplete';
      }
      
      const cardHeader = card.querySelector('.card-header');
      if (cardHeader) {
        cardHeader.appendChild(badge);
      } else {
        card.appendChild(badge);
      }

      // If subject is Incomplete, check every action-btn link on the card
      // - If the link already has a real URL (not # and not empty), LEAVE IT ALONE — let it open
      // - If the link is # (no PDF uploaded yet), gray it out and prevent the useless scroll-to-top
      if (!isAvailable) {
        const links = card.querySelectorAll('.action-btn');
        links.forEach(link => {
          const href = link.getAttribute('href');
          const isReal = href && href !== '#' && href.trim() !== '';
          if (!isReal) {
            // No real link — disable gracefully
            link.addEventListener('click', e => e.preventDefault());
            link.style.opacity = '0.4';
            link.style.cursor = 'not-allowed';
            link.title = 'Not yet available';
          }
          // Real link → do nothing, let it open normally
        });
      }
    });
  } catch (err) {
    console.warn("Could not load dynamic status badges:", err);
  }
});
