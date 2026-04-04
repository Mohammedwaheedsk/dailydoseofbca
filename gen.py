import codecs

with codecs.open('index.html', 'r', 'utf-8') as f:
    html = f.read()

def inject(sem, notes, assign, lab_content):
    # Fix header
    res = html.replace(
        '<div class="brand" onclick="window.location.reload()">DailyDoseofBCA</div>', 
        f'<div class="brand" onclick="window.location.href=\'index.html\'">DailyDoseofBCA : Sem-{sem}</div>'
    )
    
    # Extract track
    start_str = '<div class="slider-track" id="track">'
    end_str = '    </div>\r\n  </div>\r\n\r\n  <!-- BOTTOM FLOATING NAV -->'
    if end_str not in res:
        end_str = '    </div>\n  </div>\n\n  <!-- BOTTOM FLOATING NAV -->'
        
    start_idx = res.find(start_str) + len(start_str)
    end_idx = res.find(end_str)
    
    content = f"""
      <!-- PAGE 1: NOTES -->
      <div class="slide">
        <div class="card">
          <div class="card-header"><span class="subject">All Notes</span></div>
          <p class="description">Access all subjects notes for Semester {sem}.</p>
          <a href="{notes}" class="action-btn">Open Notes</a>
        </div>
      </div>

      <!-- PAGE 2: ASSIGNMENTS -->
      <div class="slide">
        <div class="card">
          <div class="card-header"><span class="subject">All Assignments</span></div>
          <p class="description">Access all assignments for Semester {sem}.</p>
          <a href="{assign}" class="action-btn assign">Open Assignments</a>
        </div>
      </div>

      <!-- PAGE 3: LAB WORK -->
      <div class="slide">
{lab_content}
      </div>
"""
    res = res[:start_idx] + "\n" + content + "\n" + res[end_idx:]
    
    with codecs.open(f'bca-sem{sem}.html', 'w', 'utf-8') as f:
        f.write(res)

empty_lab = """        <div class="card" style="opacity: 0.5;">
          <div class="card-header"><span class="subject">No Lab Work</span></div>
          <p class="description">There are no lab manuals available.</p>
        </div>"""

lab2 = """        <div class="card">
          <div class="card-header"><span class="subject">All Lab Manuals</span></div>
          <p class="description">Access all lab manuals for Semester 2.</p>
          <a href="2-labmanual.html" class="action-btn lab">Open Lab Manuals</a>
        </div>"""

inject(1, "notes1.html", "assignment1.html", empty_lab)
inject(2, "2-notes.html", "2-assignment.html", lab2)
inject(3, "3-notes.html", "3-assignment.html", empty_lab)
print("Done")
