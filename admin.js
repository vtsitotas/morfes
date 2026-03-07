// Morfes Admin Panel
var SUPABASE_URL  = 'https://kcekfqlyivpretwdzjau.supabase.co';
var SUPABASE_ANON = 'sb_publishable_h0k95OHsVFr7NhrsTr8Nzg_4CWTH5lV';

var db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

var GR_DAYS   = ['Κυρ','Δευ','Τρι','Τετ','Πεμ','Παρ','Σαβ'];
var GR_MONTHS = ['Ιαν','Φεβ','Μαρ','Απρ','Μαϊ','Ιουν','Ιουλ','Αυγ','Σεπ','Οκτ','Νοε','Δεκ'];
var WD_NAMES  = ['Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο','Κυριακή'];

function pad(n) { return String(n).padStart(2, '0'); }

function formatDate(iso) {
  var d = new Date(iso + 'T00:00:00');
  return GR_DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + GR_MONTHS[d.getMonth()];
}

function el(tag, cls, txt) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined) e.textContent = txt;
  return e;
}

function clearEl(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function makeTd(text, extraClass) {
  var td = el('td');
  td.textContent = text || '';
  if (extraClass) td.className = extraClass;
  return td;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
var loginWrap = document.getElementById('adm-login');
var dashboard = document.getElementById('adm-dashboard');
var userLabel = document.getElementById('adm-user-label');

db.auth.onAuthStateChange(function(event, session) {
  if (session) {
    loginWrap.style.display = 'none';
    dashboard.style.display = '';
    userLabel.textContent = session.user.email;
    loadDashboard();
  } else {
    loginWrap.style.display = '';
    dashboard.style.display = 'none';
  }
});

document.getElementById('adm-login-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  var email = document.getElementById('adm-email').value.trim();
  var pass  = document.getElementById('adm-pass').value;
  var btn   = document.getElementById('adm-login-btn');
  var err   = document.getElementById('adm-login-err');
  btn.disabled = true; btn.textContent = 'Σύνδεση...'; err.textContent = '';
  var result = await db.auth.signInWithPassword({ email: email, password: pass });
  if (result.error) {
    err.textContent = 'Λάθος email ή κωδικός.';
    btn.disabled = false; btn.textContent = 'Σύνδεση';
  }
});

document.getElementById('adm-logout-btn').addEventListener('click', function() {
  db.auth.signOut();
});

// ── Sidebar nav ───────────────────────────────────────────────────────────────
function loadDashboard() {
  setupSidebar();
  setupBookingTabs();
  loadBookings();
}

function setupSidebar() {
  document.querySelectorAll('.adm-nav-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.adm-nav-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var sec = btn.dataset.section;
      document.querySelectorAll('.adm-section').forEach(function(s) { s.style.display = 'none'; });
      document.getElementById('sec-' + sec).style.display = '';
      if (sec === 'bookings')   loadBookings();
      if (sec === 'services')   loadServices();
      if (sec === 'hours')      loadHours();
      if (sec === 'exceptions') loadExceptions();
      if (sec === 'blocked')    loadBlockedDates();
    });
  });
}

// ── Bookings ──────────────────────────────────────────────────────────────────
var currentTab = 'upcoming';

function setupBookingTabs() {
  document.querySelectorAll('.adm-tab').forEach(function(t) {
    t.addEventListener('click', function() {
      currentTab = t.dataset.tab;
      document.querySelectorAll('.adm-tab').forEach(function(x) {
        x.classList.toggle('active', x.dataset.tab === currentTab);
      });
      loadBookings();
    });
  });
}

