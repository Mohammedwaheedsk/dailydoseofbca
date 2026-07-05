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
      
      // Badge is purely visual — it never touches any links
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
    });
  } catch (err) {
    console.warn("Could not load dynamic status badges:", err);
  }
});
