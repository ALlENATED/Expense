/* app.js — full app logic. */

const FB = window.FB;
const BUDGET_ID = 'shared';

const App = {
  user: null, settings: null, userSettings: null,
  categories: [], expenses: [], toPay: [], buy: [], history: [], goals: [],
  screen: 'home', historyYear: null, toastTimer: null, listeners: [],
  settingsLoaded: false,
  activeBuyList: 'default'
};

const DEFAULT_SETTINGS = {
  appName: 'Our Budget', currency: 'SEK', totalBudget: 12000,
  periodStartDay: 25, toPayResetDay: 'last',
  timezone: 'Europe/Stockholm',
  members: {}, lastResetKey: null, owners: [], bannedUids: [],
  pillColors: { sub: 'blue', rep: 'purple', debt: 'red', pin: 'red' },
  buyLists: [{ id: 'default', name: 'General', colorKey: 'blue' }]
};

const DEFAULT_USER_SETTINGS = {
  theme: 'system', heroTone: 'forest', pins: [],
  salary: 0,
  budgetMethod: 'fixed', budgetFixed: 0, budgetPct: 50,
  toPayMethod: 'fixed', toPayFixed: 0, toPayPct: 50,
  trackSavings: false
};

const SEED_CATEGORIES = [
  { name: 'Groceries',     icon: '🛒', limit: 5000, colorKey: 'green',  parentId: '' },
  { name: 'Transport',     icon: '🚌', limit: 1500, colorKey: 'blue',   parentId: '' },
  { name: 'Dining out',    icon: '🍽️', limit: 1000, colorKey: 'red',    parentId: '' },
  { name: 'Utilities',     icon: '💡', limit: 2000, colorKey: 'amber',  parentId: '' },
  { name: 'Entertainment', icon: '🎬', limit: 1500, colorKey: 'purple', parentId: '' },
  { name: 'Health',        icon: '💊', limit: 1000, colorKey: 'teal',   parentId: '' },
];

