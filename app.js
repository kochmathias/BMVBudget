// ==========================================================================
// 1. INITIAL STATE & PERSISTENCE
// ==========================================================================

const DEFAULT_STATE = {
  currentYear: 2025,
  currentUser: null,
  users: [
    { id: 'u1', name: 'Administrator', username: 'admin', email: 'admin@verein.at', role: 'admin', password: 'admin123', active: true }
  ],
  years: {
    2025: {
      gesperrt: false,
      freigegeben: false,
      freigabeHistorie: [],
      referate: [
        { id: 'r1', name: 'Obmann', gesperrt: false, freigabeHistorie: [] },
        { id: 'r2', name: 'Jugend', gesperrt: false, freigabeHistorie: [] }
      ],
      buchungssaetze: [
        { id: 'b1', referatId: 'r1', bezeichnung: 'Förderungen', typ: 'einnahme', budget: 1500, ist: 1750, fixiert: false, fixiertVon: null, fixiertAm: null },
        { id: 'b2', referatId: 'r1', bezeichnung: 'Fußballturnier', typ: 'ausgabe', budget: 1000, ist: 800, fixiert: false, fixiertVon: null, fixiertAm: null },
        { id: 'b3', referatId: 'r1', bezeichnung: 'Fußballturnier', typ: 'einnahme', budget: 200, ist: 100, fixiert: false, fixiertVon: null, fixiertAm: null },
        { id: 'b4', referatId: 'r1', bezeichnung: 'Ausgaben Zeitschriften', typ: 'ausgabe', budget: 500, ist: 500, fixiert: false, fixiertVon: null, fixiertAm: null },
        { id: 'b5', referatId: 'r1', bezeichnung: 'Fortbildung (Funktionäre)', typ: 'ausgabe', budget: 2000, ist: 1500, fixiert: false, fixiertVon: null, fixiertAm: null },
        { id: 'b6', referatId: 'r1', bezeichnung: 'Fortbildungen (Funktionäre)', typ: 'einnahme', budget: 1000, ist: 800, fixiert: false, fixiertVon: null, fixiertAm: null },
        { id: 'b7', referatId: 'r1', bezeichnung: 'Konzertwertung', typ: 'einnahme', budget: 10000, ist: 9000, fixiert: false, fixiertVon: null, fixiertAm: null },
        { id: 'b8', referatId: 'r1', bezeichnung: 'Konzertwertung', typ: 'ausgabe', budget: 500, ist: 6000, fixiert: false, fixiertVon: null, fixiertAm: null },
        { id: 'b9', referatId: 'r2', bezeichnung: 'Leistungsabzeichen', typ: 'ausgabe', budget: 1000, ist: 1000, fixiert: false, fixiertVon: null, fixiertAm: null },
        { id: 'b10', referatId: 'r2', bezeichnung: 'Leistungsabzeichen', typ: 'einnahme', budget: 1000, ist: 1000, fixiert: false, fixiertVon: null, fixiertAm: null }
      ]
    }
  }
};

let state = JSON.parse(localStorage.getItem('bmv_budget_state')) || DEFAULT_STATE;
function saveState() { localStorage.setItem('bmv_budget_state', JSON.stringify(state)); }

// ==========================================================================
// 2. UTILS & COLOR LOGIC (BUDGET-DENKFEHLER BEHOBEN)
// ==========================================================================

