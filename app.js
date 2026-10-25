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
  members: {}, owners: [], bannedUids: [], lastResetKey: null,
  pillColors: { sub: 'blue', rep: 'purple', debt: 'red' },
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
      if ((App.settings.bannedUids || []).includes(App.user.uid)) {
        toast('You have been removed from this household.');
        await FB.signOut(FB.auth);
        return;
      }
      const updates = {};
      if (!App.settings.buyLists) updates.buyLists = DEFAULT_SETTINGS.buyLists;
      if (!App.settings.owners) updates.owners = [App.user.uid];
      if (!App.settings.bannedUids) updates.bannedUids = [];
      if (!App.settings.pillColors) updates.pillColors = DEFAULT_SETTINGS.pillColors;
      if (App.settings.pillColors && App.settings.pillColors.pin) {
        const pc = { ...App.settings.pillColors };
        delete pc.pin;
        updates.pillColors = pc;
      }
      if (Object.keys(updates).length) {
        await FB.updateDoc(budgetDoc(), updates);
        Object.assign(App.settings, updates);
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
  cleanupOldExpenses();
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
      if ((App.settings.bannedUids || []).includes(App.user.uid)) {
        toast('You have been removed.');
        FB.signOut(FB.auth);
        return;
      }
      if (!App.settings.buyLists) App.settings.buyLists = DEFAULT_SETTINGS.buyLists;
      if (App.user && App.settings.members && App.settings.members[App.user.uid]) {
        App.userSettings = { ...DEFAULT_USER_SETTINGS, ...App.settings.members[App.user.uid] };
      } else {
        App.userSettings = DEFAULT_USER_SETTINGS;
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
function applyPillColors() {
  if (!App.settings || !App.settings.pillColors) return;
  const pc = App.settings.pillColors;
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
  ['sub','rep','debt'].forEach(type => {
    const key = pc[type] || 'blue';
    root.style.setProperty('--pill-' + type + '-bg', readColor(key, 'soft'));
    root.style.setProperty('--pill-' + type + '-cl', readColor(key, 'cat'));
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
  return `<div class="av ${grad} ${meClass}" style="width:${size};height:${size};font-size:${parseInt(size)*0.4}px;">${initials}</div>`;
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
    const colorKey = l.colorKey || 'blue';
    chip.className = 'buy-chip ' + colorKey + (l.id === currentListId ? ' active' : '');
    if (l.id === currentListId) {
      chip.style.outline = '2px solid var(--blue)';
    }
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
  addChip.className = 'list-chip';
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

function openNewListEditor() {
  openSheet((body, footer) => {
    body.innerHTML = '<h3>New List</h3>';
    const f = document.createElement('div');
    f.className = 'field';
    f.innerHTML = '<label>List Name</label><input id="nl-name" placeholder="e.g. Hardware">';
    body.appendChild(f);
    const c = document.createElement('div');
    c.className = 'field';
    c.innerHTML = '<label>Color</label><div class="swatch c-blue" id="nl-swatch"></div>';
    body.appendChild(c);
    let chosenColor = 'blue';
    c.onclick = () => {
      openColorPicker(chosenColor, (key) => {
        chosenColor = key;
        document.getElementById('nl-swatch').className = 'swatch c-' + key;
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
    colorF.className = 'field';
    colorF.innerHTML = '<label>Color</label><div class="swatch c-' + chosenColor + '" id="lm-swatch"></div>';
    body.appendChild(colorF);
    colorF.onclick = () => {
      openColorPicker(chosenColor, (key) => {
        chosenColor = key;
        document.getElementById('lm-swatch').className = 'swatch c-' + key;
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
        if (!confirm('Are you absolutely sure?\n\nThis will permanently remove the history entry for this month.')) return;
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
  const myReturn = leftover * (us.budgetMethod === 'pct'
    ? (Number(us.budgetPct)/100)
    : (Number(us.budgetFixed)/totalBudget || 0));
  return share + myToPay - myReturn;
}

ScreenRenderers.saved = function () {
  const s = App.settings || DEFAULT_SETTINGS;
  const period = computeCurrentPeriod(s.periodStartDay);
  const lastPeriod = computePreviousPeriod(period);
  
  const totalSaved = App.history.reduce((acc, h) => acc + (Number(h.budgetSnapshot) - Number(h.totalSpent)), 0); 
  const lastMonthRow = App.history.find(h => h.periodKey === lastPeriod.key);
  let lastMonthSaved = lastMonthRow ? (Number(lastMonthRow.budgetSnapshot) - Number(lastMonthRow.totalSpent)) : 0;
  let lastMonthLabel = MONTHS_LONG[parseLocalDate(lastPeriod.key + "-01").getMonth()];

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
    App.goals.forEach(g => {
      const pct = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
      const el = document.createElement('div');
      el.className = 'goal-card';
      el.style.setProperty('--accent', 'var(--cat-' + (g.colorKey || 'green') + ')');

      let tagHtml = '';
      const tagUids = g.tagUids || [];
      if (tagUids.length > 0) {
        const meUid = App.user.uid;
        const sortedUids = tagUids.slice().sort((a, b) => {
          if (a === meUid) return 1;
          if (b === meUid) return -1;
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

  const members = Object.keys(App.settings?.members || {});
  const otherUid = members.find(uid => uid !== App.user.uid);

  App.history.slice(0, 3).forEach(r => {
    const b = Number(r.budgetSnapshot) || 0;
    const spent = Number(r.totalSpent) || 0;
    const saved = b - spent;
    const partnerSaved = Math.round(saved * 0.6);
    const mySaved = Math.round(saved * 0.4);

    const hc = document.createElement('div');
    hc.className = 'hcard';
    hc.innerHTML = 
      '<div class="row1"><span class="period">' + esc(r.periodLabel) + '</span><span class="pill green">Total Saved: ' + fmtAmount(saved) + '</span></div>' +
      `<div class="hist-split-row">` +
        `<div class="p">${getAvatarHtml(otherUid, '24px')} ${fmtAmount(partnerSaved)}</div>` +
        `<div class="p right">${fmtAmount(mySaved)} ${getAvatarHtml(App.user.uid, '24px')}</div>` +
      `</div>`;
    wrap.appendChild(hc);
  });

  setTimeout(() => {
    const btn = document.getElementById('goal-new');
    if (btn) btn.onclick = () => openGoalEditor();
  }, 0);
  return wrap;
};

ScreenRenderers.settings = function () {
  const s = App.settings || DEFAULT_SETTINGS;
  const us = App.userSettings || DEFAULT_USER_SETTINGS;
  const members = s.members || {};
  const myMember = (App.user && members[App.user.uid]) || {};
  const mySalary = Number(us.salary) || 0;
  const salaryOk = mySalary > 0;

  const wrap = document.createElement('div');
  wrap.appendChild(makeAppHead('Tune things,', 'Settings'));

  wrap.appendChild(sectionTitle('Profile'));
  const pg = group();
  const arow = document.createElement('div');
  arow.className = 'avatar-row';
  const avatarHtml = myMember.avatarBase64
    ? '<div class="big-avatar" style="background-image:url(' + myMember.avatarBase64 + ');"></div>'
    : '<div class="big-avatar">' + esc(myMember.initial || 'U') + '</div>';
  arow.innerHTML =
    avatarHtml +
    '<div class="info">' +
      '<div class="t">' + esc(myMember.name || 'My Profile') + '</div>' +
      '<div class="s">Tap to change name & avatar</div>' +
    '</div>' +
    '<span class="chev">›</span>';
  arow.onclick = () => openProfileEditor();
  pg.appendChild(arow);
  wrap.appendChild(pg);

  wrap.appendChild(sectionTitle('General'));
  const gg = group();
  gg.appendChild(rowInput('Total budget', 'set-totalbudget', s.totalBudget || 0));
  gg.appendChild(rowInput('Period start day', 'set-startday', s.periodStartDay || 25));
  wrap.appendChild(gg);

  wrap.appendChild(sectionTitle('My Finances'));
  const mg = group();
  mg.appendChild(rowInput('My Salary', 'set-salary', us.salary || 0));

  const budgetStack = document.createElement('div');
  budgetStack.className = 'stack-row' + (!salaryOk ? ' disabled' : '');
  budgetStack.innerHTML = '<span class="lbl">My Budget Contribution' +
    (!salaryOk ? ' <span style="color:var(--red);font-size:11px;font-weight:600;margin-left:6px;">Enter salary first</span>' : '') + '</span>';
  const budgetSegWrap = document.createElement('div');
  budgetSegWrap.className = 'segmented-wrap';
  budgetSegWrap.innerHTML = '<div class="segmented" id="budget-method-seg"' +
    (!salaryOk ? ' style="pointer-events:none;"' : '') + '>' +
    '<button data-method="fixed" class="' + (us.budgetMethod !== 'pct' ? 'active' : '') + '">Fixed</button>' +
    '<button data-method="pct" class="' + (us.budgetMethod === 'pct' ? 'active' : '') + '">%</button>' +
    '</div>';
  budgetStack.appendChild(budgetSegWrap);
  const budgetInputLine = document.createElement('div');
  budgetInputLine.className = 'input-line';
  budgetInputLine.innerHTML = '<input id="set-budget-fixed" ' +
    (!salaryOk ? 'disabled' : '') +
    ' value="' + (us.budgetMethod === 'pct' ? (us.budgetPct || 0) : (us.budgetFixed || 0)) + '"><span class="unit">' +
    (us.budgetMethod === 'pct' ? '%' : (s.currency || 'SEK')) + '</span>';
  budgetStack.appendChild(budgetInputLine);
  mg.appendChild(budgetStack);

  const toPayStack = document.createElement('div');
  toPayStack.className = 'stack-row' + (!salaryOk ? ' disabled' : '');
  toPayStack.innerHTML = '<span class="lbl">My To Pay Share' +
    (!salaryOk ? ' <span style="color:var(--red);font-size:11px;font-weight:600;margin-left:6px;">Enter salary first</span>' : '') + '</span>';
  const toPaySegWrap = document.createElement('div');
  toPaySegWrap.className = 'segmented-wrap';
  toPaySegWrap.innerHTML = '<div class="segmented" id="topay-method-seg"' +
    (!salaryOk ? ' style="pointer-events:none;"' : '') + '>' +
    '<button data-method="fixed" class="' + (us.toPayMethod !== 'pct' ? 'active' : '') + '">Fixed</button>' +
    '<button data-method="pct" class="' + (us.toPayMethod === 'pct' ? 'active' : '') + '">%</button>' +
    '</div>';
  toPayStack.appendChild(toPaySegWrap);
  const toPayInputLine = document.createElement('div');
  toPayInputLine.className = 'input-line';
  toPayInputLine.innerHTML = '<input id="set-topay-fixed" ' +
    (!salaryOk ? 'disabled' : '') +
    ' value="' + (us.toPayMethod === 'pct' ? (us.toPayPct || 0) : (us.toPayFixed || 0)) + '"><span class="unit">' +
    (us.toPayMethod === 'pct' ? '%' : (s.currency || 'SEK')) + '</span>';
  toPayStack.appendChild(toPayInputLine);
  mg.appendChild(toPayStack);

  mg.appendChild(rowToggle('Track savings', us.trackSavings, (el) => {
    if (!salaryOk) { toast('Enter salary first'); el.classList.remove('on'); return; }
    updateUserSetting('trackSavings', el.classList.contains('on'));
  }));
  wrap.appendChild(mg);

  wrap.appendChild(sectionTitle('Appearance'));
  const appear = group();
  const themeRow = document.createElement('div');
  themeRow.className = 'row';
  themeRow.style.cursor = 'default';
  themeRow.innerHTML = '<span class="lbl">Theme</span>';
  const seg = document.createElement('div');
  seg.className = 'segmented';
  ['light','dark','system'].forEach(opt => {
    const b = document.createElement('button');
    b.textContent = opt[0].toUpperCase() + opt.slice(1);
    b.dataset.theme = opt;
    if (us.theme === opt) b.className = 'active';
    b.onclick = () => changeTheme(opt);
    seg.appendChild(b);
  });
  themeRow.appendChild(seg);
  appear.appendChild(themeRow);

  const toneRow = document.createElement('div');
  toneRow.className = 'row';
  toneRow.innerHTML = '<span class="lbl">Hero tone</span>' +
    '<div style="width:56px;height:26px;border-radius:8px;background:linear-gradient(160deg,var(--hero-a),var(--hero-b));"></div>';
  toneRow.onclick = () => openTonePicker(us.heroTone || 'forest');
  appear.appendChild(toneRow);

  ['sub','rep','debt'].forEach(type => {
    const label = { sub: 'Subscription Pill', rep: 'Repeat Pill', debt: 'Debt Pill' }[type];
    const row = document.createElement('div');
    row.className = 'row';
    const pc = s.pillColors || {};
    const colorKey = pc[type] || 'blue';
    row.innerHTML = '<span class="lbl">' + label + '</span><div class="swatch c-' + colorKey + '"></div>';
    row.onclick = () => openPillColorPicker(type);
    appear.appendChild(row);
  });

  wrap.appendChild(appear);

  wrap.appendChild(sectionTitle('Reset'));
  const reset = group();
  const topayDayRow = document.createElement('div');
  topayDayRow.className = 'row';
  const dayVal = s.toPayResetDay === 'last' || s.toPayResetDay == null ? 'Last day ›' : s.toPayResetDay + 'th ›';
  topayDayRow.innerHTML = '<span class="lbl">To Pay reset day</span><span class="val">' + esc(dayVal) + '</span>';
  topayDayRow.onclick = () => openResetDayPicker();
  reset.appendChild(topayDayRow);

  const runRow = document.createElement('div');
  runRow.className = 'row';
  runRow.innerHTML = '<span class="lbl" style="color:var(--blue);font-weight:600;">Run To Pay reset now</span><span style="color:var(--text3);">›</span>';
  runRow.onclick = () => confirmRunReset();
  reset.appendChild(runRow);
  wrap.appendChild(reset);

  wrap.appendChild(sectionTitle('Members & Safety'));
  const memberGroup = group();
  const bannedUids = s.bannedUids || [];
  const ownerUids = s.owners || [];
  Object.entries(members).forEach(([uid, m]) => {
    const row = document.createElement('div');
    row.className = 'row';
    const isOwner = ownerUids.includes(uid);
    const isBanned = bannedUids.includes(uid);
    const isMe = uid === App.user.uid;
    row.innerHTML = '<span class="lbl">' + esc(m.name || m.email || uid) + (isOwner ? ' · Owner' : '') + (isMe ? ' (you)' : '') + '</span>' +
      (isBanned ? '<span class="val" style="color:var(--red);">Banned</span>' :
        isOwner ? '<span class="val">Protected</span>' :
        '<span class="val" style="color:var(--red);font-weight:600;">Ban ›</span>');
    if (!isOwner && !isBanned && !isMe) {
      row.onclick = () => confirmBanMember(uid, m);
    }
    memberGroup.appendChild(row);
  });
  if (bannedUids.length > 0) {
    const clearRow = document.createElement('div');
    clearRow.className = 'row';
    clearRow.innerHTML = '<span class="lbl" style="color:var(--blue);font-weight:600;">Clear Banned List (' + bannedUids.length + ')</span>';
    clearRow.onclick = () => confirmClearBanned();
    memberGroup.appendChild(clearRow);
  }
  wrap.appendChild(memberGroup);

  wrap.appendChild(sectionTitle('Account'));
  const acct = group();
  const emailRow = document.createElement('div');
  emailRow.className = 'row';
  emailRow.innerHTML = '<span class="lbl">Email Address</span><span class="val">' + esc(App.user?.email || '—') + '</span>';
  emailRow.onclick = () => changeEmail();
  acct.appendChild(emailRow);
  
  const exportRow = document.createElement('div');
  exportRow.className = 'row';
  exportRow.innerHTML = '<span class="lbl" style="color:var(--blue);font-weight:600;">Export Data (Backup)</span>';
  exportRow.onclick = () => exportData();
  acct.appendChild(exportRow);

  const importRow = document.createElement('div');
  importRow.className = 'row';
  importRow.innerHTML = '<span class="lbl" style="color:var(--blue);font-weight:600;">Import Data (Restore)</span>';
  importRow.onclick = () => importData();
  acct.appendChild(importRow);
  
  wrap.appendChild(acct);

  wrap.appendChild(sectionTitle('Danger Zone'));
  const dz = group();
  const resetRow = document.createElement('div');
  resetRow.className = 'row';
  resetRow.innerHTML = '<span class="lbl" style="color:var(--red);font-weight:600;">Hard Reset App</span>';
  resetRow.onclick = () => confirmHardReset();
  dz.appendChild(resetRow);
  wrap.appendChild(dz);

  const signOutBtn = document.createElement('button');
  signOutBtn.className = 'danger-pill';
  signOutBtn.textContent = 'Sign out';
  signOutBtn.onclick = () => { if (confirm('Sign out?')) FB.signOut(FB.auth); };
  wrap.appendChild(signOutBtn);
  wrap.appendChild(h('div', { style: 'height:40px;' }));

  setTimeout(() => {
    const budgetSeg = document.getElementById('budget-method-seg');
    if (budgetSeg) budgetSeg.querySelectorAll('[data-method]').forEach(b => {
      b.onclick = () => {
        if (!salaryOk) { toast('Enter salary first'); return; }
        const newMethod = b.dataset.method;
        if (newMethod !== us.budgetMethod) {
          if (newMethod === 'pct') {
            const total = Number(s.totalBudget) || 0;
            const fixed = Number(us.budgetFixed) || 0;
            updateUserSetting('budgetPct', total > 0 ? Math.round((fixed / total) * 100) : 0);
          } else {
            const total = Number(s.totalBudget) || 0;
            const pct = Number(us.budgetPct) || 0;
            updateUserSetting('budgetFixed', Math.round(total * pct / 100));
          }
          updateUserSetting('budgetMethod', newMethod);
        }
      };
    });
    const toPaySeg = document.getElementById('topay-method-seg');
    if (toPaySeg) toPaySeg.querySelectorAll('[data-method]').forEach(b => {
      b.onclick = () => {
        if (!salaryOk) { toast('Enter salary first'); return; }
        const newMethod = b.dataset.method;
        if (newMethod !== us.toPayMethod) {
          if (newMethod === 'pct') {
            const total = Number(s.totalBudget) || 0;
            const fixed = Number(us.toPayFixed) || 0;
            updateUserSetting('toPayPct', total > 0 ? Math.round((fixed / total) * 100) : 0);
          } else {
            const total = Number(s.totalBudget) || 0;
            const pct = Number(us.toPayPct) || 0;
            updateUserSetting('toPayFixed', Math.round(total * pct / 100));
          }
          updateUserSetting('toPayMethod', newMethod);
        }
      };
    });
    bindInput('set-totalbudget', v => saveSetting('totalBudget', Number(v) || 0));
    bindInput('set-startday', v => {
      const n = parseInt(v, 10);
      if (!isNaN(n) && n >= 1 && n <= 31) saveSetting('periodStartDay', n);
    });
    bindInput('set-salary', v => updateUserSetting('salary', Number(v) || 0));
    bindInput('set-budget-fixed', v => {
      if (!salaryOk) { toast('Enter salary first'); return; }
      if (us.budgetMethod === 'pct') updateUserSetting('budgetPct', Number(v) || 0);
      else updateUserSetting('budgetFixed', Number(v) || 0);
    });
    bindInput('set-topay-fixed', v => {
      if (!salaryOk) { toast('Enter salary first'); return; }
      if (us.toPayMethod === 'pct') updateUserSetting('toPayPct', Number(v) || 0);
      else updateUserSetting('toPayFixed', Number(v) || 0);
    });
  }, 0);
  return wrap;
};

function sectionTitle(text, count) {
  const el = document.createElement('div');
  el.className = 'secttl';
  el.innerHTML = esc(text) + (count ? ' <span class="count">' + esc(count) + '</span>' : '');
  return el;
}
function group() { const g = document.createElement('div'); g.className = 'group'; return g; }
function rowInput(label, id, value) {
  const r = document.createElement('div');
  r.className = 'row';
  r.innerHTML = '<span class="lbl">' + esc(label) + '</span>' +
    '<input class="field" id="' + id + '" value="' + esc(value) + '">';
  return r;
}
function rowToggle(label, isOn, onClick) {
  const r = document.createElement('div');
  r.className = 'row';
  r.innerHTML = '<span class="lbl">' + esc(label) + '</span>' +
    '<div class="pin-toggle' + (isOn ? ' on' : '') + '"></div>';
  r.onclick = () => {
    const el = r.querySelector('.pin-toggle');
    el.classList.toggle('on');
    onClick(el);
  };
  return r;
}
function bindInput(id, onCommit) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('blur', () => onCommit(el.value));
  el.addEventListener('keydown', ev => { if (ev.key === 'Enter') el.blur(); });
}
function saveSetting(key, value) { FB.updateDoc(budgetDoc(), { [key]: value }); }
function updateUserSetting(key, value) {
  if (!App.user) return;
  FB.updateDoc(budgetDoc(), { ['members.' + App.user.uid + '.' + key]: value });
}
function changeTheme(theme) {
  updateUserSetting('theme', theme);
  document.body.setAttribute('data-theme', theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme);
  document.querySelectorAll('.segmented button').forEach(b => {
    b.classList.toggle('active', b.dataset.theme === theme);
  });
}

function confirmBanMember(uid, m) {
  const name = m.name || m.email || uid;
  if (!confirm('Ban "' + name + '"?\n\nThey will be signed out on their next app load and blocked from returning.')) return;
  const s = App.settings || DEFAULT_SETTINGS;
  const ownerUids = s.owners || [];
  if (ownerUids.includes(uid)) { toast('Cannot ban an owner'); return; }
  const bannedUids = (s.bannedUids || []).slice();
  if (!bannedUids.includes(uid)) bannedUids.push(uid);
  FB.updateDoc(budgetDoc(), { bannedUids }).then(() => toast(name + ' has been banned'));
}
function confirmClearBanned() {
  const s = App.settings || DEFAULT_SETTINGS;
  const bannedUids = s.bannedUids || [];
  if (bannedUids.length === 0) return;
  if (!confirm('Clear the banned list?\n\n' + bannedUids.length + ' user(s) will be able to sign in again.')) return;
  if (!confirm('Are you sure? They will regain access to the shared budget.')) return;
  FB.updateDoc(budgetDoc(), { bannedUids: [] }).then(() => toast('Banned list cleared'));
}

function openProfileEditor() {
  const s = App.settings || DEFAULT_SETTINGS;
  const members = s.members || {};
  const myMember = (App.user && members[App.user.uid]) || {};

  openSheet((body, footer) => {
    body.innerHTML = '<h3>Edit Profile</h3>';
    const nameF = document.createElement('div');
    nameF.className = 'field';
    nameF.innerHTML = '<label>Name</label><input id="prof-name" value="' + esc(myMember.name || '') + '" placeholder="Your name">';
    body.appendChild(nameF);

    const preview = document.createElement('div');
    preview.style.cssText = 'display:flex;justify-content:center;padding:16px 0;';
    const av = document.createElement('div');
    av.style.cssText = 'width:96px;height:96px;border-radius:48px;background:linear-gradient(135deg,#7c5cff,#0a84ff);background-size:cover;background-position:center;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:28px;box-shadow:0 6px 20px rgba(10,132,255,.35);';
    if (myMember.avatarBase64) av.style.backgroundImage = 'url(' + myMember.avatarBase64 + ')';
    else av.textContent = myMember.initial || 'U';
    preview.appendChild(av);
    body.appendChild(preview);

    const upload = document.createElement('div');
    upload.className = 'field';
    upload.style.cursor = 'pointer';
    upload.innerHTML = '<span style="font-weight:600;color:var(--blue);">📷 Upload image</span><span style="color:var(--text3);">›</span>';
    upload.onclick = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
          const b64 = await resizeImageToBase64(file, 256);
          await saveAvatar(b64);
          closeSheet();
          toast('Avatar updated');
        } catch (err) { toast('Could not process image'); }
      };
      input.click();
    };
    body.appendChild(upload);

    if (myMember.avatarBase64) {
      const remove = document.createElement('div');
      remove.className = 'field';
      remove.style.cursor = 'pointer';
      remove.innerHTML = '<span style="font-weight:600;color:var(--red);">Remove picture</span><span style="color:var(--text3);">›</span>';
      remove.onclick = async () => { await saveAvatar(null); closeSheet(); toast('Avatar removed'); };
      body.appendChild(remove);
    }

    footer.innerHTML = '';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'primary';
    saveBtn.textContent = 'Save Profile';
    saveBtn.onclick = async () => {
      const newName = document.getElementById('prof-name').value.trim();
      await FB.updateDoc(budgetDoc(), { ['members.' + App.user.uid + '.name']: newName });
      closeSheet();
      toast('Profile updated');
    };
    footer.appendChild(saveBtn);
  });
}

async function saveAvatar(b64) {
  if (!App.user) return;
  try {
    await FB.updateDoc(budgetDoc(), { ['members.' + App.user.uid + '.avatarBase64']: b64 });
  } catch (e) { console.error('save avatar:', e); }
}

function resizeImageToBase64(file, size) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function openGoalEditor() {
  const g = { name: '', icon: '🎯', target: 0, current: 0, autoAmount: 0, targetDate: '', colorKey: 'green', tagUids: [], monthlySplit: {} };
  showGoalSheet(g, true);
}
function openGoalSheet(g) {
  showGoalSheet(g, false);
}

function showGoalSheet(g, isNew) {
  openSheet((body, footer) => {
    body.innerHTML = '';
    
    const heroDiv = document.createElement('div');
    heroDiv.className = 'v4-hero';
    
    const iconEl = document.createElement('div');
    iconEl.className = 'v4-icon';
    iconEl.textContent = g.icon || '🎯';
    iconEl.onclick = () => {
      buildIconPickerInline(g.icon || '🎯', async (emoji) => {
        g.icon = emoji;
        iconEl.textContent = emoji;
        if (!isNew) await FB.updateDoc(FB.doc(goalsCol(), g.id), { icon: emoji });
      });
    };
    heroDiv.appendChild(iconEl);

    const titleInput = document.createElement('input');
    titleInput.className = 'v4-title-input';
    titleInput.value = g.name || 'New Goal';
    titleInput.placeholder = 'Goal Name';
    heroDiv.appendChild(titleInput);

    const amtInput = document.createElement('input');
    amtInput.className = 'v4-amount-input';
    amtInput.value = g.target || '';
    amtInput.placeholder = '0';
    amtInput.inputMode = 'numeric';
    heroDiv.appendChild(amtInput);
    
    body.appendChild(heroDiv);

    const dateRow = document.createElement('div');
    dateRow.className = 'v4-row';
    dateRow.innerHTML = '<label>Target Date (Optional)</label>' +
      '<input id="g-date" type="text" inputmode="numeric" placeholder="DD/MM/YYYY" maxlength="10" value="' + isoToDDMMYYYY(g.targetDate) + '">';
    body.appendChild(dateRow);
    const dInp = dateRow.querySelector('#g-date');
    dInp.addEventListener('input', () => autoSlashDate(dInp));

    const colorRow = document.createElement('div');
    colorRow.className = 'v4-row';
    colorRow.innerHTML = '<label>Accent Color</label><div class="swatch c-' + (g.colorKey || 'green') + '" id="g-swatch" style="width:22px;height:22px;border-radius:11px;background:var(--cat);"></div>';
    colorRow.onclick = () => {
      openColorPicker(g.colorKey || 'green', (newKey) => {
        g.colorKey = newKey;
        const sw = document.getElementById('g-swatch');
        if (sw) {
          sw.className = 'swatch c-' + newKey;
          sw.style.background = '';
        }
        if (!isNew) FB.updateDoc(FB.doc(goalsCol(), g.id), { colorKey: newKey });
      });
    };
    body.appendChild(colorRow);

    let currentTagUids = Array.isArray(g.tagUids) ? g.tagUids.slice() : [];
    const members = Object.keys(App.settings?.members || {});
    const memberList = members.map(uid => ({
      uid,
      name: displayName(uid),
      isMe: uid === App.user.uid,
    }));

    let perPerson = {};
    memberList.forEach(m => { perPerson[m.uid] = 0; });
    if (g.monthlySplit) Object.assign(perPerson, g.monthlySplit);

    function renderSplits() {
      const container = document.getElementById('g-splits-container');
      if (!container) return;
      container.innerHTML = '';
      
      const activeMembers = memberList.filter(m => currentTagUids.includes(m.uid));
      if (activeMembers.length === 0) return;
      
      const list = document.createElement('div');
      list.className = 'gsplits';
      
      let total = 0;
      activeMembers.forEach(m => {
        const amt = Number(perPerson[m.uid]) || 0;
        total += amt;
        const row = document.createElement('div');
        row.className = 'gsplit-row';
        row.innerHTML = getAvatarHtml(m.uid, '28px') +
          '<div class="label">' + esc(m.name) + '</div>' +
          '<div class="chip"><input type="number" data-uid="' + m.uid + '" value="' + amt + '"><span class="u">/ mo</span></div>';
        list.appendChild(row);
      });
      
      const foot = document.createElement('div');
      foot.className = 'gsplit-foot';
      foot.innerHTML = '<span>Total monthly</span><span>' + fmtAmount(total) + ' ' + esc(App.settings?.currency || 'SEK') + '</span>';
      list.appendChild(foot);
      
      container.appendChild(list);
      
      list.querySelectorAll('input[data-uid]').forEach(inp => {
        inp.addEventListener('input', () => {
          perPerson[inp.dataset.uid] = Number(inp.value) || 0;
          renderSplits();
        });
      });
    }

    const whoRow = document.createElement('div');
    whoRow.className = 'v4-row';
    whoRow.style.flexDirection = 'column';
    whoRow.style.alignItems = 'flex-start';
    whoRow.innerHTML = '<label style="margin-bottom:8px;">Who is this goal for?</label>';
    const whoSeg = document.createElement('div');
    whoSeg.className = 'segmented';
    whoSeg.style.width = '100%';
    whoSeg.style.flexWrap = 'wrap';
    whoSeg.style.gap = '2px';
    
    memberList.forEach(m => {
      const b = document.createElement('button');
      b.textContent = m.name;
      b.style.flex = '1';
      if (currentTagUids.includes(m.uid)) b.className = 'active';
      b.onclick = () => {
        if (currentTagUids.includes(m.uid)) {
          currentTagUids = currentTagUids.filter(u => u !== m.uid);
          b.classList.remove('active');
        } else {
          currentTagUids.push(m.uid);
          b.classList.add('active');
        }
        renderSplits();
      };
      whoSeg.appendChild(b);
    });
    whoRow.appendChild(whoSeg);
    body.appendChild(whoRow);

    const splitsContainer = document.createElement('div');
    splitsContainer.id = 'g-splits-container';
    body.appendChild(splitsContainer);
    renderSplits();

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'v4-actions';
    
    const saveBtn = document.createElement('button');
    saveBtn.className = 'v4-btn-save';
    saveBtn.textContent = isNew ? 'Create Goal' : 'Save Goal';
    saveBtn.onclick = async () => {
      const name = titleInput.value.trim();
      const target = Number(amtInput.value);
      const targetDate = ddmmyyyyToISO(dInp.value) || '';
      if (!name || !target) { toast('Name and Amount required'); return; }
      if (currentTagUids.length === 0) { toast('Pick at least one person'); return; }
      
      const monthlySplit = {};
      const autoTotal = currentTagUids.reduce((acc, uid) => acc + (Number(perPerson[uid]) || 0), 0);
      currentTagUids.forEach(uid => { monthlySplit[uid] = Number(perPerson[uid]) || 0; });
      
      closeSheet();
      if (isNew) {
        await FB.addDoc(goalsCol(), {
          name, icon: g.icon, target, current: 0,
          autoAmount: autoTotal,
          monthlySplit,
          tagUids: currentTagUids,
          targetDate, colorKey: g.colorKey,
          createdAt: new Date().toISOString()
        });
      } else {
        await FB.updateDoc(FB.doc(goalsCol(), g.id), {
          name, icon: g.icon, target, targetDate,
          colorKey: g.colorKey,
          tagUids: currentTagUids,
          autoAmount: autoTotal,
          monthlySplit,
        });
      }
    };
    actionsDiv.appendChild(saveBtn);

    if (!isNew) {
      const delBtn = document.createElement('button');
      delBtn.className = 'v4-btn-del';
      delBtn.innerHTML = 'Delete';
      delBtn.onclick = async () => {
        if (!confirm('Delete this goal?')) return;
        closeSheet();
        await FB.deleteDoc(FB.doc(goalsCol(), g.id));
      };
      actionsDiv.appendChild(delBtn);
    }
    
    body.appendChild(actionsDiv);
    footer.innerHTML = '';
  });
}

function openCategoryEditor(cat) {
  const isNew = !cat;
  const editing = cat ? Object.assign({}, cat) : { name: '', icon: '🏷️', limit: 0, colorKey: 'blue', parentId: '' };

  let pinState = (App.userSettings.pins || []).includes(editing.id);

  openSheet((body, footer) => {
    body.innerHTML = '';
    const h3 = document.createElement('h3');
    h3.textContent = isNew ? 'New category' : 'Edit category';
    body.appendChild(h3);

    const nameF = document.createElement('div');
    nameF.className = 'field';
    nameF.innerHTML = '<label>Name</label><input id="ce-name" value="' + esc(editing.name) + '">';
    body.appendChild(nameF);

    const limF = document.createElement('div');
    limF.className = 'field';
    limF.innerHTML = '<label>Limit</label><input id="ce-limit" inputmode="numeric" value="' + (editing.limit || 0) + '">';
    body.appendChild(limF);

    const pinF = document.createElement('div');
    pinF.className = 'field';
    pinF.style.cursor = 'pointer';
    pinF.innerHTML = '<label>Pin to Home</label>' +
      '<div class="pin-toggle' + (pinState ? ' on' : '') + '" id="ce-pin-toggle"></div>';
    body.appendChild(pinF);
    pinF.onclick = () => {
      const toggle = document.getElementById('ce-pin-toggle');
      let currentPins = App.userSettings.pins || [];
      if (pinState) {
        currentPins = currentPins.filter(id => id !== editing.id);
        toggle.classList.remove('on');
        pinState = false;
      } else {
        if (currentPins.length >= 4) { toast('Max 4 pins'); return; }
        currentPins.push(editing.id);
        toggle.classList.add('on');
        pinState = true;
      }
      updateUserSetting('pins', currentPins);
    };

    const iconF = document.createElement('div');
    iconF.className = 'field';
    iconF.style.cursor = 'pointer';
    iconF.innerHTML = '<label>Icon</label>' +
      '<div style="display:flex;align-items:center;gap:10px;">' +
        '<span id="ce-icon-val" style="font-size:20px;">' + esc(editing.icon || '🏷️') + '</span>' +
        '<span style="color:var(--text3);">›</span>' +
      '</div>';
    body.appendChild(iconF);
    const iconPanel = document.createElement('div');
    iconPanel.style.display = 'none';
    body.appendChild(iconPanel);

    const colorF = document.createElement('div');
    colorF.className = 'field c-' + (editing.colorKey || 'blue');
    colorF.style.cursor = 'pointer';
    colorF.innerHTML = '<label>Color</label>' +
      '<div style="display:flex;align-items:center;gap:10px;">' +
        '<div class="color-swatch"></div>' +
        '<span style="color:var(--text3);">›</span>' +
      '</div>';
    body.appendChild(colorF);
    const colorPanel = document.createElement('div');
    colorPanel.style.display = 'none';
    body.appendChild(colorPanel);

    iconF.onclick = () => {
      const open = iconPanel.style.display !== 'none';
      if (open) { iconPanel.style.display = 'none'; return; }
      iconPanel.style.display = '';
      colorPanel.style.display = 'none';
      buildIconPicker(iconPanel, editing.icon || '🏷️', (emoji) => {
        editing.icon = emoji;
        document.getElementById('ce-icon-val').textContent = emoji;
        iconPanel.style.display = 'none';
      });
    };
    colorF.onclick = () => {
      const open = colorPanel.style.display !== 'none';
      if (open) { colorPanel.style.display = 'none'; return; }
      colorPanel.style.display = '';
      iconPanel.style.display = 'none';
      buildColorPicker(colorPanel, editing.colorKey || 'blue', (key) => {
        editing.colorKey = key;
        colorF.className = 'field c-' + key;
        colorPanel.style.display = 'none';
      });
    };

    footer.innerHTML = '';
    const save = document.createElement('button');
    save.className = 'primary';
    save.textContent = isNew ? 'Create' : 'Save';
    save.onclick = async () => {
      const name = document.getElementById('ce-name').value.trim();
      if (!name) { toast('Name required'); return; }
      const limit = Number(document.getElementById('ce-limit').value) || 0;
      const data = { name, limit, icon: editing.icon || '🏷️', colorKey: editing.colorKey || 'blue', parentId: editing.parentId || '' };
      closeSheet();
      if (isNew) await FB.addDoc(categoriesCol(), { ...data, createdAt: new Date().toISOString() });
      else await FB.updateDoc(FB.doc(categoriesCol(), cat.id), data);
    };
    footer.appendChild(save);

    if (!isNew) {
      const del = h('button', { class: 'danger' }, 'Delete');
      del.onclick = async () => {
        if (!confirm('Delete "' + cat.name + '"? Historical expenses keep their name.')) return;
        closeSheet();
        await FB.deleteDoc(FB.doc(categoriesCol(), cat.id));
      };
      footer.appendChild(del);
    }
  });
}

const PALETTE = [
  'blue','sky','azure','teal','mint','cyan','ocean','indigo','violet','lavender',
  'green','emerald','forest','pine','lime','jade','sage','seafoam','pistachio','olive',
  'amber','orange','tangerine','coral','gold','mustard','apricot','peach','saffron','honey',
  'red','crimson','ruby','rose','raspberry','pink','magenta','fuchsia','salmon','blush',
  'brown','cocoa','coffee','slate','steel','gray','stone','sand','clay','graphite',
];
function buildColorPicker(container, current, onPick) {
  container.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'palette-grid';
  PALETTE.forEach(key => {
    const chip = document.createElement('div');
    chip.className = 'color-chip c-' + key + (key === current ? ' on' : '');
    chip.onclick = () => {
      grid.querySelectorAll('.color-chip').forEach(c => c.classList.remove('on'));
      chip.classList.add('on');
      onPick(key);
    };
    grid.appendChild(chip);
  });
  container.appendChild(grid);
}
function openColorPicker(current, onPick) {
  openSheet((body) => {
    body.innerHTML = '<h3>Pick Color</h3>';
    const container = document.createElement('div');
    body.appendChild(container);
    buildColorPicker(container, current, (key) => { onPick(key); closeSheet(); });
  });
}
function openPillColorPicker(type) {
  openSheet((body) => {
    body.innerHTML = '<h3>Pick Pill Color</h3>';
    const grid = document.createElement('div');
    grid.className = 'palette-grid';
    const pc = (App.settings && App.settings.pillColors) || {};
    const current = pc[type] || 'blue';
    PALETTE.forEach(key => {
      const chip = document.createElement('div');
      chip.className = 'color-chip c-' + key + (key === current ? ' on' : '');
      chip.onclick = async () => {
        const newPC = { ...(App.settings.pillColors || {}), [type]: key };
        await saveSetting('pillColors', newPC);
        closeSheet();
      };
      grid.appendChild(chip);
    });
    body.appendChild(grid);
  });
}

const ICONS = {
  'Food & Drink': [['🛒','cart'],['🥦','broccoli'],['🍞','bread'],['🥩','meat'],['🐟','fish'],['🍎','apple'],['☕','coffee'],['🍽️','plate'],['🍔','burger'],['🍕','pizza'],['🍜','noodles'],['🍰','cake'],['🍷','wine'],['🍺','beer'],['🥤','soda'],['🧃','juice'],['🍬','candy'],['🍦','ice cream']],
  'Candy & Sweets': [['🍬','candy'],['🍭','lollipop'],['🍫','chocolate'],['🍩','donut'],['🍪','cookie'],['🧁','cupcake'],['🍰','cake'],['🍦','ice cream'],['🍨','ice cream'],['🍧','shaved ice'],['🍿','popcorn'],['🍯','honey']],
  'Home': [['🏠','home'],['💡','light'],['🔌','plug'],['🔥','fire'],['💧','water'],['🚿','shower'],['🧻','paper'],['🧹','broom'],['🛋️','sofa'],['🛏️','bed'],['📺','tv'],['🌐','internet'],['📶','wifi'],['🗑️','trash'],['🧰','toolbox'],['🔧','wrench']],
  'Transport': [['🚌','bus'],['🚇','metro'],['🚕','taxi'],['🚗','car'],['⛽','gas'],['🅿️','parking'],['🚲','bike'],['🛴','scooter'],['✈️','plane'],['🚆','train'],['🛵','motorcycle'],['⛴️','ferry'],['🎫','ticket'],['🗺️','map'],['🚏','bus stop'],['🛣️','highway']],
  'Health': [['💊','pill'],['🩺','stethoscope'],['🏥','hospital'],['💉','syringe'],['🧴','lotion'],['🪥','toothbrush'],['🩹','bandage'],['🧘','yoga'],['🏋️','gym'],['🏃','run'],['🚴','cycle'],['🩸','blood'],['🫀','heart'],['🧠','brain'],['🦷','tooth'],['👁️','eye']],
  'Entertainment': [['🎬','movie'],['🎮','game'],['🎵','music'],['🎤','microphone'],['🎭','theater'],['🎨','art'],['📚','books'],['🎧','headphones'],['🎲','dice'],['🏖️','beach'],['🎢','rollercoaster'],['🎯','target'],['🎳','bowling'],['🎪','circus'],['🏕️','camping'],['🎸','guitar']],
  'Shopping': [['🛍️','shopping'],['👕','shirt'],['👗','dress'],['👟','shoe'],['💄','lipstick'],['💇','haircut'],['🧴','shampoo'],['👓','glasses'],['👜','handbag'],['💍','ring'],['🕶️','sunglasses'],['🎁','gift'],['🎀','ribbon'],['🧸','teddy'],['💐','flowers'],['🛏️','bedroom']],
  'Family & Pets': [['👶','baby'],['🧒','child'],['👨‍👩‍👧','family'],['🐶','dog'],['🐱','cat'],['🐾','paw'],['🦴','bone'],['🐠','fish'],['🐦','bird'],['🐹','hamster'],['🌱','seedling'],['🪴','plant'],['🌸','flower'],['🌳','tree'],['🧑‍🍼','parent'],['❤️','heart']],
  'Money': [['💳','credit card'],['💰','money'],['🏦','bank'],['💸','expense'],['📊','chart'],['🧾','receipt'],['📄','paper'],['📝','note'],['🗂️','folders'],['🔒','lock'],['🏷️','tag'],['⚖️','balance'],['🪙','coin'],['💵','dollar'],['📮','mailbox'],['🏢','office']],
  'Travel': [['🏖️','beach'],['🏔️','mountain'],['🏨','hotel'],['🗺️','map'],['✈️','plane'],['🎫','ticket'],['🎉','party'],['🎂','birthday'],['🎊','confetti'],['🎓','graduation'],['🎁','gift'],['🏟️','stadium'],['🎡','ferris wheel'],['🚢','cruise'],['🌍','earth'],['🕯️','candle']],
  'Misc': [['📱','phone'],['💻','laptop'],['🖥️','desktop'],['⌚','watch'],['📷','camera'],['🎒','backpack'],['🔑','key'],['🧩','puzzle'],['🧲','magnet'],['⚙️','gear'],['❓','question'],['⭐','star'],['🔔','bell'],['🌟','shine'],['💫','sparkle'],['🏷️','default']],
};
function buildIconPicker(container, current, onPick) {
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'icon-picker';

  const search = document.createElement('input');
  search.className = 'icon-search';
  search.placeholder = '🔍  Search icons…';
  wrap.appendChild(search);

  const scroll = document.createElement('div');

  function render(q) {
    scroll.innerHTML = '';
    const query = (q || '').toLowerCase().trim();
    let any = false;
    Object.entries(ICONS).forEach(([cat, list]) => {
      const matches = list.filter(([e, k]) => !query || k.includes(query) || e.includes(query));
      if (!matches.length) return;
      any = true;
      const label = document.createElement('div');
      label.className = 'icon-cat-label';
      label.textContent = cat;
      scroll.appendChild(label);
      const grid = document.createElement('div');
      grid.className = 'icon-grid';
      matches.forEach(([emoji]) => {
        const btn = document.createElement('button');
        btn.className = 'icon-btn' + (emoji === current ? ' on' : '');
        btn.textContent = emoji;
        btn.onclick = () => {
          current = emoji;
          grid.querySelectorAll('.icon-btn').forEach(b => b.classList.remove('on'));
          btn.classList.add('on');
          onPick(emoji);
        };
        grid.appendChild(btn);
      });
      scroll.appendChild(grid);
    });
    if (!any) {
      const empty = document.createElement('div');
      empty.style.cssText = 'text-align:center;padding:20px;color:var(--text2);font-size:13px;';
      empty.textContent = 'No icons match "' + query + '"';
      scroll.appendChild(empty);
    }
  }
  search.oninput = () => render(search.value);
  wrap.appendChild(scroll);

  const custom = document.createElement('div');
  custom.className = 'custom-emoji-wrap';
  custom.innerHTML = '<input placeholder="Or paste any emoji →" maxlength="4"><button>Use</button>';
  const ci = custom.querySelector('input');
  const cb = custom.querySelector('button');
  const commit = () => { const v = ci.value.trim(); if (!v) return; onPick(v); ci.value = ''; };
  cb.onclick = commit;
  ci.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } };
  wrap.appendChild(custom);

  container.appendChild(wrap);
  render('');
}
function buildIconPickerInline(current, onPick) {
  openSheet((body) => {
    body.innerHTML = '<h3>Pick an Icon</h3>';
    const container = document.createElement('div');
    body.appendChild(container);
    buildIconPicker(container, current, (emoji) => { onPick(emoji); closeSheet(); });
  });
}

const TONES = [
  { key: 'sunset', name: 'Sunset', a: '#ff512f', b: '#f09819' }, { key: 'ambersky', name: 'Amber Sky', a: '#f12711', b: '#f5af19' },
  { key: 'coral', name: 'Coral', a: '#ff6b6b', b: '#ee5a24' }, { key: 'cherry', name: 'Cherry', a: '#eb3349', b: '#f45c43' },
  { key: 'fire', name: 'Fire', a: '#cb2d3e', b: '#ef473a' }, { key: 'sunrise', name: 'Sunrise', a: '#ff9966', b: '#ff5e62' },
  { key: 'blood', name: 'Blood', a: '#870000', b: '#190a05' }, { key: 'rose', name: 'Rose', a: '#c9184a', b: '#ff8fab' },
  { key: 'grape', name: 'Grape', a: '#5f0f40', b: '#9a031e' }, { key: 'plumfire', name: 'Plum Fire', a: '#4b134f', b: '#c94b4b' },
  { key: 'indigosun', name: 'Indigo Sun', a: '#1a2a6c', b: '#b21f1f' }, { key: 'lava', name: 'Lava', a: '#ff512f', b: '#dd2476' },
  { key: 'rosegold', name: 'Rose Gold', a: '#b24592', b: '#f15f79' }, { key: 'twilight', name: 'Twilight', a: '#3a1c71', b: '#d76d77' },
  { key: 'berry', name: 'Berry', a: '#6a0572', b: '#ab83a1' }, { key: 'cosmic', name: 'Cosmic', a: '#ff00cc', b: '#333399' },
  { key: 'electric', name: 'Electric', a: '#4776e6', b: '#8e54e9' }, { key: 'nebula', name: 'Nebula', a: '#8e2de2', b: '#4a00e0' },
  { key: 'berrywine', name: 'Berry Wine', a: '#41295a', b: '#2f0743' }, { key: 'midnight', name: 'Midnight', a: '#1a1a2e', b: '#3b2f6b' },
  { key: 'ocean', name: 'Ocean', a: '#0a84ff', b: '#5b4bff' }, { key: 'midnightsea', name: 'Midnight Sea', a: '#141e30', b: '#243b55' },
  { key: 'aurora', name: 'Aurora', a: '#00b4db', b: '#0083b0' }, { key: 'tealnight', name: 'Teal Night', a: '#0f2027', b: '#2c5364' },
  { key: 'deepsea', name: 'Deep Sea', a: '#2c3e50', b: '#4ca1af' }, { key: 'emerald', name: 'Emerald', a: '#0f766e', b: '#14b8a6' },
  { key: 'mint', name: 'Mint', a: '#009688', b: '#7fdbca' }, { key: 'jungle', name: 'Jungle', a: '#134e5e', b: '#71b280' },
  { key: 'forest', name: 'Forest', a: '#1b4332', b: '#40916c' }, { key: 'steel', name: 'Steel', a: '#485563', b: '#29323c' },
  { key: 'graphite', name: 'Graphite', a: '#2b2d42', b: '#4a4e69' }, { key: 'slate', name: 'Slate', a: '#33415c', b: '#5c6b8a' },
  { key: 'sand', name: 'Sand', a: '#a47148', b: '#d4a373' }, { key: 'copper', name: 'Copper', a: '#b79891', b: '#94716b' },
  { key: 'blush', name: 'Blush', a: '#e07a5f', b: '#f2cc8f' },
];
function openTonePicker(currentKey) {
  openSheet((body) => {
    body.innerHTML = '<h3>Hero tone</h3>';
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:4px 0;';
    TONES.forEach(t => {
      const tile = document.createElement('div');
      tile.style.cssText = 'height:64px;border-radius:14px;cursor:pointer;position:relative;' +
        'color:#fff;font-size:10.5px;font-weight:800;display:flex;align-items:flex-end;' +
        'padding:7px 9px;text-shadow:0 1px 2px rgba(0,0,0,.3);' +
        'background:linear-gradient(160deg,' + t.a + ' 0%,' + t.b + ' 100%);';
      tile.textContent = t.name;
      if (currentKey === t.key) {
        const check = document.createElement('div');
        check.style.cssText = 'position:absolute;top:6px;right:6px;width:18px;height:18px;' +
          'border-radius:9px;background:#fff;color:#0a0a0a;display:flex;align-items:center;' +
          'justify-content:center;font-size:11px;font-weight:900;';
        check.textContent = '✓';
        tile.appendChild(check);
      }
      tile.onclick = () => { updateUserSetting('heroTone', t.key); closeSheet(); };
      grid.appendChild(tile);
    });
    body.appendChild(grid);
  });
}

function openExpenseEditor(expense, prefillName) {
  const isNew = !expense;
  const working = expense ? Object.assign({}, expense) : { name: prefillName || '', amount: 0, categoryId: '', subcategoryId: '' };

  openSheet((body, footer) => {
    body.innerHTML = '<h3>' + (isNew ? 'Add expense' : 'Edit expense') + '</h3>';
    const nameF = document.createElement('div');
    nameF.className = 'field';
    nameF.innerHTML = '<label>Name</label><input id="exp-name" value="' + esc(working.name) + '">';
    body.appendChild(nameF);
    
    const amtF = document.createElement('div');
    amtF.className = 'field';
    amtF.innerHTML = '<label>Amount</label><input id="exp-amt" inputmode="numeric" value="' + (working.amount || '') + '" placeholder="0">';
    body.appendChild(amtF);

    const catLbl = document.createElement('div');
    catLbl.style.cssText = 'font-size:11px;color:var(--text2);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin:14px 4px 8px;';
    catLbl.textContent = 'Category';
    body.appendChild(catLbl);

    const parents = App.categories.filter(c => !c.parentId);
    let chosenCat = working.categoryId || (parents[0] ? parents[0].id : null);

    parents.forEach(c => {
      const row = document.createElement('div');
      row.className = 'field';
      row.style.cursor = 'pointer';
      row.innerHTML = '<div style="display:flex;align-items:center;gap:10px;flex:1;">' +
          '<div class="cat-icon c-' + (c.colorKey || 'blue') + '" style="width:30px;height:30px;border-radius:10px;font-size:14px;display:flex;align-items:center;justify-content:center;">' + esc(c.icon || '🏷️') + '</div>' +
          '<span style="font-weight:600;">' + esc(c.name) + '</span></div>' +
        '<span class="cat-check" style="color:var(--blue);font-weight:800;opacity:' + (chosenCat === c.id ? '1' : '0') + '">✓</span>';
      row.onclick = () => {
        chosenCat = c.id;
        body.querySelectorAll('.cat-check').forEach(el => el.style.opacity = '0');
        row.querySelector('.cat-check').style.opacity = '1';
      };
      body.appendChild(row);
    });

    footer.innerHTML = '';
    const save = document.createElement('button');
    save.className = 'primary';
    save.textContent = isNew ? 'Add expense' : 'Save';
    save.onclick = async () => {
      const name = document.getElementById('exp-name').value.trim();
      const amount = Number(document.getElementById('exp-amt').value);
      if (!name) { toast('Name required'); return; }
      if (!amount || amount <= 0) { toast('Amount must be > 0'); return; }
      if (!chosenCat) { toast('Pick a category'); return; }
      closeSheet();
      if (isNew) {
        const periodKey = computeCurrentPeriod((App.settings || DEFAULT_SETTINGS).periodStartDay).key;
        await FB.addDoc(expensesCol(), { name, amount, categoryId: chosenCat, subcategoryId: '', dateAdded: new Date().toISOString(), periodKey, createdBy: App.user.uid });
        await syncCurrentHistoryBudget();
      } else {
        await FB.updateDoc(FB.doc(expensesCol(), expense.id), { name, amount, categoryId: chosenCat });
        await recomputeHistoryTotal(expense.periodKey);
      }
    };
    footer.appendChild(save);

    if (!isNew) {
      const del = h('button', { class: 'danger' }, 'Delete');
      del.onclick = async () => {
        if (!confirm('Delete "' + expense.name + '"?')) return;
        closeSheet();
        await FB.deleteDoc(FB.doc(expensesCol(), expense.id));
        await recomputeHistoryTotal(expense.periodKey);
      };
      footer.appendChild(del);
    }
  });
}

function openToPayEditor(item) {
  const isNew = !item;
  if (!item) item = {
    name: '', amount: null, dueDate: '', paid: false, paidDate: null,
    isSubscription: false, isRepeat: false, isDebt: false, repeatUntil: '',
    tagUids: [], amountsByUid: {}
  };
  let type = item.isSubscription ? 'subscription' : item.isRepeat ? 'repeat' : item.isDebt ? 'debt' : 'none';
  let currentTagUids = Array.isArray(item.tagUids) ? item.tagUids.slice() : [];
  const amountsByUid = { ...(item.amountsByUid || {}) };

  const members = Object.keys(App.settings?.members || {});
  const memberList = members.map(uid => ({
    uid,
    name: displayName(uid),
    isMe: uid === App.user.uid,
  }));

  openSheet((body, footer) => {
    body.innerHTML = '<h3>' + (isNew ? 'New payment' : 'Edit payment') + '</h3>';
    const nameF = document.createElement('div');
    nameF.className = 'field';
    nameF.innerHTML = '<label>Name</label><input id="tp-name" value="' + esc(item.name) + '" placeholder="Rent, Internet…">';
    body.appendChild(nameF);
    
    const amtF = document.createElement('div');
    amtF.className = 'field';
    amtF.innerHTML = '<label>Amount</label><input id="tp-amt" inputmode="numeric" value="' + (item.amount != null ? item.amount : '') + '" placeholder="Optional">';
    body.appendChild(amtF);

    const dueF = document.createElement('div');
    dueF.className = 'field';
    dueF.innerHTML = '<label>Due date</label><input class="date-input" id="tp-due" type="text" inputmode="numeric" placeholder="DD/MM/YYYY" maxlength="10" value="' + isoToDDMMYYYY(item.dueDate) + '">';
    body.appendChild(dueF);
    const dueInput = dueF.querySelector('#tp-due');
    dueInput.addEventListener('input', () => autoSlashDate(dueInput));

    const typeF = document.createElement('div');
    typeF.className = 'field';
    typeF.innerHTML = '<label>Type</label>';
    const seg = document.createElement('div');
    seg.className = 'segmented';
    [['none','One-time'],['subscription','Sub'],['repeat','Repeat'],['debt','Debt']].forEach(([val, label]) => {
      const b = document.createElement('button');
      b.textContent = label;
      if (type === val) b.className = 'active';
      b.onclick = () => {
        type = val;
        seg.querySelectorAll('button').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        repeatEndF.style.display = (val === 'repeat' || val === 'debt') ? 'flex' : 'none';
        if (val !== 'none' && !dueInput.value) dueInput.value = isoToDDMMYYYY(localDateString(new Date()));
      };
      seg.appendChild(b);
    });
    typeF.appendChild(seg);
    body.appendChild(typeF);

    const repeatEndF = document.createElement('div');
    repeat