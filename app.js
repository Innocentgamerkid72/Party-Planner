/* ═══════════════════════════════════════════════════════════
   Party Planner — app.js
   ═══════════════════════════════════════════════════════════ */

// ── State ──────────────────────────────────────────────────
const state = {
  events:         JSON.parse(localStorage.getItem('pp_events') || '[]'),
  currentEventId: null,
  simRunning:     false,
  simFrame:       null,
  simTime:        0,
};

function saveState() {
  localStorage.setItem('pp_events', JSON.stringify(state.events));
}

function getCurrentEvent() {
  return state.events.find(e => e.id === state.currentEventId) || null;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getInitials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0,2).map(w => w[0]).join('').toUpperCase() || '?';
}

// ── Category Config ─────────────────────────────────────────
const CAT = {
  birthday:    { icon:'🎂', label:'Birthday',    color:'#E11D48', bg:'#FFF1F2' },
  christmas:   { icon:'🎄', label:'Christmas',   color:'#15803D', bg:'#F0FDF4' },
  funeral:     { icon:'🕊️', label:'Funeral',     color:'#57534E', bg:'#F5F5F4' },
  halloween:   { icon:'🎃', label:'Halloween',   color:'#C2410C', bg:'#FFF7ED' },
  graduation:  { icon:'🎓', label:'Graduation',  color:'#1D4ED8', bg:'#EFF6FF' },
  wedding:     { icon:'💒', label:'Wedding',     color:'#A16207', bg:'#FEFCE8' },
  anniversary: { icon:'💖', label:'Anniversary', color:'#BE185D', bg:'#FDF2F8' },
  other:       { icon:'🎉', label:'Other',       color:'#7C3AED', bg:'#F5F3FF' },
};

// per-category scene settings for the canvas simulator
const SCENE = {
  birthday:    { wallTop:'#FECDD3', wallBot:'#FDA4AF', floor:'#F9A8D4', decos:['🎂','🎈','🎁','🪅','🎊'], particles:'confetti', textColor:'#E11D48' },
  christmas:   { wallTop:'#BBF7D0', wallBot:'#86EFAC', floor:'#4ADE80', decos:['🎄','⭐','🎁','🦌','❄️'], particles:'snow',     textColor:'#15803D' },
  funeral:     { wallTop:'#D6D3D1', wallBot:'#A8A29E', floor:'#78716C', decos:['🕊️','🌹','🕯️','💐'],      particles:'none',     textColor:'#44403C' },
  halloween:   { wallTop:'#1C1917', wallBot:'#292524', floor:'#44403C', decos:['🎃','👻','🦇','🕷️','🌙'], particles:'bats',     textColor:'#F97316' },
  graduation:  { wallTop:'#BFDBFE', wallBot:'#93C5FD', floor:'#60A5FA', decos:['🎓','📜','🏆','⭐','🎊'], particles:'confetti', textColor:'#1D4ED8' },
  wedding:     { wallTop:'#FEF9C3', wallBot:'#FEF08A', floor:'#FDE047', decos:['💒','💍','💐','🕊️','🎊'], particles:'petals',   textColor:'#A16207' },
  anniversary: { wallTop:'#FCE7F3', wallBot:'#FBCFE8', floor:'#F9A8D4', decos:['💖','🌹','🥂','💍','✨'], particles:'hearts',   textColor:'#BE185D' },
  other:       { wallTop:'#EDE9FE', wallBot:'#DDD6FE', floor:'#C4B5FD', decos:['🎉','🎈','✨','🌟','🎊'], particles:'confetti', textColor:'#7C3AED' },
};

// ── View Routing ────────────────────────────────────────────
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + name)?.classList.add('active');

  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (name === 'dashboard') document.querySelector('.nav-btn[data-view="dashboard"]')?.classList.add('active');

  if (name === 'dashboard')     renderDashboard();
  if (name === 'event-detail')  renderEventDetail();
}