const TABS = [
  { id: 'home',       label: 'Home',       icon: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>' },
  { id: 'categories', label: 'Categories', icon: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>' },
  { id: 'buy',        label: 'Buy',        icon: '<path d="M5 7h14l-1.4 11.2a2 2 0 0 1-2 1.8H8.4a2 2 0 0 1-2-1.8L5 7z"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/>' },
  { id: 'topay',      label: 'To Pay',     icon: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m8 12 3 3 5-6"/>' },
  { id: 'history',    label: 'History',    icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>' },
  { id: 'saved',      label: 'Saved',      icon: '<path d="M4 7h16v12H4z"/><path d="M4 7h16M9 7V4h6v3"/><circle cx="12" cy="13" r="2"/>' },
  { id: 'settings',   label: 'Settings',   icon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>' },
];

const SCREENS = TABS.map(t => t.id);
const ScreenRenderers = {};

FB.onAuthStateChanged(FB.auth, async (user) => {
  if (user) {
    App.user = user;
    document.getElementById('login-screen').hidden = true;
    await startApp();
  } else {
    signedOut();
  }
});

document.getElementById('forgot-pw-btn').addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  if (!email) return showLoginError('Enter your email first, then click Forgot Password.');
  try {
    await FB.sendPasswordResetEmail(FB.auth, email);
    toast('Reset link sent to ' + email);
    hideLoginError();
  } catch (err) { showLoginError(err.message); }
});

let googleBusy = false;
const googleBtn = document.getElementById('google-signin');
if (googleBtn) {
  googleBtn.addEventListener('click', async () => {
    if (googleBusy) return;
    googleBusy = true;
    googleBtn.disabled = true;
    try {
      await FB.signInWithPopup(FB.auth, new FB.GoogleAuthProvider());
    } catch (err) { authError(err); }
    finally { googleBusy = false; googleBtn.disabled = false; }
  });
}

function loginFields() {
  return {
    email: document.getElementById('login-email').value.trim(),
    password: document.getElementById('login-password').value,
  };
}
function showLoginError(msg) {
  const el = document.getElementById('login-error');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}
function hideLoginError() {
  const el = document.getElementById('login-error');
  if (el) el.style.display = 'none';
}
function authError(err) {
  const c = (err && err.code) || '';
  if (c === 'auth/popup-blocked' || c === 'auth/popup-closed-by-user')
    toast('Popup blocked. Allow popups, then try again.');
  else if (c === 'auth/unauthorized-domain')
    toast('Domain not authorized in Firebase → Auth → Settings.');
  else if (c === 'auth/operation-not-allowed')
    toast('Enable Google + Email/Password in Firebase Auth.');
  else toast('Sign-in failed: ' + (err.message || err));
}

const loginBtn = document.getElementById('login-btn');
if (loginBtn) loginBtn.addEventListener('click', async () => {
  hideLoginError();
  const { email, password } = loginFields();
  if (!email || !password) return showLoginError('Enter email and password.');
  try {
    await FB.signInWithEmailAndPassword(FB.auth, email, password);
  } catch (err) {
    const c = err.code || '';
    if (['auth/invalid-credential','auth/wrong-password','auth/user-not-found','auth/invalid-login-credentials'].includes(c))
      showLoginError('Wrong email or password.');
    else if (c === 'auth/too-many-requests') showLoginError('Too many attempts — try later.');
    else if (c === 'auth/network-request-failed') showLoginError('Network error.');
    else if (c === 'auth/operation-not-allowed') showLoginError('Enable Email/Password in Firebase.');
    else showLoginError(err.message);
  }
});

const signupBtn = document.getElementById('signup-btn');
if (signupBtn) signupBtn.addEventListener('click', async () => {
  hideLoginError();
  const { email, password } = loginFields();
  if (!email || !password) return showLoginError('Enter email and password.');
  if (password.length < 6) return showLoginError('Password must be at least 6 characters.');
  try {
    await FB.createUserWithEmailAndPassword(FB.auth, email, password);
  } catch (err) {
    const c = err.code || '';
    if (c === 'auth/email-already-in-use') showLoginError('Account exists — tap "Sign in".');
    else if (c === 'auth/invalid-email') showLoginError('Email is not valid.');
    else if (c === 'auth/weak-password') showLoginError('Password too weak.');
    else if (c === 'auth/operation-not-allowed') showLoginError('Enable Email/Password in Firebase.');
    else showLoginError(err.message);
  }
});

function signedOut() {
  detachListeners();
  App.user = null; App.settings = null; App.userSettings = null; App.settingsLoaded = false;
  App.categories = []; App.expenses = []; App.toPay = []; App.buy = []; App.history = []; App.goals = [];
  App.screen = 'home'; App.historyYear = null; App.activeBuyList = 'default';
  document.getElementById('screens').innerHTML = '';
  document.getElementById('tabbar').innerHTML = '';
  document.getElementById('login-screen').hidden = false;
  document.getElementById('loading').classList.add('hidden');
  const fab = document.getElementById('fab');
  if (fab) fab.classList.remove('show');
  closeSheet();
}

const budgetDoc     = () => FB.doc(FB.db, 'budgets', BUDGET_ID);
const categoriesCol = () => FB.collection(FB.db, 'budgets', BUDGET_ID, 'categories');
const expensesCol   = () => FB.collection(FB.db, 'budgets', BUDGET_ID, 'expenses');
const toPayCol      = () => FB.collection(FB.db, 'budgets', BUDGET_ID, 'toPay');
const buyCol        = () => FB.collection(FB.db, 'budgets', BUDGET_ID, 'buy');
const historyCol    = () => FB.collection(FB.db, 'budgets', BUDGET_ID, 'history');
const goalsCol      = () => FB.collection(FB.db, 'budgets', BUDGET_ID, 'goals');

async function startApp() {
  detachListeners();
  try {
    const snap = await FB.getDoc(budgetDoc());
    if (!snap.exists()) {
      await FB.setDoc(budgetDoc(), { ...DEFAULT_SETTINGS, owners: [App.user.uid] });
      App.settings = { ...DEFAULT_SETTINGS, owners: [App.user.uid] };
    } else {
      App.settings = snap.data();
      // One-time field migrations
      const updates = {};
      if (!App.settings.buyLists) updates.buyLists = DEFAULT_SETTINGS.buyLists;
      if (!App.settings.owners) updates.owners = [App.user.uid];
      if (!App.settings.bannedUids) updates.bannedUids = [];
      if (!App.settings.pillColors) updates.pillColors = DEFAULT_SETTINGS.pillColors;
      // Migrate buyLists missing colorKey
      if (App.settings.buyLists) {
        const migrated = App.settings.buyLists.map(l => l.colorKey ? l : { ...l, colorKey: 'blue' });
        if (JSON.stringify(migrated) !== JSON.stringify(App.settings.buyLists)) updates.buyLists = migrated;
      }
      if (Object.keys(updates).length) {
        await FB.updateDoc(budgetDoc(), updates);
        Object.assign(App.settings, updates);
      }
      if ((App.settings.bannedUids || []).includes(App.user.uid)) {
        toast('You have been removed from this household.');
        await FB.signOut(FB.auth);
        return;
      }
    }
  } catch (e) { console.error('budget doc:', e); }

  await registerMember();
  await migrateUserSettings();

  try {
    const cats = await FB.getDocs(categoriesCol());
    if (cats.size === 0) {
      const now = new Date().toISOString();
      for (const c of SEED_CATEGORIES) {
        await FB.addDoc(categoriesCol(), { ...c, createdAt: now });
      }
    }
  } catch (e) { console.error('seed:', e); }

  try { await FB.auth.currentUser?.getIdToken(); } catch (e) {}

  attachListeners();
  mountScreens();
  renderTabbar();
  goScreen('home');
  document.getElementById('loading').classList.add('hidden');
  // NOTE: cleanupOldExpenses removed intentionally — it silently deleted past expenses.
}

async function registerMember() {
  if (!App.user) return;
  const uid = App.user.uid;
  const email = App.user.email || '';
  const initial = (email[0] || 'U').toUpperCase();
  const members = (App.settings && App.settings.members) || {};
  try {
    if (members[uid]) {
      await FB.updateDoc(budgetDoc(), { [`members.${uid}.lastSeen`]: new Date().toISOString() });
    } else {
      await FB.updateDoc(budgetDoc(), {
        [`members.${uid}`]: {
          email, initial, avatarBase64: null, lastSeen: new Date().toISOString(),
          ...DEFAULT_USER_SETTINGS
        }
      });
    }
  } catch (e) { console.error('register member:', e); }
}

async function migrateUserSettings() {
  if (!App.user || !App.settings) return;
  const uid = App.user.uid;
  const members = App.settings.members || {};
  const me = members[uid] || {};
  let migrated = false;
  const updates = {};

  if (!me.theme) { updates[`members.${uid}.theme`] = 'system'; migrated = true; }
  if (!me.heroTone) { updates[`members.${uid}.heroTone`] = 'forest'; migrated = true; }
  if (!me.pins) { updates[`members.${uid}.pins`] = []; migrated = true; }
  if (migrated) await FB.updateDoc(budgetDoc(), updates);
}

function attachListeners() {
  const fail = (n) => (e) => console.error('listener ' + n + ':', e);

  App.listeners.push(FB.onSnapshot(budgetDoc(), (snap) => {
    if (snap.exists()) {
      App.settings = snap.data();
      if (!App.settings.buyLists) App.settings.buyLists = DEFAULT_SETTINGS.buyLists;
      if (App.user && App.settings.members && App.settings.members[App.user.uid]) {
        App.userSettings = { ...DEFAULT_USER_SETTINGS, ...App.settings.members[App.user.uid] };
      } else {
        App.userSettings = DEFAULT_USER_SETTINGS;
      }
      if (App.user && (App.settings.bannedUids || []).includes(App.user.uid)) {
        toast('You have been removed.');
        FB.signOut(FB.auth);
        return;
      }
      applyThemeAndTone();
      applyPillColors();
      if (!App.settingsLoaded) {
        App.settingsLoaded = true;
        maybeAutoReset();
        syncCurrentHistoryBudget();
      }
      if (['home','categories','settings','saved','buy'].includes(App.screen)) renderScreen(App.screen);
    }
  }, fail('settings')));

  App.listeners.push(FB.onSnapshot(
    FB.query(categoriesCol(), FB.orderBy('createdAt')),
    (snap) => {
      App.categories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (['categories','home','settings'].includes(App.screen)) renderScreen(App.screen);
    }, fail('categories')));

  App.listeners.push(FB.onSnapshot(
    FB.query(expensesCol(), FB.orderBy('dateAdded', 'desc')),
    (snap) => {
      App.expenses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (['home','categories'].includes(App.screen)) renderScreen(App.screen);
    }, fail('expenses')));

  App.listeners.push(FB.onSnapshot(
    FB.query(toPayCol(), FB.orderBy('createdAt')),
    (snap) => {
      App.toPay = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (App.screen === 'topay') renderScreen(App.screen);
    }, fail('toPay')));

  App.listeners.push(FB.onSnapshot(
    FB.query(buyCol(), FB.orderBy('createdAt')),
    (snap) => {
      App.buy = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (App.screen === 'buy') renderScreen(App.screen);
    }, fail('buy')));

  App.listeners.push(FB.onSnapshot(
    FB.query(historyCol(), FB.orderBy('periodKey', 'desc')),
    (snap) => {
      App.history = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (['history', 'saved'].includes(App.screen)) renderScreen(App.screen);
    }, fail('history')));

  App.listeners.push(FB.onSnapshot(
    FB.query(goalsCol(), FB.orderBy('createdAt')),
    (snap) => {
      App.goals = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (App.screen === 'saved') renderScreen(App.screen);
    }, fail('goals')));
}
function detachListeners() {
  App.listeners.forEach(u => { try { u(); } catch (e) {} });
  App.listeners = [];
}

/* ---------- Dates / formatting ---------- */
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_LONG  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
function pad2(n) { return (n < 10 ? '0' : '') + n; }

function parseLocalDate(iso) {
  if (!iso) return null;
  const s = String(iso).slice(0, 10);
  const parts = s.split('-');
  if (parts.length !== 3) return new Date(iso);
  const y = +parts[0], m = +parts[1], d = +parts[2];
  if (isNaN(y) || isNaN(m) || isNaN(d)) return new Date(iso);
  return new Date(y, m - 1, d);
}
function localDateString(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
function addOneMonth(baseDate) {
  const d = new Date(baseDate);
  const targetMonth = d.getMonth() + 1;
  const targetYear  = d.getFullYear() + Math.floor(targetMonth / 12);
  const actualMonth = targetMonth % 12;
  const lastDay = new Date(targetYear, actualMonth + 1, 0).getDate();
  const clampedDay = Math.min(d.getDate(), lastDay);
  return new Date(targetYear, actualMonth, clampedDay);
}

function fmtAmount(n, withCurrency) {
  const num = Math.round(Number(n) || 0);
  const s = String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (withCurrency && App.settings) ? s + ' ' + App.settings.currency : s;
}
function fmtDate(iso) {
  if (!iso) return '';
  const d = iso.length === 10 ? parseLocalDate(iso) : new Date(iso);
  if (!d || isNaN(d)) return '';
  return d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()] + ' ' + d.getFullYear();
}
function daysUntil(iso) {
  if (!iso) return null;
  const d = iso.length === 10 ? parseLocalDate(iso) : new Date(iso);
  if (!d || isNaN(d)) return null;
  const t = new Date(); t.setHours(0,0,0,0);
  return Math.round((d - t) / 86400000);
}

function ddmmyyyyToISO(str) {
  if (!str) return '';
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(str.trim());
  if (!m) return '';
  const dd = +m[1], mm = +m[2], yy = +m[3];
  if (mm < 1 || mm > 12) return '';
  if (dd < 1 || dd > 31) return '';
  const d = new Date(yy, mm - 1, dd);
  if (d.getMonth() !== mm - 1 || d.getDate() !== dd) return '';
  return yy + '-' + pad2(mm) + '-' + pad2(dd);
}
function isoToDDMMYYYY(iso) {
  if (!iso) return '';
  const d = parseLocalDate(iso);
  if (!d || isNaN(d)) return '';
  return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();
}
function autoSlashDate(el) {
  let v = el.value.replace(/\D/g, '');
  if (v.length > 8) v = v.slice(0, 8);
  let out = '';
  if (v.length >= 1) out += v.slice(0, 2);
  if (v.length >= 3) out += '/' + v.slice(2, 4);
  if (v.length >= 5) out += '/' + v.slice(4, 8);
  el.value = out;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function h(tag, attrs, children) {
  const el = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach(k => {
    if (k === 'class') el.className = attrs[k];
    else if (k === 'style') el.style.cssText = attrs[k];
    else if (k.startsWith('on') && typeof attrs[k] === 'function')
      el.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
    else if (k === 'html') el.innerHTML = attrs[k];
    else if (attrs[k] !== false && attrs[k] != null) el.setAttribute(k, attrs[k]);
  });
  if (children) (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c == null || c === false) return;
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return el;
}
function svgIcon(paths) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + paths + '</svg>';
}
function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(App.toastTimer);
  App.toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

function openSheet(builder) {
  const root = document.getElementById('sheet-root');
  root.innerHTML = '';
  const overlay = h('div', { class: 'overlay show', onclick: closeSheet });
  const sheet = h('div', { class: 'sheet' });
  const grab = h('div', { class: 'grab' });
  const body = h('div', { class: 'sheet-body' });
  const footer = h('div', { class: 'sheet-footer' });
  sheet.appendChild(grab); sheet.appendChild(body); sheet.appendChild(footer);
  root.appendChild(overlay); root.appendChild(sheet);
  requestAnimationFrame(() => sheet.classList.add('show'));
  builder(body, footer);
}
function closeSheet() {
  const root = document.getElementById('sheet-root');
  if (!root) return;
  const sheet = root.querySelector('.sheet');
  const overlay = root.querySelector('.overlay');
  if (sheet) sheet.classList.remove('show');
  if (overlay) overlay.classList.remove('show');
  setTimeout(() => { root.innerHTML = ''; }, 250);
}
function applyThemeAndTone() {
  if (!App.settings || !App.userSettings) return;
  document.body.setAttribute('data-tone', App.userSettings.heroTone || 'forest');
  let theme = App.userSettings.theme || 'system';
  if (theme === 'system')
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.body.setAttribute('data-theme', theme);
}

/* Pill colors — safe fallback for missing keys */
function applyPillColors() {
  if (!App.settings) return;
  const pc = Object.assign({ sub: 'blue', rep: 'purple', debt: 'red', pin: 'red' }, App.settings.pillColors || {});
  const readColor = (key, variant) => {
    const el = document.createElement('div');
    el.className = 'c-' + key;
    el.style.display = 'none';
    document.body.appendChild(el);
    const cs = getComputedStyle(el);
    const val = variant === 'soft' ? cs.getPropertyValue('--cat-soft').trim()
                                    : cs.getPropertyValue('--cat').trim();
    document.body.removeChild(el);
    return val;
  };
  const root = document.documentElement;
  ['sub','rep','debt','pin'].forEach(type => {
    root.style.setProperty('--pill-' + type + '-bg', readColor(pc[type], 'soft'));
    root.style.setProperty('--pill-' + type + '-cl', readColor(pc[type], 'cat'));
  });
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (App.userSettings && App.userSettings.theme === 'system') applyThemeAndTone();
});

function getAvatarHtml(uid, size = '32px') {
  const members = App.settings?.members || {};
  const m = members[uid];
  if (!m) return '';
  const initials = m.initial || (m.email ? m.email[0].toUpperCase() : 'U');
  const isMe = App.user?.uid === uid;
  const grad = isMe ? 'av-b' : 'av-a';
  const meClass = isMe ? 'me' : '';
  if (m.avatarBase64) {
    return `<div class="av ${grad} ${meClass}" style="width:${size};height:${size};background-image:url(${m.avatarBase64});background-size:cover;background-position:center;"></div>`;
  }
  const n = parseInt(size, 10) || 32;
  return `<div class="av ${grad} ${meClass}" style="width:${size};height:${size};font-size:${Math.round(n * 0.42)}px;">${initials}</div>`;
}

function displayName(uid) {
  const members = App.settings?.members || {};
  const m = members[uid];
  if (!m) return uid;
  if (uid === App.user?.uid) return 'You';
  return m.name || m.email || uid;
}

function makeAppHead(greeting, appName) {
  const head = document.createElement('div');
  head.className = 'apphead';
  head.innerHTML =
    '<div><div class="greeting">' + esc(greeting) + '</div>' +
    '<div class="appname">' + esc(appName) + '</div></div>' +
    '<div class="avatar-stack"></div>';
  const stack = head.querySelector('.avatar-stack');
  const members = (App.settings && App.settings.members) || {};
  const currentUid = App.user && App.user.uid;
  const gradients = ['av-a','av-b','av-c'];

  const list = Object.entries(members)
    .filter(([uid]) => !(App.settings?.bannedUids || []).includes(uid))
    .map(([uid, info]) => ({ uid, ...info, isMe: uid === currentUid }))
    .sort((a, b) => (a.isMe === b.isMe ? 0 : (a.isMe ? 1 : -1)));

  if (list.length === 0 && App.user) {
    const initial = ((App.user.email || 'U')[0]).toUpperCase();
    const av = document.createElement('div');
    av.className = 'av av-b me';
    av.textContent = initial;
    stack.appendChild(av);
    return head;
  }

  list.forEach((m, i) => {
    const av = document.createElement('div');
    av.className = 'av ' + gradients[i % gradients.length] + (m.isMe ? ' me' : '');
    if (m.avatarBase64) {
      av.style.backgroundImage = 'url(' + m.avatarBase64 + ')';
      av.style.backgroundSize = 'cover';
      av.style.backgroundPosition = 'center';
    } else {
      av.textContent = m.initial || 'U';
    }
    stack.appendChild(av);
  });
  return head;
}

function renderTabbar() {
  const nav = document.getElementById('tabbar');
  nav.innerHTML = '';
  TABS.forEach(t => {
    const btn = h('button', {
      class: 'tab' + (App.screen === t.id ? ' active' : ''),
      onclick: () => goScreen(t.id),
    });
    btn.innerHTML = svgIcon(t.icon) + '<span>' + t.label + '</span>';
    nav.appendChild(btn);
  });
}

function mountScreens() {
  const root = document.getElementById('screens');
  root.innerHTML = '';
  SCREENS.forEach(id => root.appendChild(h('div', { id: 'screen-' + id, class: 'screen' })));
}
function renderScreen(id) {
  const fn = ScreenRenderers[id];
  const el = document.getElementById('screen-' + id);
  if (!fn || !el) return;
  el.innerHTML = '';
  el.appendChild(fn());
}
function goScreen(id) {
  if (!SCREENS.includes(id)) return;
  App.screen = id;
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + id));
  renderTabbar();
  renderScreen(id);
  const fab = document.getElementById('fab');
  if (fab) fab.classList.toggle('show', id === 'home' || id === 'topay');
}

