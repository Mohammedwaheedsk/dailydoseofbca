document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('subjects-config.json');
    if (!res.ok) throw new Error('Failed to load subjects config');
    
    const config = await res.json();
    const liveSubjects = config.liveSubjects || [];
    
    const cards = document.querySelectorAll('.card');
    
    cards.forEach(card => {
      // Find the subject name inside .subject
      const subjectEl = card.querySelector('.subject');
      if (!subjectEl) return;
      
      const subjectName = subjectEl.textContent.trim();
      
      // Determine if live
      // We check if the subjectName exactly matches any string in liveSubjects array
      // (Case insensitive match might be better for safety)
      const isLive = liveSubjects.some(live => live.toLowerCase() === subjectName.toLowerCase());
      
      // Create badge element
      const badge = document.createElement('span');
      if (isLive) {
        badge.className = 'status-badge status-live';
        badge.textContent = 'Live';
      } else {
        badge.className = 'status-badge status-pending';
        badge.textContent = 'Pending';
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