async function loadBookings() {
  var tbody = document.getElementById('adm-bookings-body');
  clearEl(tbody);
  var loadTr = el('tr'); var loadTd = el('td', 'adm-empty', 'Φόρτωση...');
  loadTd.colSpan = 6; loadTr.appendChild(loadTd); tbody.appendChild(loadTr);

  var today    = new Date();
  var todayIso = today.getFullYear() + '-' + pad(today.getMonth()+1) + '-' + pad(today.getDate());

  var query = db.from('bookings').select('*, services(name)')
    .order('date', { ascending: true }).order('start_time', { ascending: true });

  if (currentTab === 'upcoming')   query = query.gte('date', todayIso).neq('status', 'cancelled');
  else if (currentTab === 'past')  query = query.lt('date', todayIso);
  else                             query = query.eq('status', 'cancelled');

  var result = await query;
  clearEl(tbody);

  if (!result.data || result.data.length === 0) {
    var emptyTr = el('tr'); var emptyTd = el('td', 'adm-empty', 'Δεν υπάρχουν κρατήσεις.');
    emptyTd.colSpan = 6; emptyTr.appendChild(emptyTd); tbody.appendChild(emptyTr);
    return;
  }

  result.data.forEach(function(b) {
    var start = b.start_time ? b.start_time.slice(0,5) : '';
    var end   = b.end_time   ? b.end_time.slice(0,5)   : '';
    var tr    = el('tr');

    tr.appendChild(makeTd(formatDate(b.date)));
    tr.appendChild(makeTd(start + ' – ' + end));

    var custTd = el('td');
    var nameEl = el('strong', '', b.customer_name || '');
    var phoneEl = el('span', '', b.customer_phone || '');
    phoneEl.style.cssText = 'display:block;color:rgba(255,255,255,0.35);font-size:0.8rem';
    custTd.appendChild(nameEl); custTd.appendChild(phoneEl);
    tr.appendChild(custTd);

    tr.appendChild(makeTd(b.services ? b.services.name : '–'));

    var statusTd = el('td');
    var badge = el('span', 'adm-badge ' + (b.status === 'cancelled' ? 'adm-badge-cancelled' : 'adm-badge-confirmed'));
    badge.textContent = b.status === 'cancelled' ? 'Ακυρώθηκε' : 'Επιβεβαιωμένη';
    statusTd.appendChild(badge); tr.appendChild(statusTd);

    var actionTd = el('td');
    if (b.status !== 'cancelled') {
      var cancelBtn = el('button', 'adm-btn-danger', 'Ακύρωση');
      cancelBtn.addEventListener('click', async function() {
        if (!confirm('Ακύρωση αυτής της κράτησης;')) return;
        cancelBtn.disabled = true;
        await db.from('bookings').update({ status: 'cancelled' }).eq('id', b.id);
        loadBookings();
      });
      actionTd.appendChild(cancelBtn);
    }
    tr.appendChild(actionTd);
    tbody.appendChild(tr);
  });
}

