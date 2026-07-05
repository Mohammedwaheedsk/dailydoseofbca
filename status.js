document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch(`/api/config/subjects?v=\${Date.now()}`).catch(() => null);
    const fallbackResponse = response && response.ok
        ? response
        : await fetch(\`subjects-config.json?v=\${Date.now()}\`);
        
    if (!fallbackResponse.ok) throw new Error('Failed to load subjects config');
    
    const config = await fallbackResponse.json();
    const availableSubjects = config.availableSubjects || [];
    
    const cards = document.querySelectorAll('.card');
    
    cards.forEach(card => {
      // Find the subject name inside .subject
      const subjectEl = card.querySelector('.subject');
      if (!subjectEl) return;
      
      const subjectName = subjectEl.textContent.trim();
      
      // Determine if live
      // We check if the subjectName exactly matches any string in availableSubjects array
      // (Case insensitive match might be better for safety)
      const isLive = availableSubjects.some(live => live.toLowerCase() === subjectName.toLowerCase());
      
      // Create badge element
      const badge = document.createElement('span');
      if (isLive) {
        badge.className = 'status-badge status-available';
        badge.textContent = 'Available';
      } else {
        badge.className = 'status-badge status-incomplete';
        badge.textContent = 'Incomplete';
      }
      
      // Append badge to .card-header
      const cardHeader = card.querySelector('.card-header');
      if (cardHeader) {
        cardHeader.appendChild(badge);
      } else {
        // Fallback: just append to the card if header doesn't exist
        card.appendChild(badge);
      }
    });
  } catch (err) {
    console.warn("Could not load dynamic status badges:", err);
  }
});