function uid() { return 'id_' + Math.random().toString(36).substr(2, 9); }
function parseNum(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  let clean = val.toString().replace(/[^0-9,\-]/g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}
function fmt(num) { return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(num || 0); }
function fmtPercent(num) { return new Intl.NumberFormat('de-AT', { style: 'percent', minimumFractionDigits: 1 }).format(num || 0); }
function getYearData() { return state.years[state.currentYear] || { referate: [], buchungssaetze: [] }; }
function getCurrentTimestamp() { return new Date().toLocaleString('de-AT'); }

// Gibt Klassen und Vorzeichen basierend auf Typ (Einnahme/Ausgabe) zurück
function getAbweichungProps(typ, budget, ist) {
  const b = parseNum(budget);
  const i = parseNum(ist);
  const diff = i - b;
  
  let prozent = b !== 0 ? diff / b : 0;
  letisGuenstig = typ === 'einnahme' ? diff >= 0 : diff <= 0;
  
  // Formatierung des Vorzeichens für die UI
  let sign = diff > 0 ? '+' : '';
  
  return {
    wert: diff,
    prozent: prozent,
    className: diff === 0 ? 'text-muted' : (isGuenstig ? 'text-success fw-bold' : 'text-danger fw-bold'),
    formatted: `${sign}${fmt(diff)} (${sign}${fmtPercent(prozent)})`
  };
}

// ==========================================================================
// 3. ROLES & AUTHENTICATION
// ==========================================================================

function isAdmin() { return state.currentUser?.role === 'admin'; }
function isPruefer() { return ['admin', 'pruefer'].includes(state.currentUser?.role); }
function canWrite() { return ['admin', 'pruefer', 'schreiber'].includes(state.currentUser?.role); }

function checkLogin(username, password) {
  const u = username.toLowerCase().trim();
  const user = state.users.find(usr => usr.username.toLowerCase() === u && usr.password === password && usr.active !== false);
  if (user) { state.currentUser = user; saveState(); return true; }
  return false;
}

// ==========================================================================
// 4. INTERFACE: IST-WERTE ERFASSEN & VALIDIEREN
// ==========================================================================

function renderIstwerte() {
  const d = getYearData();
  const tbody = document.getElementById('istwerte-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  d.buchungssaetze.forEach(b => {
    const props = getAbweichungProps(b.typ, b.budget, b.ist);
    const darfEditieren = canWrite() && !b.fixiert && !d.gesperrt;
    
    let aktionsButton = '';
    if (b.fixiert) {
      aktionsButton = `<span class="badge bg-lock text-wrap">🔒 Fixiert am ${b.fixiertAm} von ${b.fixiertVon}</span>`;
      if (isAdmin()) {
        aktionsButton += `<button class="btn btn-xs btn-outline-danger ms-2" onclick="unfixiereWert('${b.id}')">Aufheben</button>`;
      }
    } else if (isPruefer() && !d.gesperrt) {
      aktionsButton = `<button class="btn btn-sm btn-success" onclick="fixiereWert('${b.id}')">✓ Fixieren</button>`;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${b.bezeichnung}</td>
      <td><span class="badge ${b.typ === 'einnahme' ? 'bg-success-light' : 'bg-warning-light'}">${b.typ.toUpperCase()}</span></td>
      <td class="text-end">${fmt(b.budget)}</td>
      <td>
        <input type="text" class="form-control form-control-sm text-end input-ist" 
               value="${b.ist}" 
               ${darfEditieren ? '' : 'disabled'} 
               onchange="updateIstWert('${b.id}', this.value)" />
      </td>
      <td class="text-end ${props.className}">${props.formatted}</td>
      <td>${aktionsButton}</td>
    `;
    tbody.appendChild(tr);
  });
}

// VALIDIERUNG & UPDATE
function updateIstWert(id, value) {
  const d = getYearData();
  const b = d.buchungssaetze.find(item => item.id === id);
  if (!b || b.fixiert || d.gesperrt) return;

  // Validierung: Erlaubt deutsches Komma, wandelt um, verbietet negative Werte
  let cleanValue = value.replace(',', '.').trim();
  let numericValue = parseFloat(cleanValue);

  if (isNaN(numericValue) || numericValue < 0) {
    alert("Ungültige Eingabe! Bitte geben Sie eine positive, reelle Zahl ein.");
    renderIstwerte();
    return;
  }

  b.ist = numericValue;
  saveState();
  renderIstwerte();
}

// FIXIEREN (4-Augen-Prinzip)
function fixiereWert(id) {
  if (!isPruefer()) return;
  const d = getYearData();
  const b = d.buchungssaetze.find(item => item.id === id);
  if (b) {
    b.fixiert = true;
    b.fixiertVon = state.currentUser.name;
    b.fixiertAm = getCurrentTimestamp();
    saveState();
    renderIstwerte();
  }
}

// ENTSPERREN (Nur Admin)
function unfixiereWert(id) {
  if (!isAdmin()) return;
  const d = getYearData();
  const b = d.buchungssaetze.find(item => item.id === id);
  if (b) {
    b.fixiert = false;
    b.fixiertVon = null;
    b.fixiertAm = null;
    saveState();
    renderIstwerte();
  }
}

// ==========================================================================
// 5. USER MANAGEMENT (FIXED)
// ==========================================================================

function handleCreateUser(event) {
  if (event) event.preventDefault();
  
  const nameInput = document.getElementById('user-new-name');
  const userInput = document.getElementById('user-new-username');
  const roleSelect = document.getElementById('user-new-role');
  const passInput = document.getElementById('user-new-password');

  if (!nameInput || !userInput || !passInput) return;

  const usernameClean = userInput.value.trim().toLowerCase();

  if (state.users.some(u => u.username === usernameClean)) {
    alert('Fehler: Dieser Benutzername ist bereits vergeben!');
    return;
  }

  const newUser = {
    id: uid(),
    name: nameInput.value.trim(),
    username: usernameClean,
    role: roleSelect ? roleSelect.value : 'schreiber',
    password: passInput.value,
    active: true
  };

  state.users.push(newUser);
  saveState();
  
  nameInput.value = ''; userInput.value = ''; passInput.value = '';
  alert(`Benutzer "${newUser.name}" wurde erfolgreich im System hinterlegt!`);
  renderBenutzer();
}