// ── Services ──────────────────────────────────────────────────────────────────
async function loadServices() {
  var list = document.getElementById('adm-services-list');
  clearEl(list);
  list.appendChild(el('span', 'adm-loading', 'Φόρτωση...'));

  var result = await db.from('services').select('*').order('id');
  clearEl(list);

  if (!result.data || result.data.length === 0) {
    list.appendChild(el('p', 'adm-empty-msg', 'Δεν υπάρχουν υπηρεσίες ακόμα.'));
    return;
  }

  var table = el('table', 'adm-table');
  var thead = el('thead');
  var headTr = el('tr');
  ['Emoji','Υπηρεσία','Διάρκεια','Ενεργή',''].forEach(function(h) {
    var th = el('th', '', h); headTr.appendChild(th);
  });
  thead.appendChild(headTr); table.appendChild(thead);

  var tbody = el('tbody');
  result.data.forEach(function(s) {
    var tr = el('tr');
    tr.appendChild(makeTd(s.emoji || '✂️'));
    tr.appendChild(makeTd(s.name));
    tr.appendChild(makeTd(s.duration_min + ' λεπτά'));

    var activeTd = el('td');
    var toggle = el('input');
    toggle.type = 'checkbox'; toggle.checked = s.active;
    toggle.addEventListener('change', async function() {
      await db.from('services').update({ active: toggle.checked }).eq('id', s.id);
    });
    activeTd.appendChild(toggle); tr.appendChild(activeTd);

    var actionTd = el('td');
    var delBtn = el('button', 'adm-btn-danger', 'Διαγραφή');
    delBtn.addEventListener('click', async function() {
      if (!confirm('Διαγραφή υπηρεσίας "' + s.name + '";')) return;
      delBtn.disabled = true;
      await db.from('services').delete().eq('id', s.id);
      loadServices();
    });
    actionTd.appendChild(delBtn); tr.appendChild(actionTd);

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  list.appendChild(table);
}

document.getElementById('adm-add-svc-btn').addEventListener('click', async function() {
  var emoji = document.getElementById('svc-emoji').value.trim() || '✂️';
  var name  = document.getElementById('svc-name').value.trim();
  var dur   = parseInt(document.getElementById('svc-duration').value, 10);
  var errEl = document.getElementById('adm-svc-error');

  if (!name || !dur || dur < 1) {
    errEl.textContent = 'Παρακαλώ συμπληρώστε όνομα και διάρκεια.';
    errEl.style.display = ''; return;
  }
  errEl.style.display = 'none';
  var btn = document.getElementById('adm-add-svc-btn');
  btn.disabled = true;
  await db.from('services').insert([{ emoji: emoji, name: name, duration_min: dur, active: true }]);
  document.getElementById('svc-emoji').value    = '';
  document.getElementById('svc-name').value     = '';
  document.getElementById('svc-duration').value = '';
  btn.disabled = false;
  loadServices();
});

// ── Working Hours ─────────────────────────────────────────────────────────────
async function loadHours() {
  var list = document.getElementById('adm-hours-list');
  clearEl(list);
  list.appendChild(el('span', 'adm-loading', 'Φόρτωση...'));

  var whRes   = await db.from('working_hours').select('*').order('weekday');
  var stRes   = await db.from('booking_settings').select('slot_step').limit(1).single();
  clearEl(list);

  // Slot step selector
  if (stRes.data && stRes.data.slot_step) {
    var sel = document.getElementById('adm-slot-step');
    sel.value = String(stRes.data.slot_step);
  }

  var rows = {};
  if (whRes.data) whRes.data.forEach(function(r) { rows[r.weekday] = r; });

  var table = el('table', 'adm-table');
  var thead = el('thead');
  var headTr = el('tr');
  ['Ημέρα','Ανοιχτό','Ώρα Ανοίγματος','Ώρα Κλεισίματος',''].forEach(function(h) {
    headTr.appendChild(el('th', '', h));
  });
  thead.appendChild(headTr); table.appendChild(thead);

  var tbody = el('tbody');
  for (var wd = 0; wd <= 6; wd++) {
    var row = rows[wd] || { weekday: wd, is_open: true, open_time: '09:00', close_time: '19:00' };
    var tr = el('tr');

    tr.appendChild(makeTd(WD_NAMES[wd]));

    // is_open toggle
    var openTd = el('td');
    var openChk = el('input');
    openChk.type = 'checkbox'; openChk.checked = row.is_open;
    openTd.appendChild(openChk); tr.appendChild(openTd);

    // open_time
    var openTimeTd = el('td');
    var openTimeInp = el('input');
    openTimeInp.type = 'time'; openTimeInp.value = (row.open_time || '09:00').slice(0,5);
    openTimeInp.className = 'adm-time-input';
    openTimeTd.appendChild(openTimeInp); tr.appendChild(openTimeTd);

    // close_time
    var closeTimeTd = el('td');
    var closeTimeInp = el('input');
    closeTimeInp.type = 'time'; closeTimeInp.value = (row.close_time || '19:00').slice(0,5);
    closeTimeInp.className = 'adm-time-input';
    closeTimeTd.appendChild(closeTimeInp); tr.appendChild(closeTimeTd);

    // Save button (captures wd in closure)
    (function(weekday, existingRow) {
      var saveTd = el('td');
      var saveBtn = el('button', 'adm-btn-sm', 'Αποθήκευση');
      saveBtn.addEventListener('click', async function() {
        saveBtn.disabled = true; saveBtn.textContent = '...';
        var payload = {
          weekday:    weekday,
          is_open:    openChk.checked,
          open_time:  openTimeInp.value + ':00',
          close_time: closeTimeInp.value + ':00',
        };
        if (existingRow && existingRow.id) {
          await db.from('working_hours').update(payload).eq('id', existingRow.id);
        } else {
          await db.from('working_hours').upsert([payload], { onConflict: 'weekday' });
        }
        saveBtn.disabled = false; saveBtn.textContent = 'Αποθήκευση';
      });
      saveTd.appendChild(saveBtn); tr.appendChild(saveTd);
    })(wd, rows[wd]);

    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  list.appendChild(table);
}

document.getElementById('adm-save-step-btn').addEventListener('click', async function() {
  var val = parseInt(document.getElementById('adm-slot-step').value, 10);
  var btn = document.getElementById('adm-save-step-btn');
  btn.disabled = true; btn.textContent = '...';
  await db.from('booking_settings').upsert([{ id: 1, slot_step: val }], { onConflict: 'id' });
  btn.disabled = false; btn.textContent = 'Αποθήκευση';
});

// ── Exception Dates ───────────────────────────────────────────────────────────
async function loadExceptions() {
  var list = document.getElementById('adm-exceptions-list');
  clearEl(list);
  list.appendChild(el('span', 'adm-loading', 'Φόρτωση...'));

  var result = await db.from('exception_dates').select('*').order('date');
  clearEl(list);

  if (!result.data || result.data.length === 0) {
    list.appendChild(el('p', 'adm-empty-msg', 'Δεν υπάρχουν εξαιρέσεις ακόμα.'));
    return;
  }

  var table = el('table', 'adm-table');
  var thead = el('thead');
  var headTr = el('tr');
  ['Ημερομηνία','Κατάσταση','Ώρες','Σημείωση',''].forEach(function(h) {
    headTr.appendChild(el('th', '', h));
  });
  thead.appendChild(headTr); table.appendChild(thead);

  var tbody = el('tbody');
  result.data.forEach(function(row) {
    var tr = el('tr');
    tr.appendChild(makeTd(formatDate(row.date)));

    var statusTd = el('td');
    var badge = el('span', 'adm-badge ' + (row.is_open ? 'adm-badge-confirmed' : 'adm-badge-cancelled'));
    badge.textContent = row.is_open ? 'Ανοιχτό' : 'Κλειστό';
    statusTd.appendChild(badge); tr.appendChild(statusTd);

    var hours = row.is_open
      ? (row.open_time || '').slice(0,5) + ' – ' + (row.close_time || '').slice(0,5)
      : '—';
    tr.appendChild(makeTd(hours));
    tr.appendChild(makeTd(row.note || ''));

    var actionTd = el('td');
    var delBtn = el('button', 'adm-btn-danger', 'Διαγραφή');
    delBtn.addEventListener('click', async function() {
      delBtn.disabled = true;
      await db.from('exception_dates').delete().eq('id', row.id);
      loadExceptions();
    });
    actionTd.appendChild(delBtn); tr.appendChild(actionTd);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  list.appendChild(table);
}

// Toggle hours visibility based on is-open checkbox
(function() {
  var chk = document.getElementById('exc-is-open');
  if (!chk) return;
  chk.addEventListener('change', function() {
    document.getElementById('exc-hours-wrap').style.display = chk.checked ? 'flex' : 'none';
    document.getElementById('exc-open-label').textContent = chk.checked ? 'Ανοιχτό' : 'Κλειστό';
  });
})();

document.getElementById('adm-add-exc-btn').addEventListener('click', async function() {
  var date      = document.getElementById('exc-date').value;
  var isOpen    = document.getElementById('exc-is-open').checked;
  var openTime  = document.getElementById('exc-open-time').value;
  var closeTime = document.getElementById('exc-close-time').value;
  var note      = document.getElementById('exc-note').value.trim();
  var errEl     = document.getElementById('adm-exc-error');

  if (!date) {
    errEl.textContent = 'Επιλέξτε ημερομηνία.';
    errEl.style.display = ''; return;
  }
  errEl.style.display = 'none';
  var btn = document.getElementById('adm-add-exc-btn');
  btn.disabled = true;

  await db.from('exception_dates').upsert([{
    date:       date,
    is_open:    isOpen,
    open_time:  isOpen ? openTime + ':00' : null,
    close_time: isOpen ? closeTime + ':00' : null,
    note:       note || null,
  }], { onConflict: 'date' });

  document.getElementById('exc-date').value  = '';
  document.getElementById('exc-note').value  = '';
  btn.disabled = false;
  loadExceptions();
});

// ── Blocked Dates ─────────────────────────────────────────────────────────────
async function loadBlockedDates() {
  var list = document.getElementById('adm-blocked-list');
  clearEl(list);
  var loading = el('span', '', 'Φόρτωση...');
  loading.style.cssText = 'color:rgba(255,255,255,0.3);font-size:0.85rem';
  list.appendChild(loading);

  var result = await db.from('blocked_dates').select('*').order('date');
  clearEl(list);

  if (!result.data || result.data.length === 0) {
    var empty = el('span', '', 'Δεν υπάρχουν αποκλεισμένες ημέρες.');
    empty.style.cssText = 'color:rgba(255,255,255,0.3);font-size:0.85rem';
    list.appendChild(empty);
    return;
  }

  result.data.forEach(function(row) {
    var chip = el('div', 'adm-blocked-chip');
    chip.appendChild(el('span', '', formatDate(row.date)));
    var removeBtn = el('button', '', '\u00d7');
    removeBtn.title = 'Αφαίρεση';
    removeBtn.addEventListener('click', async function() {
      await db.from('blocked_dates').delete().eq('id', row.id);
      loadBlockedDates();
    });
    chip.appendChild(removeBtn);
    list.appendChild(chip);
  });
}

document.getElementById('adm-add-date-btn').addEventListener('click', async function() {
  var input = document.getElementById('adm-date-input');
  var val   = input.value;
  if (!val) return;
  var btn = document.getElementById('adm-add-date-btn');
  btn.disabled = true;
  await db.from('blocked_dates').insert([{ date: val }]);
  input.value = ''; btn.disabled = false;
  loadBlockedDates();
});