/* ---------- HOME ---------- */
ScreenRenderers.home = function () {
  const s = App.settings || DEFAULT_SETTINGS;
  const period = computeCurrentPeriod(s.periodStartDay);
  const expenses = App.expenses.filter(e => e.periodKey === period.key);
  const categories = App.categories;
  const byId = {}; categories.forEach(c => byId[c.id] = c);

  const spentByCat = {};
  expenses.forEach(e => {
    if (e.categoryId)    spentByCat[e.categoryId]    = (spentByCat[e.categoryId]    || 0) + Number(e.amount || 0);
    if (e.subcategoryId) spentByCat[e.subcategoryId] = (spentByCat[e.subcategoryId] || 0) + Number(e.amount || 0);
  });

  const totalSpent  = expenses.reduce((a, e) => a + Number(e.amount || 0), 0);
  const totalBudget = Number(s.totalBudget) || 0;
  const remaining   = totalBudget - totalSpent;
  const pctUsed     = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
  const pctLeft     = 100 - pctUsed;

  const wrap = document.createElement('div');
  const hr = new Date().getHours();
  const greeting = hr < 12 ? 'Good morning,' : hr < 18 ? 'Good afternoon,' : 'Good evening,';
  wrap.appendChild(makeAppHead(greeting, s.appName || 'Our Budget'));

  const pill = document.createElement('div');
  pill.className = 'period-pill';
  pill.innerHTML = '<span class="dot"></span><span>' + esc(period.label) + '</span><span class="chev">›</span>';
  wrap.appendChild(pill);

  const hero = document.createElement('div');
  hero.className = 'hero';
  hero.innerHTML =
    '<div class="hero-inner">' +
      '<div class="hero-top">' +
        '<span class="hero-lbl">Remaining</span>' +
        '<span class="hero-badge">' + pctLeft + '% left</span></div>' +
      '<div class="hero-amt">' + fmtAmount(remaining) +
        '<span class="cur">' + esc(s.currency) + '</span></div>' +
      '<div class="hero-bar"><div style="width:' + Math.min(100, pctUsed) + '%"></div></div>' +
      '<div class="hero-stats">' +
        '<div><div class="k">Budget</div><div class="v">' + fmtAmount(totalBudget) + '</div></div>' +
        '<div><div class="k">Spent</div><div class="v">' + fmtAmount(totalSpent) + '</div></div>' +
        '<div><div class="k">Days left</div><div class="v">' + period.daysLeft + '</div></div>' +
      '</div></div>';
  wrap.appendChild(hero);

  const pinned = (App.userSettings && App.userSettings.pins) || [];
  const pinCats = pinned.map(id => categories.find(c => c.id === id)).filter(Boolean).slice(0, 4);

  if (pinCats.length > 0) {
    const pinWrap = document.createElement('div');
    pinWrap.className = 'pinned-wrap';
    pinWrap.innerHTML = '<div class="pinned-head"><h3>Pinned</h3><a data-manage>Manage</a></div>';
    const grid = document.createElement('div');
    grid.className = 'pin-grid';
    grid.setAttribute('data-count', String(pinCats.length));

    pinCats.forEach(c => {
      const spent = spentByCat[c.id] || 0;
      const limit = Number(c.limit) || 0;
      const over = limit > 0 && spent > limit;
      const pctRaw = limit > 0 ? Math.round((spent / limit) * 100) : 0;
      const pct = Math.min(100, pctRaw);

      const el = document.createElement('div');
      el.className = 'pin c-' + (c.colorKey || 'blue') + (over ? ' over' : '');
      el.innerHTML =
        '<div class="top-row">' +
          '<div class="name-tag">' + esc(c.name) + '</div>' +
          '<div class="emoji-only">' + esc(c.icon || '🏷️') + '</div>' +
        '</div>' +
        '<div class="v">' + fmtAmount(spent) + '</div>' +
        '<div class="small">of ' + fmtAmount(limit) + '</div>' +
        '<div class="bar-row">' +
          '<div class="bar-in"><div style="width:' + pct + '%"></div></div>' +
          '<div class="bar-pct">' + pctRaw + '%</div>' +
        '</div>';
      el.onclick = () => openCategoryEditor(c);
      grid.appendChild(el);
    });
    pinWrap.appendChild(grid);
    wrap.appendChild(pinWrap);

    setTimeout(() => {
      const mng = pinWrap.querySelector('[data-manage]');
      if (mng) mng.onclick = () => goScreen('categories');
    }, 0);
  }

  const sechead = document.createElement('div');
  sechead.className = 'sechead';
  sechead.innerHTML = '<h2>Recent</h2><span class="meta">' + fmtAmount(totalSpent) + ' this period</span>';
  wrap.appendChild(sechead);

  if (!expenses.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.innerHTML = '<div class="emoji">🛒</div><div>No expenses yet.<br><b>Tap ＋ to add one.</b></div>';
    wrap.appendChild(empty);
  } else {
    const feed = document.createElement('div');
    feed.className = 'feed';
    const byDay = {};
    expenses.forEach(e => {
      const d = e.dateAdded ? String(e.dateAdded).slice(0, 10) : 'unknown';
      (byDay[d] = byDay[d] || []).push(e);
    });
    Object.keys(byDay).sort().reverse().forEach(dk => {
      const dayTotal = byDay[dk].reduce((a, e) => a + Number(e.amount || 0), 0);
      const dayEl = document.createElement('div');
      dayEl.className = 'day';
      dayEl.innerHTML = '<span>' + labelForDay(dk) + '</span><span class="tot">' + fmtAmount(dayTotal) + '</span>';
      feed.appendChild(dayEl);
      byDay[dk].forEach(e => {
        const cat = byId[e.subcategoryId] || byId[e.categoryId] || { name: '—', icon: '🏷️', colorKey: 'blue' };
        const exp = document.createElement('div');
        exp.className = 'exp';
        exp.innerHTML =
          '<div class="exp-icon c-' + (cat.colorKey || 'blue') + '">' + esc(cat.icon || '🏷️') + '</div>' +
          '<div class="exp-body"><div class="exp-name">' + esc(e.name) + '</div>' +
          '<div class="exp-cat">' + esc(cat.name) + '</div></div>' +
          '<div class="exp-amt">' + fmtAmount(e.amount) + '</div>';
        exp.onclick = () => openExpenseEditor(e);
        feed.appendChild(exp);
      });
    });
    wrap.appendChild(feed);
  }
  return wrap;
};