// ── Dashboard ───────────────────────────────────────────────
function renderDashboard() {
  const grid      = document.getElementById('events-grid');
  const empty     = document.getElementById('empty-state');
  const filter    = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';

  const filtered  = filter === 'all'
    ? state.events
    : state.events.filter(e => e.category === filter);

  if (!filtered.length) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  grid.innerHTML = filtered.map(ev => {
    const c   = CAT[ev.category] || CAT.other;
    const dt  = ev.date ? new Date(ev.date + 'T00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : 'No date';
    const gc  = ev.guests?.length || 0;
    const ac  = ev.activities?.length || 0;
    return `
      <div class="event-card" data-id="${ev.id}" style="--cat-color:${c.color};--cat-bg:${c.bg}">
        <div class="card-header">
          <span class="cat-badge">${c.icon} ${c.label}</span>
          <button class="card-delete" data-id="${ev.id}" title="Delete">✕</button>
        </div>
        <div class="card-body">
          <h3 class="card-title">${escHtml(ev.name)}</h3>
          <p class="card-date">📅 ${dt}</p>
          ${ev.location ? `<p class="card-location">📍 ${escHtml(ev.location)}</p>` : ''}
          ${ev.theme    ? `<p class="card-theme">✨ ${escHtml(ev.theme)}</p>` : ''}
        </div>
        <div class="card-footer">
          <span class="card-stat">👥 ${gc} guest${gc !== 1 ? 's' : ''}</span>
          <span class="card-stat">📋 ${ac} activit${ac !== 1 ? 'ies' : 'y'}</span>
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('.event-card').forEach(card => {
    card.addEventListener('click', e => {
      if (!e.target.closest('.card-delete')) {
        state.currentEventId = card.dataset.id;
        showView('event-detail');
      }
    });
  });

  grid.querySelectorAll('.card-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      deleteEvent(btn.dataset.id);
    });
  });
}

function deleteEvent(id) {
  if (!confirm('Delete this event? This cannot be undone.')) return;
  state.events = state.events.filter(e => e.id !== id);
  saveState();
  renderDashboard();
}

// ── Create / Edit Form ──────────────────────────────────────
function openCreateForm(editId = null) {
  stopSimulator();
  const form = document.getElementById('event-form');
  form.reset();
  document.querySelectorAll('.category-option').forEach(o => o.classList.remove('selected'));

  if (editId) {
    const ev = state.events.find(e => e.id === editId);
    if (!ev) return;
    document.getElementById('create-title').textContent = 'Edit Event';
    document.getElementById('event-name').value        = ev.name        || '';
    document.getElementById('event-date').value        = ev.date        || '';
    document.getElementById('event-time').value        = ev.time        || '';
    document.getElementById('event-location').value   = ev.location    || '';
    document.getElementById('event-theme').value      = ev.theme       || '';
    document.getElementById('event-description').value = ev.description || '';
    const radio = document.querySelector(`input[name="category"][value="${ev.category}"]`);
    if (radio) { radio.checked = true; radio.closest('.category-option').classList.add('selected'); }
    form.dataset.editId = editId;
  } else {
    document.getElementById('create-title').textContent = 'Create New Event';
    const first = document.querySelector('input[name="category"]');
    if (first) { first.checked = true; first.closest('.category-option').classList.add('selected'); }
    delete form.dataset.editId;
  }
  showView('create');
}

function saveEvent(e) {
  e.preventDefault();
  const category = document.querySelector('input[name="category"]:checked')?.value || 'other';
  const name     = document.getElementById('event-name').value.trim();
  if (!name) return;

  const data = {
    name,
    category,
    date:        document.getElementById('event-date').value,
    time:        document.getElementById('event-time').value,
    location:    document.getElementById('event-location').value.trim(),
    theme:       document.getElementById('event-theme').value.trim(),
    description: document.getElementById('event-description').value.trim(),
  };

  const editId = document.getElementById('event-form').dataset.editId;
  if (editId) {
    const idx = state.events.findIndex(ev => ev.id === editId);
    if (idx !== -1) state.events[idx] = { ...state.events[idx], ...data };
  } else {
    state.events.unshift({ id: genId(), ...data, guests: [], activities: [], notes: [], createdAt: new Date().toISOString() });
  }

  saveState();
  if (editId) {
    showView('dashboard');          // editing: go straight back
  } else {
    playCutscene(category, () => showView('dashboard')); // new event: play cutscene first
  }
}

// ── Event Detail ────────────────────────────────────────────
function renderEventDetail() {
  const ev = getCurrentEvent();
  if (!ev) return showView('dashboard');

  const c  = CAT[ev.category] || CAT.other;
  const dt = ev.date ? new Date(ev.date + 'T00:00').toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' }) : '';
  const meta = [dt, ev.time, ev.location].filter(Boolean).join(' · ');

  document.getElementById('event-detail-title').textContent = `${c.icon} ${ev.name}`;
  document.getElementById('event-detail-meta').textContent  = meta;

  const view = document.getElementById('view-event-detail');
  view.style.setProperty('--cat-color', c.color);
  view.style.setProperty('--cat-bg', c.bg);

  switchTab('guests');
}

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
  document.querySelector(`.tab-btn[data-tab="${name}"]`)?.classList.add('active');
  document.getElementById(`tab-${name}`)?.classList.remove('hidden');

  // stop sim if leaving that tab
  if (name !== 'simulator') stopSimulator();

  if (name === 'guests')     renderGuests();
  if (name === 'activities') renderActivities();
  if (name === 'notes')      renderNotes();
  if (name === 'simulator')  setupSimulator();
}

// ── Guests ──────────────────────────────────────────────────
function renderGuests() {
  const ev     = getCurrentEvent(); if (!ev) return;
  const guests = ev.guests || [];
  const yes = guests.filter(g => g.rsvp === 'yes').length;
  const no  = guests.filter(g => g.rsvp === 'no').length;
  const mb  = guests.filter(g => g.rsvp === 'maybe').length;
  const pd  = guests.filter(g => g.rsvp === 'pending').length;

  document.getElementById('guest-stats').innerHTML = `
    <div class="stat-chips">
      <span class="stat-chip total">👥 ${guests.length} Total</span>
      <span class="stat-chip yes">✅ ${yes} Coming</span>
      <span class="stat-chip no">❌ ${no} Not coming</span>
      <span class="stat-chip maybe">🤔 ${mb} Maybe</span>
      <span class="stat-chip pending">⏳ ${pd} Pending</span>
    </div>`;

  const list = document.getElementById('guest-list');
  if (!guests.length) {
    list.innerHTML = '<p class="empty-msg">No guests yet — add your first guest above!</p>';
    return;
  }

  list.innerHTML = guests.map(g => `
    <div class="guest-item">
      <div class="guest-avatar">${getInitials(g.name)}</div>
      <div class="guest-info">
        <span class="guest-name">${escHtml(g.name)}</span>
        ${g.contact ? `<span class="guest-contact">${escHtml(g.contact)}</span>` : ''}
      </div>
      <select class="rsvp-select" data-gid="${g.id}">
        <option value="pending" ${g.rsvp==='pending'?'selected':''}>⏳ Pending</option>
        <option value="yes"     ${g.rsvp==='yes'    ?'selected':''}>✅ Coming</option>
        <option value="no"      ${g.rsvp==='no'     ?'selected':''}>❌ Not Coming</option>
        <option value="maybe"   ${g.rsvp==='maybe'  ?'selected':''}>🤔 Maybe</option>
      </select>
      <button class="btn-icon btn-rm-guest" data-gid="${g.id}" title="Remove">🗑️</button>
    </div>`).join('');

  list.querySelectorAll('.rsvp-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const g = ev.guests.find(g => g.id === sel.dataset.gid);
      if (g) { g.rsvp = sel.value; saveState(); renderGuests(); }
    });
  });
  list.querySelectorAll('.btn-rm-guest').forEach(btn => {
    btn.addEventListener('click', () => {
      ev.guests = ev.guests.filter(g => g.id !== btn.dataset.gid);
      saveState(); renderGuests();
    });
  });
}

function addGuest() {
  const ev   = getCurrentEvent(); if (!ev) return;
  const name = document.getElementById('guest-name').value.trim();
  if (!name) { alert('Please enter a guest name.'); return; }
  ev.guests.push({
    id:      genId(),
    name,
    contact: document.getElementById('guest-contact').value.trim(),
    rsvp:    document.getElementById('guest-rsvp').value,
  });
  saveState();
  document.getElementById('add-guest-form').style.display = 'none';
  document.getElementById('guest-name').value    = '';
  document.getElementById('guest-contact').value = '';
  document.getElementById('guest-rsvp').value    = 'pending';
  renderGuests();
}

// ── Activities ──────────────────────────────────────────────
function renderActivities() {
  const ev  = getCurrentEvent(); if (!ev) return;
  const acts = [...(ev.activities || [])].sort((a, b) => (a.time||'').localeCompare(b.time||''));
  const list = document.getElementById('activity-list');

  if (!acts.length) {
    list.innerHTML = '<p class="empty-msg">No activities yet — build your schedule!</p>';
    return;
  }

  list.innerHTML = acts.map(a => `
    <div class="activity-item">
      <div class="activity-time">${a.time || '--:--'}</div>
      <div class="activity-content">
        <span class="activity-name">${escHtml(a.name)}</span>
        ${a.duration ? `<span class="activity-duration">⏱ ${a.duration} min</span>` : ''}
        ${a.description ? `<p class="activity-desc">${escHtml(a.description)}</p>` : ''}
      </div>
      <button class="btn-icon btn-rm-activity" data-aid="${a.id}" title="Remove">🗑️</button>
    </div>`).join('');

  list.querySelectorAll('.btn-rm-activity').forEach(btn => {
    btn.addEventListener('click', () => {
      ev.activities = ev.activities.filter(a => a.id !== btn.dataset.aid);
      saveState(); renderActivities();
    });
  });
}

function addActivity() {
  const ev   = getCurrentEvent(); if (!ev) return;
  const name = document.getElementById('activity-name').value.trim();
  if (!name) { alert('Please enter an activity name.'); return; }
  ev.activities.push({
    id:          genId(),
    name,
    time:        document.getElementById('activity-time').value,
    duration:    parseInt(document.getElementById('activity-duration').value) || null,
    description: document.getElementById('activity-description').value.trim(),
  });
  saveState();
  document.getElementById('add-activity-form').style.display = 'none';
  document.getElementById('activity-name').value        = '';
  document.getElementById('activity-time').value        = '';
  document.getElementById('activity-duration').value    = '';
  document.getElementById('activity-description').value = '';
  renderActivities();
}

// ── Notes ───────────────────────────────────────────────────
function renderNotes() {
  const ev      = getCurrentEvent(); if (!ev) return;
  const showHid = document.getElementById('show-hidden-notes').checked;
  let   notes   = (ev.notes || []).filter(n => showHid || !n.hidden);
  notes = [...notes.filter(n => n.pinned), ...notes.filter(n => !n.pinned)];

  const grid = document.getElementById('notes-grid');
  if (!notes.length) {
    grid.innerHTML = '<p class="empty-msg">No notes yet — jot something down!</p>';
    return;
  }

  grid.innerHTML = notes.map(n => `
    <div class="note-card${n.pinned?' pinned':''}${n.hidden?' hidden-note':''}">
      <div class="note-header">
        <h4 class="note-title">${escHtml(n.title)}</h4>
        <div class="note-actions">
          ${n.pinned ? '<span title="Pinned">📌</span>' : ''}
          ${n.hidden ? '<span title="Hidden">🔒</span>' : ''}
          <button class="btn-icon btn-rm-note" data-nid="${n.id}" title="Delete">✕</button>
        </div>
      </div>
      <p class="note-content">${escHtml(n.content)}</p>
    </div>`).join('');

  grid.querySelectorAll('.btn-rm-note').forEach(btn => {
    btn.addEventListener('click', () => {
      ev.notes = ev.notes.filter(n => n.id !== btn.dataset.nid);
      saveState(); renderNotes();
    });
  });
}

function addNote() {
  const ev    = getCurrentEvent(); if (!ev) return;
  const title = document.getElementById('note-title').value.trim();
  if (!title) { alert('Please enter a note title.'); return; }
  ev.notes.push({
    id:      genId(),
    title,
    content: document.getElementById('note-content').value.trim(),
    pinned:  document.getElementById('note-pinned').checked,
    hidden:  document.getElementById('note-hidden').checked,
  });
  saveState();
  document.getElementById('add-note-form').style.display = 'none';
  document.getElementById('note-title').value   = '';
  document.getElementById('note-content').value = '';
  document.getElementById('note-pinned').checked = false;
  document.getElementById('note-hidden').checked = false;
  renderNotes();
}

// ── Cutscene ─────────────────────────────────────────────────
const CS_CONFIG = {
  birthday:    { bg:'#E11D48', bg2:'#FB7185', icon:'🎂', title:'Birthday Party Created!',    sub:'Time to celebrate! 🥳',              effect:'confetti' },
  christmas:   { bg:'#14532D', bg2:'#4ADE80', icon:'🎄', title:'Christmas Party Created!',   sub:'Ho ho ho! 🎅',                       effect:'snow'     },
  funeral:     { bg:'#1C1917', bg2:'#78716C', icon:'🕊️', title:'Memorial Created',            sub:'A moment to honour and remember.',   effect:'feathers' },
  halloween:   { bg:'#1C1917', bg2:'#C2410C', icon:'🎃', title:'Spooky Party Ready!',         sub:'BOO! 👻',                            effect:'bats'     },
  graduation:  { bg:'#1E3A8A', bg2:'#60A5FA', icon:'🎓', title:'Graduation Created!',         sub:'Congratulations, graduate! 🏆',      effect:'caps'     },
  wedding:     { bg:'#78350F', bg2:'#FDE68A', icon:'💒', title:'Wedding Created!',            sub:'Here comes the celebration! 💕',     effect:'petals'   },
  anniversary: { bg:'#831843', bg2:'#F9A8D4', icon:'💖', title:'Anniversary Created!',        sub:'Celebrating your love! 💕',          effect:'hearts'   },
  other:       { bg:'#3B0764', bg2:'#A78BFA', icon:'🎉', title:'Party Created!',             sub:"Let's get this started! 🕺",          effect:'confetti' },
};

// Per-particle for the cutscene canvas
class CsParticle {
  constructor(W, H, effect) {
    this.W = W; this.H = H; this.effect = effect;
    this.active = true;
    this.init(true);
  }

  init(scatter = false) {
    const { W, H, effect } = this;
    this.op  = 1;
    this.rot = Math.random() * Math.PI * 2;

    if (effect === 'confetti' || effect === 'caps') {
      this.x   = scatter ? Math.random() * W : Math.random() * W;
      this.y   = scatter ? Math.random() * H : H + 10;
      this.vx  = (Math.random() - 0.5) * 7;
      this.vy  = -(Math.random() * 10 + 5);
      this.grav = 0.22;
      this.rs  = (Math.random() - 0.5) * 0.2;
      this.sz  = effect === 'caps' ? 26 : (Math.random() * 9 + 5);
      this.hue = Math.random() * 360;
    } else if (effect === 'snow') {
      this.x   = scatter ? Math.random() * W : Math.random() * W;
      this.y   = scatter ? Math.random() * H : -12;
      this.vx  = (Math.random() - 0.5) * 0.9;
      this.vy  = Math.random() * 1.6 + 0.6;
      this.sz  = Math.random() * 6 + 3;
      this.grav = 0; this.rs = 0.02;
    } else if (effect === 'feathers') {
      this.x   = scatter ? Math.random() * W : Math.random() * W;
      this.y   = scatter ? Math.random() * H : -12;
      this.vx  = (Math.random() - 0.5) * 0.7;
      this.vy  = Math.random() * 0.9 + 0.3;
      this.sz  = Math.random() * 12 + 8;
      this.grav = 0; this.rs = (Math.random() - 0.5) * 0.025;
    } else if (effect === 'bats') {
      const fromLeft = Math.random() < 0.5;
      this.x   = scatter ? Math.random() * W : (fromLeft ? -40 : W + 40);
      this.y   = Math.random() * H * 0.75;
      this.vx  = fromLeft ? Math.random() * 4 + 2 : -(Math.random() * 4 + 2);
      this.vy  = (Math.random() - 0.5) * 2;
      this.sz  = Math.random() * 14 + 20;
      this.grav = 0; this.rs = 0;
    } else if (effect === 'petals') {
      this.x   = scatter ? Math.random() * W : Math.random() * W;
      this.y   = scatter ? Math.random() * H : -12;
      this.vx  = Math.sin(Math.random() * Math.PI * 2) * 1.3;
      this.vy  = Math.random() * 1.6 + 0.7;
      this.sz  = Math.random() * 8 + 16;
      this.grav = 0; this.rs = (Math.random() - 0.5) * 0.045;
    } else if (effect === 'hearts') {
      this.x   = scatter ? Math.random() * W : Math.random() * W;
      this.y   = scatter ? Math.random() * H : H + 12;
      this.vx  = (Math.random() - 0.5) * 2.2;
      this.vy  = -(Math.random() * 3 + 1.5);
      this.sz  = Math.random() * 14 + 18;
      this.grav = 0; this.rs = 0;
    }
  }

  update() {
    this.x  += this.vx;
    this.y  += this.vy;
    this.rot += (this.rs || 0);
    if (this.grav) this.vy += this.grav;

    // fade out as they leave
    const { effect, H, W } = this;
    if ((effect === 'confetti' || effect === 'caps') && this.y > H * 0.88) {
      this.op = Math.max(0, this.op - 0.045);
    }
    const offscreen =
      ((effect === 'confetti' || effect === 'caps' || effect === 'hearts') && this.y > H + 30) ||
      ((effect === 'snow' || effect === 'feathers' || effect === 'petals') && this.y > H + 30) ||
      (effect === 'bats' && (this.x < -60 || this.x > W + 60));
    if (offscreen) this.init(false);
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.op;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);

    const { effect, sz } = this;

    if (effect === 'confetti') {
      ctx.fillStyle = `hsl(${this.hue},85%,63%)`;
      ctx.fillRect(-sz / 2, -sz / 4, sz, sz / 2);
    } else if (effect === 'snow') {
      // circle core
      ctx.beginPath(); ctx.arc(0, 0, sz / 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fill();
      // six arms
      ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        ctx.save(); ctx.rotate(i * Math.PI / 3);
        ctx.beginPath(); ctx.moveTo(0, sz * 0.5); ctx.lineTo(0, sz * 1.4);
        ctx.stroke(); ctx.restore();
      }
    } else if (effect === 'feathers') {
      ctx.beginPath();
      ctx.ellipse(0, 0, sz / 4, sz / 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(229,231,235,0.82)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.5; ctx.stroke();
    } else {
      // emoji
      const glyphs = { bats:'🦇', caps:'🎓', petals:'🌸', hearts:'❤️' };
      ctx.font      = `${sz}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(glyphs[effect] || '✨', 0, 0);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

let csFrame = null, csParticles = [];

function playCutscene(category, onDone) {
  const cfg     = CS_CONFIG[category] || CS_CONFIG.other;
  const overlay = document.getElementById('cutscene');
  const canvas  = document.getElementById('cutscene-canvas');
  const ctx     = canvas.getContext('2d');

  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  // Populate text
  overlay.querySelector('.cutscene-icon').textContent  = cfg.icon;
  overlay.querySelector('.cutscene-title').textContent = cfg.title;
  overlay.querySelector('.cutscene-sub').textContent   = cfg.sub;
  overlay.style.background = `linear-gradient(135deg, ${cfg.bg} 0%, ${cfg.bg2} 100%)`;

  // Spawn particles — more for celebratory, fewer for respectful events
  const count = cfg.effect === 'feathers' ? 22 : 55;
  csParticles = Array.from({ length: count }, () => new CsParticle(canvas.width, canvas.height, cfg.effect));

  // Show overlay
  overlay.style.display  = 'flex';
  overlay.style.opacity  = '0';
  requestAnimationFrame(() => overlay.classList.add('visible'));

  const DURATION = 2900;
  let startTime  = null;
  let skipped    = false;

  function skip() {
    skipped = true;
    finish();
  }

  function finish() {
    if (csFrame) { cancelAnimationFrame(csFrame); csFrame = null; }
    overlay.style.transition = 'opacity 0.3s ease';
    overlay.style.opacity    = '0';
    setTimeout(() => {
      overlay.style.display = 'none';
      overlay.classList.remove('visible');
      overlay.style.opacity = '';
      if (onDone) onDone();
    }, 310);
  }

  // Wire skip button (one-shot)
  const skipBtn = document.getElementById('cutscene-skip');
  const onSkip  = () => { skipBtn.removeEventListener('click', onSkip); skip(); };
  skipBtn.addEventListener('click', onSkip);

  function tick(ts) {
    if (skipped) return;
    if (!startTime) startTime = ts;
    const elapsed = ts - startTime;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    csParticles.forEach(p => { p.update(); p.draw(ctx); });

    if (elapsed >= DURATION) {
      skipBtn.removeEventListener('click', onSkip);
      finish();
    } else {
      csFrame = requestAnimationFrame(tick);
    }
  }
  csFrame = requestAnimationFrame(tick);
}

// ── Simulator ────────────────────────────────────────────────
// Guest "actor" that wanders the canvas
class Actor {
  constructor(name, canvas) {
    this.name = name;
    this.r    = 22;
    this.x    = this.r + Math.random() * (canvas.width  - this.r * 2);
    this.y    = canvas.height * 0.48 + Math.random() * (canvas.height * 0.28);
    this.vx   = (Math.random() - 0.5) * 1.4;
    this.vy   = (Math.random() - 0.5) * 0.7;
    this.hue  = Math.random() * 360;
    this.bob  = Math.random() * Math.PI * 2;
  }
  update(canvas, t) {
    this.x += this.vx;
    this.y += this.vy + Math.sin(t * 0.025 + this.bob) * 0.3;
    const minY = canvas.height * 0.46, maxY = canvas.height * 0.76;
    if (this.x < this.r || this.x > canvas.width - this.r) this.vx *= -1;
    if (this.y < minY   || this.y > maxY)                  this.vy *= -1;
    this.x = Math.max(this.r, Math.min(canvas.width - this.r, this.x));
    this.y = Math.max(minY, Math.min(maxY, this.y));
    if (Math.random() < 0.006) { this.vx = (Math.random() - 0.5) * 1.4; this.vy = (Math.random() - 0.5) * 0.7; }
  }
  draw(ctx) {
    // shadow
    ctx.beginPath(); ctx.ellipse(this.x, this.y + this.r + 4, this.r * 0.75, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.13)'; ctx.fill();
    // body
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${this.hue},68%,58%)`; ctx.fill();
    ctx.strokeStyle = 'white'; ctx.lineWidth = 2.5; ctx.stroke();
    // initials
    ctx.fillStyle = 'white'; ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(getInitials(this.name), this.x, this.y);
  }
}

// Floating particle (confetti / snow / hearts / petals / bats)
class Particle {
  constructor(canvas, type) {
    this.type = type;
    this.canvas = canvas;
    this.reset(true);
  }
  reset(randomY = false) {
    this.x  = Math.random() * this.canvas.width;
    this.y  = randomY ? Math.random() * this.canvas.height : -20;
    this.vx = (Math.random() - 0.5) * 1.8;
    this.vy = this.type === 'bats' ? (Math.random() - 0.5) * 1.2 : Math.random() * 1.8 + 0.8;
    this.rot = Math.random() * Math.PI * 2;
    this.rs  = (Math.random() - 0.5) * 0.12;
    this.sz  = Math.random() * 7 + 4;
    this.hue = Math.random() * 360;
    this.op  = 0.7 + Math.random() * 0.3;
  }
  update() {
    this.x   += this.vx;
    this.y   += this.vy;
    this.rot += this.rs;
    if (this.y > this.canvas.height + 20) this.reset();
    if (this.x < -20 || this.x > this.canvas.width + 20) this.reset();
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.globalAlpha = this.op;
    if (this.type === 'confetti') {
      ctx.fillStyle = `hsl(${this.hue},80%,60%)`;
      ctx.fillRect(-this.sz / 2, -this.sz / 4, this.sz, this.sz / 2);
    } else if (this.type === 'snow') {
      ctx.beginPath(); ctx.arc(0, 0, this.sz / 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
    } else {
      ctx.font = `${this.sz * 2}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const glyphs = { hearts: '❤️', petals: '🌸', bats: '🦇' };
      ctx.fillText(glyphs[this.type] || '✨', 0, 0);
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }
}

let actors = [], particles = [], simCanvas, simCtx;

function setupSimulator() {
  const ev  = getCurrentEvent(); if (!ev) return;
  const c   = CAT[ev.category] || CAT.other;
  const sc  = SCENE[ev.category] || SCENE.other;
  const dt  = ev.date ? new Date(ev.date + 'T00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' }) : 'TBD';
  const acts = [...(ev.activities||[])].sort((a,b)=>(a.time||'').localeCompare(b.time||''));
  const guests = ev.guests || [];
  const coming = guests.filter(g => g.rsvp === 'yes').length;

  // ── Info panels
  document.getElementById('sim-summary').innerHTML = `
    <p><strong>${c.icon} ${escHtml(ev.name)}</strong></p>
    <p>📅 ${dt}${ev.time ? ' at ' + ev.time : ''}</p>
    ${ev.location ? `<p>📍 ${escHtml(ev.location)}</p>` : ''}
    ${ev.theme    ? `<p>✨ Theme: ${escHtml(ev.theme)}</p>` : ''}`;

  const bubbles = guests.slice(0,14).map(g =>
    `<div class="sim-guest-bubble" title="${escHtml(g.name)}">${getInitials(g.name)}</div>`).join('');
  const extra = guests.length > 14
    ? `<div class="sim-guest-bubble more">+${guests.length - 14}</div>` : '';
  document.getElementById('sim-guests').innerHTML = `
    <div class="sim-guest-bubbles">${bubbles}${extra}</div>
    <p class="sim-stat">${guests.length} invited · ${coming} confirmed</p>`;

  document.getElementById('sim-timeline').innerHTML = !acts.length
    ? '<p class="empty-msg" style="padding:12px">No activities planned yet.</p>'
    : `<div class="timeline">${acts.map(a => `
        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <span class="timeline-time">${a.time || '?'}</span>
          <span class="timeline-name">${escHtml(a.name)}</span>
          ${a.duration ? `<span class="timeline-dur">${a.duration}m</span>` : ''}
        </div>`).join('')}</div>`;

  // ── Canvas
  const wrap = document.querySelector('.simulator-scene-wrap');
  simCanvas  = document.getElementById('sim-canvas');
  simCanvas.width  = wrap.clientWidth  || 640;
  simCanvas.height = 360;
  simCtx = simCanvas.getContext('2d');

  // create actors
  const guestList = guests.length ? guests.slice(0,15) : [{name:'Guest 1'},{name:'Guest 2'},{name:'Guest 3'}];
  actors = guestList.map(g => new Actor(g.name, simCanvas));

  // create particles
  particles = [];
  if (sc.particles !== 'none') {
    for (let i = 0; i < 28; i++) particles.push(new Particle(simCanvas, sc.particles));
  }

  state.simTime = 0;
  drawFrame(sc, ev, c);
}

function drawFrame(sc, ev, c) {
  if (!simCanvas || !simCtx) return;
  const W = simCanvas.width, H = simCanvas.height, ctx = simCtx, t = state.simTime;

  // ── Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H * 0.78);
  grad.addColorStop(0,   sc.wallTop);
  grad.addColorStop(0.6, sc.wallBot);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H * 0.78);

  // ── Floor
  ctx.fillStyle = sc.floor; ctx.fillRect(0, H * 0.77, W, H * 0.23);

  // ── Floor edge shadow
  const floorGrad = ctx.createLinearGradient(0, H * 0.77, 0, H * 0.77 + 18);
  floorGrad.addColorStop(0, 'rgba(0,0,0,0.18)');
  floorGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = floorGrad; ctx.fillRect(0, H * 0.77, W, 18);

  // ── Hanging decorations
  const decos = sc.decos;
  const xPos  = [0.1, 0.25, 0.5, 0.75, 0.9].map(p => W * p);
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
  xPos.forEach((x, i) => {
    const baseY = H * 0.19;
    const swing = Math.sin(t * 0.022 + i * 1.1) * 5;
    // string
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + swing * 0.4, baseY - 18); ctx.stroke();
    // emoji
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(decos[i % decos.length], x + swing * 0.4, baseY + Math.sin(t * 0.03 + i) * 3);
  });

  // ── Event name banner
  ctx.font = 'bold 17px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillText(`${c.icon} ${ev.name} ${c.icon}`, W / 2 + 1, H * 0.37 + 1);
  ctx.fillStyle = sc.textColor || 'white';
  ctx.shadowColor = 'rgba(255,255,255,0.6)'; ctx.shadowBlur = 6;
  ctx.fillText(`${c.icon} ${ev.name} ${c.icon}`, W / 2, H * 0.37);
  ctx.shadowBlur = 0;

  // ── Particles
  particles.forEach(p => { p.update(); p.draw(ctx); });

  // ── Actors
  actors.forEach(a => { a.update(simCanvas, t); a.draw(ctx); });

  state.simTime++;
  if (state.simRunning) {
    state.simFrame = requestAnimationFrame(() => {
      const ev2 = getCurrentEvent();
      const c2  = CAT[ev2?.category] || CAT.other;
      const sc2 = SCENE[ev2?.category] || SCENE.other;
      if (ev2) drawFrame(sc2, ev2, c2);
    });
  }
}

