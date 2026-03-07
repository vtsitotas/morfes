// Morfes - Dynamic Booking System
// Requires: @supabase/supabase-js v2 loaded via CDN

var SUPABASE_URL  = 'https://kcekfqlyivpretwdzjau.supabase.co';
var SUPABASE_ANON = 'sb_publishable_h0k95OHsVFr7NhrsTr8Nzg_4CWTH5lV';

var db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// Working hours loaded from DB: key = weekday Mon=0..Sun=6
var workingHours  = {};
var exceptionDates = {}; // key = 'YYYY-MM-DD', overrides weekly schedule
var slotStep      = 30;

var state = {
  step: 1, services: [], service: null,
  date: null, slot: null, name: '', phone: '', email: '',
};

var calYear  = null;
var calMonth = null;

function pad(n)        { return String(n).padStart(2, '0'); }
function minToTime(m)  { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
function timeToMin(t)  { var p = t.split(':'); return Number(p[0]) * 60 + Number(p[1]); }
function isoDate(d)    { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function jsDay2WD(jd)  { return (jd + 6) % 7; } // JS getDay() 0=Sun -> Mon=0..Sun=6

// Returns hours for a specific date: exception overrides weekly schedule
function getDayHours(iso, weekday) {
  if (exceptionDates[iso] !== undefined) return exceptionDates[iso];
  return workingHours[weekday];
}

function clearEl(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function el(tag, cls, txt) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined) e.textContent = txt;
  return e;
}

var GR_DAYS   = ['Κυριακή','Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο'];
var GR_MONTHS = ['Ιανουαρίου','Φεβρουαρίου','Μαρτίου','Απριλίου','Μαΐου','Ιουνίου',
                 'Ιουλίου','Αυγούστου','Σεπτεμβρίου','Οκτωβρίου','Νοεμβρίου','Δεκεμβρίου'];

function formatDateGR(d) {
  return GR_DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + GR_MONTHS[d.getMonth()] + ' ' + d.getFullYear();
}

var root = document.getElementById('booking-widget');

function goStep(n) { state.step = n; render(); }

function render() {
  clearEl(root);
  renderStepper();
  if      (state.step === 1) renderServices();
  else if (state.step === 2) renderCalendar();
  else if (state.step === 3) renderSlots();
  else if (state.step === 4) renderCustomerForm();
  else if (state.step === 5) renderConfirmation();
  else if (state.step === 6) renderSuccess();
}

function renderStepper() {
  if (state.step === 6) return;
  var labels = ['Υπηρεσία','Ημερομηνία','Ώρα','Στοιχεία','Επιβεβαίωση'];
  var stepper = el('div', 'bk-stepper');
  labels.forEach(function(lbl, i) {
    var n   = i + 1;
    var cls = n < state.step ? 'done' : n === state.step ? 'active' : '';
    var circle = el('div', 'bk-step-circle', n < state.step ? '✓' : String(n));
    var label  = el('span', 'bk-step-label', lbl);
    var step   = el('div', 'bk-step' + (cls ? ' ' + cls : ''));
    step.appendChild(circle);
    step.appendChild(label);
    stepper.appendChild(step);
    if (i < labels.length - 1) stepper.appendChild(el('div', 'bk-step-line'));
  });
  root.appendChild(stepper);
}

async function renderServices() {
  if (!state.services.length) {
    root.appendChild(el('p', 'bk-step-sub', 'Φόρτωση...'));
    var result = await db.from('services').select('*').eq('active', true).order('id');
    clearEl(root);
    renderStepper();
    if (result.error || !result.data) {
      root.appendChild(el('p', 'bk-error', 'Σφάλμα φόρτωσης. Δοκιμάστε ξανά.'));
      return;
    }
    state.services = result.data;
  }

  var wrap = el('div');
  wrap.appendChild(el('h3', 'bk-step-title', 'Επιλέξτε υπηρεσία'));
  var grid = el('div', 'bk-service-grid');

  state.services.forEach(function(s) {
    var selected = state.service && state.service.id === s.id;
    var btn = el('button', 'bk-service-card' + (selected ? ' selected' : ''));
    btn.dataset.id  = s.id;
    btn.dataset.name = s.name;
    btn.dataset.dur  = s.duration_min;
    btn.appendChild(el('span', 'bk-service-icon', s.emoji || '\u2702\uFE0F'));
    btn.appendChild(el('span', 'bk-service-name', s.name));
    btn.appendChild(el('span', 'bk-service-dur',  s.duration_min + ' λεπτά'));
    btn.addEventListener('click', function() {
      state.service = { id: Number(btn.dataset.id), name: s.name, duration_min: Number(btn.dataset.dur) };
      state.date = null; state.slot = null;
      goStep(2);
    });
    grid.appendChild(btn);
  });

  wrap.appendChild(grid);
  root.appendChild(wrap);
}

async function renderCalendar() {
  var today = new Date();
  if (calYear === null) { calYear = today.getFullYear(); calMonth = today.getMonth(); }

  var monthStart = calYear + '-' + pad(calMonth + 1) + '-01';
  var lastDay    = new Date(calYear, calMonth + 1, 0).getDate();
  var monthEnd   = calYear + '-' + pad(calMonth + 1) + '-' + pad(lastDay);

  var blocked = await db.from('blocked_dates').select('date').gte('date', monthStart).lte('date', monthEnd);
  var blockedSet = new Set((blocked.data || []).map(function(b) { return b.date; }));

  var firstDOW = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;
  var monthName = new Date(calYear, calMonth, 1).toLocaleDateString('el-GR', { month: 'long', year: 'numeric' });
  var isCurrMonth = calYear === today.getFullYear() && calMonth === today.getMonth();
  var todayMid    = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  var wrap = el('div');
  wrap.appendChild(el('h3', 'bk-step-title', 'Επιλέξτε ημερομηνία'));
  wrap.appendChild(el('p', 'bk-step-sub', 'Υπηρεσία: ' + state.service.name + ' (' + state.service.duration_min + ' λεπτά)'));

  var nav = el('div', 'bk-cal-nav');
  var prevBtn = el('button', 'bk-cal-nav-btn', '\u2039');
  if (isCurrMonth) { prevBtn.disabled = true; prevBtn.style.opacity = '0.3'; prevBtn.style.cursor = 'default'; }
  var nextBtn = el('button', 'bk-cal-nav-btn', '\u203a');
  nav.appendChild(prevBtn);
  nav.appendChild(el('span', 'bk-cal-month', monthName));
  nav.appendChild(nextBtn);
  wrap.appendChild(nav);

  var calGrid = el('div', 'bk-cal-grid');
  ['Δε','Τρ','Τε','Πε','Πα','Σα','Κυ'].forEach(function(d, i) {
    calGrid.appendChild(el('div', 'bk-cal-header' + (i === 6 ? ' bk-cal-sun' : ''), d));
  });
  for (var e = 0; e < firstDOW; e++) calGrid.appendChild(el('div'));

  for (var d = 1; d <= lastDay; d++) {
    var date    = new Date(calYear, calMonth, d);
    var iso     = isoDate(date);
    var weekday = jsDay2WD(date.getDay());
    var wh      = getDayHours(iso, weekday);
    var isClosed   = wh ? !wh.is_open : true;
    var isPast     = date < todayMid;
    var isBlocked  = blockedSet.has(iso);
    var isSelected = state.date && isoDate(state.date) === iso;
    var disabled   = isPast || isClosed || isBlocked;

    var dayBtn = el('button', 'bk-cal-day' + (disabled ? ' disabled' : '') + (isSelected ? ' selected' : ''), String(d));
    dayBtn.dataset.iso = iso;
    if (disabled) dayBtn.disabled = true;
    calGrid.appendChild(dayBtn);
  }
  wrap.appendChild(calGrid);

  var backBtn = el('button', 'bk-back', '\u2190 Πίσω');
  wrap.appendChild(backBtn);
  root.appendChild(wrap);

  prevBtn.addEventListener('click', function() {
    if (isCurrMonth) return;
    if (calMonth === 0) { calYear--; calMonth = 11; } else { calMonth--; }
    clearEl(root); renderStepper(); renderCalendar();
  });
  nextBtn.addEventListener('click', function() {
    if (calMonth === 11) { calYear++; calMonth = 0; } else { calMonth++; }
    clearEl(root); renderStepper(); renderCalendar();
  });
  calGrid.querySelectorAll('.bk-cal-day:not([disabled])').forEach(function(btn) {
    btn.addEventListener('click', function() {
      state.date = new Date(btn.dataset.iso + 'T00:00:00');
      state.slot = null; goStep(3);
    });
  });
  backBtn.addEventListener('click', function() { goStep(1); });
}

async function renderSlots() {
  var dateStr = isoDate(state.date);
  var weekday = jsDay2WD(state.date.getDay());
  var wh      = getDayHours(dateStr, weekday);

  var wrap = el('div');
  wrap.appendChild(el('h3', 'bk-step-title', 'Επιλέξτε ώρα'));
  wrap.appendChild(el('p', 'bk-step-sub', formatDateGR(state.date) + ' \u00b7 ' + state.service.name));

  if (!wh || !wh.is_open) {
    wrap.appendChild(el('p', 'bk-no-slots', 'Το κομμωτήριο είναι κλειστό αυτή την ημέρα.'));
  } else {
    var result = await db.from('bookings').select('start_time, end_time')
      .eq('date', dateStr).neq('status', 'cancelled');

    var existing = (result.data || []).map(function(b) {
      return { s: timeToMin(b.start_time), e: timeToMin(b.end_time) };
    });

    var openMin  = timeToMin(wh.open_time);
    var closeMin = timeToMin(wh.close_time);
    var dur      = state.service.duration_min;
    var slots    = [];
    for (var m = openMin; m + dur <= closeMin; m += slotStep) {
      if (!existing.some(function(b) { return m < b.e && m + dur > b.s; })) slots.push(m);
    }

    if (slots.length === 0) {
      wrap.appendChild(el('p', 'bk-no-slots', 'Δεν υπάρχουν διαθέσιμες ώρες. Δοκιμάστε άλλη ημερομηνία.'));
    } else {
      var grid = el('div', 'bk-slots-grid');
      slots.forEach(function(m) {
        var t   = minToTime(m);
        var btn = el('button', 'bk-slot' + (state.slot === t ? ' selected' : ''), t);
        btn.dataset.t = t;
        btn.addEventListener('click', function() { state.slot = t; goStep(4); });
        grid.appendChild(btn);
      });
      wrap.appendChild(grid);
    }
  }

  var backBtn = el('button', 'bk-back', '\u2190 Πίσω');
  backBtn.addEventListener('click', function() { goStep(2); });
  wrap.appendChild(backBtn);
  root.appendChild(wrap);
}

function renderCustomerForm() {
  function makeInput(type, placeholder, value) {
    var inp = el('input');
    inp.type = type; inp.placeholder = placeholder; inp.value = value;
    return inp;
  }
  function makeField(labelTxt, inputEl, optional) {
    var field = el('div', 'bk-field');
    var lbl   = el('label', '', labelTxt);
    if (!optional) {
      var req = el('span', 'bk-req', ' *'); lbl.appendChild(req);
    } else {
      var opt = el('span', 'bk-opt', ' (προαιρετικό)'); lbl.appendChild(opt);
    }
    field.appendChild(lbl); field.appendChild(inputEl); return field;
  }

  var nameInp  = makeInput('text',  'π.χ. Μαρία Παπαδοπούλου', state.name);
  var phoneInp = makeInput('tel',   'π.χ. 6900000000',          state.phone);
  var emailInp = makeInput('email', 'π.χ. maria@gmail.com',     state.email);

  var form = el('div', 'bk-form');
  form.appendChild(makeField('Όνομα',     nameInp,  false));
  form.appendChild(makeField('Τηλέφωνο',  phoneInp, false));
  form.appendChild(makeField('Email',     emailInp, true));

  var errEl  = el('p', 'bk-error');
  errEl.style.display = 'none';
  form.appendChild(errEl);

  var nextBtn = el('button', 'bk-btn-primary', 'Συνέχεια \u2192');
  form.appendChild(nextBtn);

  var wrap = el('div');
  wrap.appendChild(el('h3', 'bk-step-title', 'Τα στοιχεία σας'));
  wrap.appendChild(form);

  var backBtn = el('button', 'bk-back', '\u2190 Πίσω');
  wrap.appendChild(backBtn);
  root.appendChild(wrap);

  nextBtn.addEventListener('click', function() {
    var name  = nameInp.value.trim();
    var phone = phoneInp.value.trim();
    if (!name || !phone) {
      errEl.textContent = 'Παρακαλώ συμπληρώστε όνομα και τηλέφωνο.';
      errEl.style.display = ''; return;
    }
    state.name = name; state.phone = phone; state.email = emailInp.value.trim();
    goStep(5);
  });
  backBtn.addEventListener('click', function() { goStep(3); });
}

function renderConfirmation() {
  var endMin = timeToMin(state.slot) + state.service.duration_min;

  function makeRow(label, value) {
    var row    = el('div', 'bk-summary-row');
    var span   = el('span', '', label);
    var strong = document.createElement('strong');
    strong.textContent = value;
    row.appendChild(span); row.appendChild(strong); return row;
  }

  var summary = el('div', 'bk-summary');
  summary.appendChild(makeRow('Υπηρεσία',   state.service.name));
  summary.appendChild(makeRow('Ημερομηνία', formatDateGR(state.date)));
  summary.appendChild(makeRow('Ώρα',        state.slot + ' \u2013 ' + minToTime(endMin)));
  summary.appendChild(makeRow('Όνομα',      state.name));
  summary.appendChild(makeRow('Τηλέφωνο',   state.phone));
  if (state.email) summary.appendChild(makeRow('Email', state.email));

  var errEl     = el('p', 'bk-error'); errEl.style.display = 'none';
  var submitBtn = el('button', 'bk-btn-primary', '\uD83D\uDCC5 Επιβεβαίωση Κράτησης');
  var backBtn   = el('button', 'bk-back', '\u2190 Πίσω');

  var wrap = el('div');
  wrap.appendChild(el('h3', 'bk-step-title', 'Επιβεβαίωση Ραντεβού'));
  wrap.appendChild(summary);
  wrap.appendChild(errEl);
  wrap.appendChild(submitBtn);
  wrap.appendChild(backBtn);
  root.appendChild(wrap);

  submitBtn.addEventListener('click', async function() {
    submitBtn.disabled = true; submitBtn.textContent = 'Αποστολή...';
    var endM = timeToMin(state.slot) + state.service.duration_min;
    var booking = {
      service_id: state.service.id, customer_name: state.name,
      customer_phone: state.phone, customer_email: state.email || null,
      date: isoDate(state.date), start_time: state.slot + ':00',
      end_time: minToTime(endM) + ':00', status: 'confirmed',
    };
    var result = await db.from('bookings').insert([booking]).select().single();
    if (result.error) {
      errEl.textContent = 'Σφάλμα κατά την κατοχώρηση. Δοκιμάστε ξανά ή τηλεφωνήστε μας.';
      errEl.style.display = '';
      submitBtn.disabled = false; submitBtn.textContent = '\uD83D\uDCC5 Επιβεβαίωση Κράτησης';
      return;
    }
    db.functions.invoke('send-booking-email', {
      body: { booking: result.data, service: state.service },
    }).catch(function() {});
    goStep(6);
  });
  backBtn.addEventListener('click', function() { goStep(4); });
}

function renderSuccess() {
  var endMin = timeToMin(state.slot) + state.service.duration_min;
  var wrapper = el('div', 'bk-success');

  wrapper.appendChild(el('div', 'bk-success-icon', '\u2705'));
  wrapper.appendChild(el('h3', '', 'Η κράτησή σας καταχωρήθηκε!'));
  wrapper.appendChild(el('p', '', state.service.name));
  wrapper.appendChild(el('p', '', formatDateGR(state.date)));
  wrapper.appendChild(el('p', '', state.slot + ' \u2013 ' + minToTime(endMin)));

  if (state.email) {
    wrapper.appendChild(el('p', 'bk-success-sub', 'Θα λάβετε επιβεβαίωση στο email σας σύντομα.'));
  }

  var pPhone = el('p', 'bk-success-sub', 'Για αλλαγές ή ακύρωση: ');
  var aPhone = el('a', '', '231 083 6982');
  aPhone.href = 'tel:2310836982';
  pPhone.appendChild(aPhone);
  wrapper.appendChild(pPhone);

  var newBtn = el('button', 'bk-btn-secondary', 'Νέα Κράτηση');
  wrapper.appendChild(newBtn);

  clearEl(root);
  root.appendChild(wrapper);

  newBtn.addEventListener('click', function() {
    state.step = 1; state.service = null; state.date = null;
    state.slot = null; state.name = ''; state.phone = ''; state.email = '';
    calYear = null; calMonth = null; render();
  });
}

// Init: load working hours, exceptions, slot step from Supabase, then render
async function initBooking() {
  if (!root) return;

  var today = new Date();
  var todayIso = isoDate(today);

  var [whRes, exRes, stRes] = await Promise.all([
    db.from('working_hours').select('*').order('weekday'),
    db.from('exception_dates').select('*').gte('date', todayIso),
    db.from('booking_settings').select('slot_step').limit(1).single(),
  ]);

  if (whRes.data) {
    whRes.data.forEach(function(row) {
      workingHours[row.weekday] = { is_open: row.is_open, open_time: row.open_time, close_time: row.close_time };
    });
  }
  if (exRes.data) {
    exRes.data.forEach(function(row) {
      exceptionDates[row.date] = { is_open: row.is_open, open_time: row.open_time, close_time: row.close_time };
    });
  }
  if (stRes.data && stRes.data.slot_step) slotStep = stRes.data.slot_step;

  render();
}

initBooking();