/* ---------- CATEGORIES ---------- */
ScreenRenderers.categories = function () {
  const s = App.settings || DEFAULT_SETTINGS;
  const period = computeCurrentPeriod(s.periodStartDay);
  const expenses = App.expenses.filter(e => e.periodKey === period.key);
  const categories = App.categories;
  const parents = categories.filter(c => !c.parentId);

  const spentByCat = {};
  expenses.forEach(e => {
    if (e.categoryId)    spentByCat[e.categoryId]    = (spentByCat[e.categoryId]    || 0) + Number(e.amount || 0);
    if (e.subcategoryId) spentByCat[e.subcategoryId] = (spentByCat[e.subcategoryId] || 0) + Number(e.amount || 0);
  });

  const totalSpent  = expenses.reduce((a, e) => a + Number(e.amount || 0), 0);
  const totalBudget = Number(s.totalBudget) || 0;
  const pctUsed     = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
  const remaining   = totalBudget - totalSpent;

  const wrap = document.createElement('div');
  wrap.appendChild(makeAppHead('Budget breakdown,', 'Categories'));

  const overall = document.createElement('div');
  overall.className = 'overall';
  overall.innerHTML =
    '<div class="overall-top">' +
      '<div><div class="lbl">Total spent</div>' +
      '<div class="big"><span class="num">' + fmtAmount(totalSpent) + '</span>' +
      '<span class="cur">' + esc(s.currency) + '</span></div></div>' +
      '<div class="pct">of ' + fmtAmount(totalBudget) + ' · ' + pctUsed + '%</div></div>' +
    '<div class="overall-bar"><div style="width:' + Math.min(100, pctUsed) + '%"></div></div>' +
    '<div class="overall-foot"><span>Remaining ' + fmtAmount(remaining) + '</span>' +
    '<span>' + parents.length + ' categor' + (parents.length === 1 ? 'y' : 'ies') + '</span></div>';
  wrap.appendChild(overall);

  const sh = document.createElement('div');
  sh.className = 'sechead';
  sh.innerHTML = '<h2>All categories</h2><a id="cat-new">＋ New</a>';
  wrap.appendChild(sh);

  if (!parents.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.innerHTML = '<div class="emoji">📁</div><div>No categories yet.<br><b>Add one to start tracking.</b></div>';
    wrap.appendChild(empty);
  } else {
    const myPins = (App.userSettings && App.userSettings.pins) || [];
    parents.forEach(cat => {
      const spent = spentByCat[cat.id] || 0;
      const limit = Number(cat.limit) || 0;
      const over  = limit > 0 && spent > limit;
      const pct   = limit > 0 ? Math.round((spent / limit) * 100) : 0;
      const isPinned = myPins.includes(cat.id);
      const pinHtml = isPinned ? '<span class="pin-icon">📌</span>' : '';

      const card = document.createElement('div');
      card.className = 'cat c-' + (cat.colorKey || 'blue') + (over ? ' over' : '');
      card.innerHTML =
        '<div class="cat-icon">' + esc(cat.icon || '🏷️') + '</div>' +
        '<div class="cat-body">' +
          '<div class="cat-top">' +
            '<div class="cat-name-wrap">' +
              '<span class="cat-name">' + esc(cat.name) + '</span>' +
              pinHtml +
            '</div>' +
            '<div class="cat-right">' +
              '<span class="cat-amt"><b>' + fmtAmount(spent) + '</b> / ' + fmtAmount(limit) + '</span>' +
              '<span class="cat-pct-pill">' + pct + '%</span>' +
            '</div>' +
          '</div>' +
          '<div class="cat-bar"><div style="width:' + Math.min(100, pct) + '%"></div></div>' +
        '</div>';
      card.onclick = () => openCategoryEditor(cat);
      wrap.appendChild(card);
    });
  }

  setTimeout(() => {
    const btn = document.getElementById('cat-new');
    if (btn) btn.onclick = () => openCategoryEditor(null);
  }, 0);
  return wrap;
};