function toggleSimulator() {
  const ev = getCurrentEvent(); if (!ev) return;
  const c  = CAT[ev.category] || CAT.other;
  const sc = SCENE[ev.category] || SCENE.other;
  const btn = document.getElementById('btn-run-simulator');

  if (state.simRunning) {
    stopSimulator();
  } else {
    state.simRunning = true;
    btn.textContent = '⏸ Pause';
    drawFrame(sc, ev, c);
  }
}

function stopSimulator() {
  state.simRunning = false;
  if (state.simFrame) { cancelAnimationFrame(state.simFrame); state.simFrame = null; }
  const btn = document.getElementById('btn-run-simulator');
  if (btn) btn.textContent = '▶ Run Simulation';
}

// ── Toggle helpers ──────────────────────────────────────────
function toggleForm(id) {
  const el = document.getElementById(id);
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// ── Init ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Sidebar nav
  document.querySelector('.nav-btn[data-view="dashboard"]').addEventListener('click', () => {
    stopSimulator(); showView('dashboard');
  });
  document.getElementById('nav-create').addEventListener('click', () => openCreateForm());

  // Dashboard buttons
  document.getElementById('btn-create-event').addEventListener('click', () => openCreateForm());
  document.getElementById('empty-create-btn').addEventListener('click', () => openCreateForm());

  // Category filter
  document.getElementById('category-filter').addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderDashboard();
  });

  // Create form — category picker
  document.querySelectorAll('.category-option').forEach(label => {
    label.addEventListener('click', () => {
      document.querySelectorAll('.category-option').forEach(o => o.classList.remove('selected'));
      label.classList.add('selected');
    });
  });

  // Create form — save / cancel
  document.getElementById('event-form').addEventListener('submit', saveEvent);
  document.getElementById('cancel-create').addEventListener('click', () => { stopSimulator(); showView('dashboard'); });
  document.getElementById('back-from-create').addEventListener('click', () => { stopSimulator(); showView('dashboard'); });

  // Event detail — back / edit / delete
  document.getElementById('back-to-dashboard').addEventListener('click', () => { stopSimulator(); showView('dashboard'); });
  document.getElementById('btn-edit-event').addEventListener('click', () => openCreateForm(state.currentEventId));
  document.getElementById('btn-delete-event').addEventListener('click', () => {
    const id = state.currentEventId;
    deleteEvent(id);
    showView('dashboard');
  });

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Guests
  document.getElementById('btn-add-guest').addEventListener('click', () => toggleForm('add-guest-form'));
  document.getElementById('cancel-add-guest').addEventListener('click', () => { document.getElementById('add-guest-form').style.display = 'none'; });
  document.getElementById('save-guest').addEventListener('click', addGuest);

  // Activities
  document.getElementById('btn-add-activity').addEventListener('click', () => toggleForm('add-activity-form'));
  document.getElementById('cancel-add-activity').addEventListener('click', () => { document.getElementById('add-activity-form').style.display = 'none'; });
  document.getElementById('save-activity').addEventListener('click', addActivity);

  // Notes
  document.getElementById('btn-add-note').addEventListener('click', () => toggleForm('add-note-form'));
  document.getElementById('cancel-add-note').addEventListener('click', () => { document.getElementById('add-note-form').style.display = 'none'; });
  document.getElementById('save-note').addEventListener('click', addNote);
  document.getElementById('show-hidden-notes').addEventListener('change', renderNotes);

  // Simulator
  document.getElementById('btn-run-simulator').addEventListener('click', toggleSimulator);

  // Boot
  renderDashboard();
});