/* ---------- BUY ---------- */
ScreenRenderers.buy = function () {
  const s = App.settings || DEFAULT_SETTINGS;
  const lists = s.buyLists || [{ id: 'default', name: 'General', colorKey: 'blue' }];
  const validListIds = lists.map(l => l.id);
  if (!validListIds.includes(App.activeBuyList)) App.activeBuyList = validListIds[0];

  const currentListId = App.activeBuyList;
  const items = App.buy
    .filter(x => (x.listId || 'default') === currentListId)
    .sort((a, b) => {
      if (a.checked !== b.checked) return a.checked ? 1 : -1;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

  const wrap = document.createElement('div');
  wrap.appendChild(makeAppHead('Shopping list,', 'Buy'));

  const selector = document.createElement('div');
  selector.className = 'list-selector';
  lists.forEach(l => {
    const chip = document.createElement('div');
    // Colored buy chip — uses .buy-chip.{colorKey} styles
    const colorKey = l.colorKey || 'blue';
    chip.className = 'buy-chip ' + colorKey + (l.id === currentListId ? ' active' : '');
    chip.style.outline = l.id === currentListId
      ? '2px solid ' + getColorVal(colorKey, 'cat')
      : 'none';
    chip.textContent = l.name;
    chip.onclick = () => { App.activeBuyList = l.id; renderScreen('buy'); };
    chip.ondblclick = () => openListMenu(l);
    let lastTap = 0;
    chip.addEventListener('touchend', () => {
      const now = Date.now();
      if (now - lastTap < 300) { openListMenu(l); lastTap = 0; }
      else lastTap = now;
    });
    selector.appendChild(chip);
  });
  const addChip = document.createElement('div');
  addChip.className = 'buy-chip amber';
  addChip.textContent = '＋';
  addChip.onclick = () => openNewListEditor();
  selector.appendChild(addChip);
  wrap.appendChild(selector);

  const row = document.createElement('div');
  row.className = 'buy-input-row';
  row.innerHTML = '<input placeholder="Add item…" id="buy-input"><button id="buy-add">Add</button>';
  wrap.appendChild(row);

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.style.marginTop = '16px';
    empty.innerHTML = '<div class="emoji">🛍️</div><div>Nothing on this list.<br><b>Add something above.</b></div>';
    wrap.appendChild(empty);
  } else {
    const list = document.createElement('div');
    list.className = 'buy-list';
    items.forEach(item => {
      const r = document.createElement('div');
      r.className = 'gitem' + (item.checked ? ' paid' : '');
      r.innerHTML =
        '<div class="gcheck' + (item.checked ? ' on' : '') + '">' + (item.checked ? '✓' : '') + '</div>' +
        '<div class="gname">' + esc(item.name) + '</div>';
      r.querySelector('.gcheck').onclick = (ev) => { ev.stopPropagation(); toggleBuy(item); };
      list.appendChild(r);
    });
    wrap.appendChild(list);

    const clearRow = document.createElement('div');
    clearRow.className = 'clear-row';
    clearRow.innerHTML =
      '<button class="clear-btn" id="buy-clear-checked">Clear checked</button>' +
      '<button class="clear-btn primary" id="buy-clear-all">Clear all</button>';
    wrap.appendChild(clearRow);
  }

  setTimeout(() => {
    const inp = document.getElementById('buy-input');
    const addBtn = document.getElementById('buy-add');
    if (addBtn && inp) {
      const add = async () => {
        const v = inp.value.trim();
        if (!v) return;
        inp.value = '';
        await FB.addDoc(buyCol(), {
          name: v, checked: false, listId: currentListId,
          createdAt: new Date().toISOString(), checkedAt: null,
        });
      };
      addBtn.onclick = add;
      inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') add(); });
    }
    const cc = document.getElementById('buy-clear-checked');
    if (cc) cc.onclick = async () => {
      for (const x of items.filter(x => x.checked)) await FB.deleteDoc(FB.doc(buyCol(), x.id));
    };
    const ca = document.getElementById('buy-clear-all');
    if (ca) ca.onclick = async () => {
      if (!confirm('Clear this list?')) return;
      for (const x of items) await FB.deleteDoc(FB.doc(buyCol(), x.id));
    };
  }, 0);
  return wrap;
};

/* Read a computed CSS variable from a color class without a hidden probe */
function getColorVal(colorKey, variant) {
  const el = document.createElement('div');
  el.className = 'c-' + colorKey;
  el.style.display = 'none';
  document.body.appendChild(el);
  const cs = getComputedStyle(el);
  const val = variant === 'soft' ? cs.getPropertyValue('--cat-soft').trim()
                                  : cs.getPropertyValue('--cat').trim();
  document.body.removeChild(el);
  return val || '';
}

function openNewListEditor() {
  openSheet((body, footer) => {
    body.innerHTML = '<h3>New List</h3>';
    const f = document.createElement('div');
    f.className = 'field';
    f.innerHTML = '<label>List Name</label><input id="nl-name" placeholder="e.g. Hardware">';
    body.appendChild(f);
    let chosenColor = 'blue';
    const colorF = document.createElement('div');
    colorF.className = 'field c-blue';
    colorF.style.cursor = 'pointer';
    colorF.innerHTML = '<label>Color</label><div class="color-swatch"></div>';
    body.appendChild(colorF);
    colorF.onclick = () => {
      openColorPicker(chosenColor, (key) => {
        chosenColor = key;
        colorF.className = 'field c-' + key;
      });
    };
    footer.innerHTML = '';
    const btn = document.createElement('button');
    btn.className = 'primary';
    btn.textContent = 'Create List';
    btn.onclick = async () => {
      const name = document.getElementById('nl-name').value.trim();
      if (!name) return;
      const lists = (App.settings.buyLists || []).slice();
      const newList = { id: 'list_' + Date.now(), name, colorKey: chosenColor };
      lists.push(newList);
      await FB.updateDoc(budgetDoc(), { buyLists: lists });
      App.activeBuyList = newList.id;
      closeSheet();
    };
    footer.appendChild(btn);
  });
}
function openListMenu(l) {
  openSheet((body, footer) => {
    body.innerHTML = '<h3>' + esc(l.name) + '</h3>';
    const nameF = document.createElement('div');
    nameF.className = 'field';
    nameF.innerHTML = '<label>Name</label><input id="lm-name" value="' + esc(l.name) + '">';
    body.appendChild(nameF);
    let chosenColor = l.colorKey || 'blue';
    const colorF = document.createElement('div');
    colorF.className = 'field c-' + chosenColor;
    colorF.style.cursor = 'pointer';
    colorF.innerHTML = '<label>Color</label><div class="color-swatch"></div>';
    body.appendChild(colorF);
    colorF.onclick = () => {
      openColorPicker(chosenColor, (key) => {
        chosenColor = key;
        colorF.className = 'field c-' + key;
      });
    };

    footer.innerHTML = '';
    const save = document.createElement('button');
    save.className = 'primary';
    save.textContent = 'Save';
    save.onclick = async () => {
      const newName = document.getElementById('lm-name').value.trim();
      if (!newName) return;
      const lists = App.settings.buyLists.map(x => x.id === l.id ? { ...x, name: newName, colorKey: chosenColor } : x);
      await FB.updateDoc(budgetDoc(), { buyLists: lists });
      closeSheet();
    };
    footer.appendChild(save);

    if (l.id !== 'default') {
      const del = document.createElement('button');
      del.className = 'danger';
      del.textContent = 'Delete List & Items';
      del.onclick = async () => {
        if (!confirm('Delete list and all its items?')) return;
        for (const x of App.buy.filter(x => x.listId === l.id)) await FB.deleteDoc(FB.doc(buyCol(), x.id));
        const lists = App.settings.buyLists.filter(x => x.id !== l.id);
        await FB.updateDoc(budgetDoc(), { buyLists: lists });
        if (App.activeBuyList === l.id) App.activeBuyList = 'default';
        closeSheet();
      };
      footer.appendChild(del);
    }
  });
}

function toggleBuy(item) {
  FB.updateDoc(FB.doc(buyCol(), item.id), {
    checked: !item.checked,
    checkedAt: !item.checked ? new Date().toISOString() : null,
  });
}

/* ---------- TO PAY ---------- */
ScreenRenderers.topay = function () {
  const items = App.toPay.slice();
  const sortKey = (x) => { if (x.paid) return 3; if (x.dueDate) return 1; return 2; };
  items.sort((a, b) => {
    const ka = sortKey(a), kb = sortKey(b);
    if (ka !== kb) return ka - kb;
    if (ka === 1) return daysUntil(a.dueDate) - daysUntil(b.dueDate);
    if (ka === 3) return new Date(b.paidDate || 0) - new Date(a.paidDate || 0);
    return 0;
  });

  const unpaidCount = items.filter(x => !x.paid).length;
  const unpaidTotal = items.filter(x => !x.paid && x.amount != null).reduce((a, x) => a + Number(x.amount || 0), 0);

  const wrap = document.createElement('div');
  wrap.appendChild(makeAppHead('Persistent list,', 'To Pay'));

  const sum = document.createElement('div');
  sum.className = 'summary';
  sum.innerHTML =
    '<div class="summary-cells">' +
      '<div><div class="k">Unpaid</div><div class="v red">' + unpaidCount + '</div></div>' +
      '<div><div class="k">Total</div><div class="v">' + fmtAmount(unpaidTotal) + '</div></div>' +
    '</div>';
  wrap.appendChild(sum);

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.style.marginTop = '16px';
    empty.innerHTML = '<div class="emoji">✅</div><div>Nothing to pay.<br><b>Tap ＋ to add one.</b></div>';
    wrap.appendChild(empty);
  } else {
    const list = document.createElement('div');
    list.className = 'pay-list';
    items.forEach(item => {
      const d = item.dueDate ? daysUntil(item.dueDate) : null;
      let metaTxt = '', metaCls = 'pmeta';
      if (item.paid) { metaTxt = 'Paid ' + fmtDate(item.paidDate); metaCls = 'pmeta done'; }
      else if (d === null) metaTxt = 'No due date';
      else if (d < 0) { metaTxt = 'Overdue by ' + (-d) + ' day' + (d === -1 ? '' : 's'); metaCls = 'pmeta due'; }
      else if (d === 0) { metaTxt = 'Due today'; metaCls = 'pmeta due'; }
      else if (d <= 3) { metaTxt = 'Due ' + fmtDate(item.dueDate) + ' · ' + d + ' day' + (d === 1 ? '' : 's'); metaCls = 'pmeta due'; }
      else { metaTxt = 'Due ' + fmtDate(item.dueDate) + ' · ' + d + ' days'; metaCls = 'pmeta'; }

      if (item.isRepeat && item.repeatUntil) metaTxt += ' · until ' + fmtDate(item.repeatUntil);

      const amountHtml = item.amount == null ? '<div class="pamt" style="color:var(--text3);font-size:13px">—</div>' : '<div class="pamt">' + fmtAmount(item.amount) + '</div>';
      const subTag = item.isSubscription ? '<span class="pill-sub">SUB</span>' : '';
      const repTag = item.isRepeat ? '<span class="pill-rep">REP</span>' : '';
      const debtTag = item.isDebt ? '<span class="pill-debt">DEBT</span>' : '';

      let tagHtml = '';
      const tagUids = item.tagUids || [];
      if (tagUids.length > 0) {
        const meUid = App.user.uid;
        const sortedUids = tagUids.slice().sort((a, b) => {
          if (a === meUid) return 1;
          if (b === meUid) return -1;
          return 0;
        });
        const avatars = sortedUids.map(u => getAvatarHtml(u)).join('');
        tagHtml = `<div class="tag-avs">${avatars}</div>`;
      }

      const r = document.createElement('div');
      r.className = 'prow' + (item.paid ? ' paid' : '');
      r.innerHTML =
        '<div class="pcheck' + (item.paid ? ' on' : '') + '">' + (item.paid ? '✓' : '') + '</div>' +
        '<div class="pbody"><div class="pname">' + esc(item.name) + ' ' + subTag + repTag + debtTag + '</div>' +
        '<div class="' + metaCls + '">' + esc(metaTxt) + '</div></div>' + tagHtml + amountHtml;

      r.querySelector('.pcheck').onclick = (ev) => { ev.stopPropagation(); togglePaid(item); };
      r.onclick = () => openToPayEditor(item);
      list.appendChild(r);
    });
    wrap.appendChild(list);
  }
  return wrap;
};

function togglePaid(item) {
  FB.updateDoc(FB.doc(toPayCol(), item.id), {
    paid: !item.paid,
    paidDate: !item.paid ? new Date().toISOString() : null,
  });
}

/* ---------- HISTORY ---------- */
ScreenRenderers.history = function () {
  const s = App.settings || DEFAULT_SETTINGS;
  const us = App.userSettings || DEFAULT_USER_SETTINGS;
  const period = computeCurrentPeriod(s.periodStartDay);
  if (!App.historyYear) App.historyYear = String(period.year);
  const currentYear = App.historyYear;

  const years = Array.from(new Set(App.history.map(x => String(x.periodKey).slice(0, 4))));
  if (!years.includes(currentYear)) years.push(currentYear);
  years.sort();

  const rows = App.history
    .filter(x => String(x.periodKey).slice(0, 4) === currentYear)
    .sort((a, b) => b.periodKey.localeCompare(a.periodKey));

  const wrap = document.createElement('div');
  wrap.appendChild(makeAppHead('Past periods,', 'History'));

  const prevEnabled = years.includes(String(Number(currentYear) - 1));
  const nextEnabled = years.includes(String(Number(currentYear) + 1));

  const yearDiv = document.createElement('div');
  yearDiv.className = 'year';
  yearDiv.innerHTML =
    '<div class="arr ' + (prevEnabled ? '' : 'disabled') + '" id="hist-prev">‹</div>' +
    '<div class="y">' + currentYear + '</div>' +
    '<div class="arr ' + (nextEnabled ? '' : 'disabled') + '" id="hist-next">›</div>';
  wrap.appendChild(yearDiv);

  if (!rows.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.innerHTML = '<div class="emoji">📅</div><div>No periods yet in ' + currentYear + '.<br><b>Check back after a few months.</b></div>';
    wrap.appendChild(empty);
  } else {
    const showSaved = us.salary > 0 && us.trackSavings;
    rows.forEach(r => {
      const budget = Number(r.budgetSnapshot) || 0;
      const spent  = Number(r.totalSpent) || 0;
      const over   = spent > budget;
      const pct    = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;

      let myShare = 0;
      if (showSaved) myShare = calculateMyShareForPeriod(r.periodKey, budget, us, spent);
      const mySaved = us.salary - myShare;

      const card = document.createElement('div');
      card.className = 'hcard';
      card.innerHTML =
        '<div class="row1"><span class="period">' + esc(r.periodLabel) + '</span>' +
        '<span class="pill ' + (over ? 'red' : 'green') + '">' + (over ? 'Over' : 'Within') + '</span></div>' +
        '<div class="row2">' +
          '<div class="cell"><div class="k">Budget</div><div class="v">' + fmtAmount(budget) + '</div></div>' +
          '<div class="cell"><div class="k">Total Expenses</div><div class="v' + (over ? ' over' : '') + '">' + fmtAmount(spent) + '</div></div>' +
          (showSaved ?
            '<div class="cell"><div class="k">My Share</div><div class="v">' + fmtAmount(myShare) + '</div></div>' +
            '<div class="cell"><div class="k">Saved</div><div class="v ' + (mySaved >= 0 ? 'saved' : 'deficit') + '">' + fmtAmount(mySaved) + '</div></div>'
            : '') +
        '</div>' +
        '<div class="bar"><div class="' + (over ? 'over' : 'ok') + '" style="width:' + pct + '%"></div></div>';

      const delBtn = document.createElement('button');
      delBtn.className = 'delete-btn';
      delBtn.textContent = '×';
      delBtn.onclick = (e) => {
        e.stopPropagation();
        if (!confirm('Delete the record for "' + r.periodLabel + '"?\n\nThis cannot be undone.')) return;
        FB.deleteDoc(FB.doc(historyCol(), r.id)).then(() => toast('History entry deleted'));
      };
      card.appendChild(delBtn);
      wrap.appendChild(card);
    });
  }

  setTimeout(() => {
    const prev = document.getElementById('hist-prev');
    const next = document.getElementById('hist-next');
    if (prev && !prev.classList.contains('disabled'))
      prev.onclick = () => { App.historyYear = String(Number(App.historyYear) - 1); renderScreen('history'); };
    if (next && !next.classList.contains('disabled'))
      next.onclick = () => { App.historyYear = String(Number(App.historyYear) + 1); renderScreen('history'); };
  }, 0);
  return wrap;
};

/* Compute how much "my share" was for a period.
   Divide-by-zero guard: if totalBudget is 0, treat fixed-return as 0. */
function calculateMyShareForPeriod(periodKey, totalBudget, us, totalSpent) {
  let share = us.budgetMethod === 'pct'
    ? totalBudget * (Number(us.budgetPct) / 100)
    : Number(us.budgetFixed) || 0;
  const periodExpenses = App.toPay.filter(x => !x.paid);
  let myToPay = 0;
  if (us.toPayMethod === 'pct') {
    myToPay = periodExpenses.reduce((a, x) => a + Number(x.amount || 0), 0) * (Number(us.toPayPct) / 100);
  } else {
    myToPay = Number(us.toPayFixed) || 0;
  }
  const leftover = totalBudget - totalSpent;
  const returnPct = us.budgetMethod === 'pct'
    ? (Number(us.budgetPct) / 100)
    : (totalBudget > 0 ? (Number(us.budgetFixed) || 0) / totalBudget : 0);
  const myReturn = leftover * returnPct;
  return share + myToPay - myReturn;
}

/* Compute per-member share for a past period from each member's own settings.
   Used by Saved screen to show real split — not the placeholder 60/40. */
function computeMemberSplits(periodRow) {
  const s = App.settings || DEFAULT_SETTINGS;
  const members = s.members || {};
  const totalBudget = Number(periodRow.budgetSnapshot) || 0;
  const totalSpent  = Number(periodRow.totalSpent) || 0;
  const leftover = totalBudget - totalSpent;

  const perMember = [];
  Object.entries(members).forEach(([uid, m]) => {
    const us = { ...DEFAULT_USER_SETTINGS, ...m };
    if (!us.salary) return; // skip members without salary set — can't split meaningfully
    const myShare = calculateMyShareForPeriod(periodRow.periodKey, totalBudget, us, totalSpent);
    const saved = (Number(us.salary) || 0) - myShare;
    perMember.push({ uid, saved, share: myShare });
  });

  // Fallback: if no members have salary set, split by total budget minus spend
  if (perMember.length === 0) {
    const fallbackSaved = leftover;
    const memberList = Object.keys(members);
    memberList.forEach((uid, i) => {
      perMember.push({ uid, saved: Math.round(fallbackSaved / memberList.length), share: 0 });
    });
  }
  return perMember;
}

/* ---------- SAVED ---------- */
ScreenRenderers.saved = function () {
  const s = App.settings || DEFAULT_SETTINGS;
  const period = computeCurrentPeriod(s.periodStartDay);
  const lastPeriod = computePreviousPeriod(period);

  // Total saved = sum of per-member real savings across all history
  let totalSaved = 0;
  let hasTrackedSavings = false;
  App.history.forEach(h => {
    const splits = computeMemberSplits(h);
    if (splits.some(x => x.saved !== 0)) hasTrackedSavings = true;
    totalSaved += splits.reduce((a, x) => a + x.saved, 0);
  });
  // Fallback if no per-member data yet — use budget − spend
  if (!hasTrackedSavings) {
    totalSaved = App.history.reduce((acc, h) => acc + (Number(h.budgetSnapshot) - Number(h.totalSpent)), 0);
  }

  const lastMonthRow = App.history.find(h => h.periodKey === lastPeriod.key);
  let lastMonthSaved = 0;
  if (lastMonthRow) {
    const splits = computeMemberSplits(lastMonthRow);
    lastMonthSaved = splits.reduce((a, x) => a + x.saved, 0);
    if (!splits.some(x => x.saved !== 0)) {
      lastMonthSaved = (Number(lastMonthRow.budgetSnapshot) - Number(lastMonthRow.totalSpent));
    }
  }
  const lastMonthLabel = MONTHS_LONG[parseLocalDate(lastPeriod.key + "-01").getMonth()];

  const wrap = document.createElement('div');
  wrap.appendChild(makeAppHead('Combined wealth,', 'Saved'));

  const hero = document.createElement('div');
  hero.className = 'hero-saved';
  hero.innerHTML =
    '<div class="inner">' +
      '<div class="lbl">Total Household Savings</div>' +
      '<div class="amt">' + fmtAmount(totalSaved) + '<span class="cur">' + esc(s.currency) + '</span></div>' +
      '<div class="hero-last-month">' +
        '<div class="k">' + lastMonthLabel + ' savings</div>' +
        '<div class="v">' + fmtAmount(lastMonthSaved) + '</div>' +
      '</div>' +
    '</div>';
  wrap.appendChild(hero);

  const sh = document.createElement('div');
  sh.className = 'secttl';
  sh.innerHTML = '<h2>Savings Goals</h2><a id="goal-new">＋ New Goal</a>';
  wrap.appendChild(sh);

  if (!App.goals.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.innerHTML = '<div class="emoji">🎯</div><div>No goals yet.<br><b>Create one to start saving.</b></div>';
    wrap.appendChild(empty);
  } else {
    const myUid = App.user?.uid;
    App.goals.forEach(g => {
      const pct = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
      const el = document.createElement('div');
      el.className = 'goal-card';
      el.style.setProperty('--accent', 'var(--cat-' + (g.colorKey || 'green') + ')');

      let tagHtml = '';
      const tagUids = g.tagUids || [];
      if (tagUids.length > 0) {
        const sortedUids = tagUids.slice().sort((a, b) => {
          if (a === myUid) return 1;
          if (b === myUid) return -1;
          return 0;
        });
        tagHtml = `<span class="tag-avs">${sortedUids.map(u => getAvatarHtml(u, '24px')).join('')}</span>`;
      }

      el.innerHTML =
        '<div class="goal-top">' +
          '<div class="goal-name">' + esc(g.icon || '🎯') + ' ' + esc(g.name) + ' ' + tagHtml + ' <span class="chev">›</span></div>' +
          '<div class="goal-badge">' + (pct >= 100 ? 'Reached' : 'On Track') + '</div>' +
        '</div>' +
        '<div class="goal-nums"><span><b>' + fmtAmount(g.current) + '</b> / ' + fmtAmount(g.target) + '</span><span>' + pct + '%</span></div>' +
        '<div class="goal-bar"><div style="width:' + pct + '%"></div></div>' +
        '<div class="goal-foot">' +
          '<span class="auto-pill">Auto: ' + fmtAmount(g.autoAmount || 0) + ' / mo</span>' +
          '<span>' + fmtAmount(Math.max(0, g.target - g.current)) + ' to go</span>' +
        '</div>';
      el.onclick = () => openGoalSheet(g);
      wrap.appendChild(el);
    });
  }

  const histTitle = document.createElement('div');
  histTitle.className = 'secttl';
  histTitle.innerHTML = '<h2>Monthly History</h2>';
  wrap.appendChild(histTitle);

  App.history.slice(0, 3).forEach(r => {
    const splits = computeMemberSplits(r);
    const totalRowSaved = splits.reduce((a, x) => a + x.saved, 0) || (Number(r.budgetSnapshot) - Number(r.totalSpent));

    // Order: other member first (left), me (right) — matches mockup
    const sorted = splits.slice().sort((a, b) => {
      if (a.uid === App.user.uid) return 1;
      if (b.uid === App.user.uid) return -1;
      return 0;
    });

    const leftHtml = sorted.length > 0
      ? `<div class="p">${getAvatarHtml(sorted[0].uid, '24px')} ${fmtAmount(sorted[0].saved)}</div>`
      : '';
    const rightHtml = sorted.length > 1
      ? `<div class="p right">${fmtAmount(sorted[1].saved)} ${getAvatarHtml(sorted[1].uid, '24px')}</div>`
      : '';

    const hc = document.createElement('div');
    hc.className = 'hcard';
    hc.innerHTML =
      '<div class="row1"><span class="period">' + esc(r.periodLabel) + '</span><span class="pill green">Total Saved: ' + fmtAmount(totalRowSaved) + '</span></div>' +
      `<div class="hist-split-row">${leftHtml}${rightHtml}</div>`;
    wrap.appendChild(hc);
  });

  setTimeout(() => {
    const btn = document.getElementById('goal-new');
    if (btn) btn.onclick = () => openGoalEditor();
  }, 0);
  return wrap;
};