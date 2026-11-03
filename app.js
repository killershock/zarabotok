/* Заработок — офлайн-учёт услуг и заработка.
   Данные хранятся локально (localStorage) на устройстве. */
'use strict';

const LS_KEY = 'zarabotok_v1';
const CLOUD_KEY = 'zarabotok_cloud_v1';
const BACKUP_PROMPT_KEY = 'zarabotok_backup_prompt';
const PRICE_UNDO_KEY = 'zarabotok_price_undo';
const IMPORT_MAP_KEY = 'zarabotok_import_map';
const APP_VERSION = '1.7.2';

const PALETTE = ['#16a34a', '#2563eb', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
const CURRENCIES = [
  { v: '₽', n: 'Российский рубль' },
  { v: '$', n: 'Доллар США' },
  { v: '€', n: 'Евро' },
  { v: '₸', n: 'Тенге' },
  { v: '₴', n: 'Гривна' },
  { v: 'сум', n: 'Сум' },
  { v: 'Br', n: 'Белорусский рубль' },
  { v: 'zł', n: 'Злотый' },
];
const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

const X_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const CHEV = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const PLUS_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
const SEARCH_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="m20 20-3.6-3.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

/* ---------------- утилиты ---------------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const parseAmount = (v) => {
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/\s|\u00A0/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k) => {
  const [y, m, d] = String(k).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const isSameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const dayDiff = (a, b) => Math.round((Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) - Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) / 86400000);

const monthGenFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
const monthGen = (d) => {
  const part = monthGenFmt.formatToParts(d).find((p) => p.type === 'month');
  return part ? part.value : '';
};
const weekdayName = (d) => new Intl.DateTimeFormat('ru-RU', { weekday: 'long' }).format(d);

const nfMoney = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const nfInt = new Intl.NumberFormat('ru-RU');

const fmtDateTime = (ts) => new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
}).format(new Date(ts));

const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
};

/* ---------------- состояние ---------------- */

function defaultData() {
  return {
    version: 1,
    settings: { currency: '₽', weekStart: 1 },
    employees: [{ id: uid(), name: 'Я', color: PALETTE[0], createdAt: Date.now() }],
    services: [],
    entries: [],
  };
}

function normalize(d) {
  const out = Object.assign(defaultData(), d || {});
  out.settings = Object.assign({ currency: '₽', weekStart: 1 }, d && d.settings);
  out.employees = Array.isArray(d && d.employees) ? d.employees : [];
  out.services = Array.isArray(d && d.services) ? d.services : [];
  out.entries = Array.isArray(d && d.entries) ? d.entries : [];
  out.employees = out.employees
    .filter((e) => e && e.id && e.name)
    .map((e) => ({ id: e.id, name: String(e.name), color: e.color || PALETTE[0], createdAt: e.createdAt || Date.now() }));
  out.services = out.services
    .filter((s) => s && s.id && s.name)
    .map((s) => ({ id: s.id, name: String(s.name), price: round2(s.price) }));
  out.entries = out.entries
    .filter((e) => e && e.id && /^\d{4}-\d{2}-\d{2}$/.test(e.date))
    .map((e) => {
      const rawItems = Array.isArray(e.items) && e.items.length
        ? e.items
        : [{ service: e.service, qty: e.qty, price: e.price, amount: e.amount }];
      const items = rawItems.map((it) => {
        const qty = Number(it.qty) > 0 ? Number(it.qty) : 1;
        const price = round2(it.price != null ? it.price : (Number(it.amount) || 0) / qty);
        const amount = round2(it.amount != null ? it.amount : price * qty);
        return { service: String(it.service || 'Услуга'), qty, price, amount };
      });
      const amount = round2(items.reduce((sum, it) => sum + it.amount, 0));
      return {
        id: e.id,
        date: e.date,
        employeeId: e.employeeId || null,
        items,
        amount,
        note: String(e.note || ''),
        createdAt: e.createdAt || Date.now(),
        ...(e.updatedAt ? { updatedAt: e.updatedAt } : {}),
      };
    });
  return out;
}

function loadData() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultData();
    return normalize(JSON.parse(raw));
  } catch (err) {
    console.warn('Не удалось прочитать данные', err);
    return defaultData();
  }
}

let data = loadData();

const ui = {
  tab: 'home',
  period: 'day',
  anchor: new Date(),
  recordsMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  recordsEmployee: 'all',
  recordsQuery: '',
};

const sheetState = { type: null, id: null, employeeId: '', color: PALETTE[0] };
let confirmResolver = null;
let deferredPrompt = null;

function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
    scheduleSnapshot();
  } catch (err) {
    toast('Не удалось сохранить данные');
    console.error(err);
  }
}

/* ---------------- деньги и периоды ---------------- */

const currency = () => data.settings.currency || '₽';
const money = (v) => `${nfMoney.format(round2(v))}\u00A0${currency()}`;
const moneyShort = (v) => {
  const val = Math.abs(round2(v));
  if (val >= 1000000) return `${nfMoney.format(Math.round(val / 1000) / 1000)}\u00A0млн`;
  return `${nfMoney.format(round2(v))}\u00A0${currency()}`;
};

function periodRange(period, anchor) {
  let start, end;
  if (period === 'week') {
    const s = startOfDay(anchor);
    const off = (s.getDay() - (data.settings.weekStart ?? 1) + 7) % 7;
    start = addDays(s, -off);
    end = addDays(start, 7);
  } else if (period === 'month') {
    start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
  } else if (period === 'year') {
    start = new Date(anchor.getFullYear(), 0, 1);
    end = new Date(anchor.getFullYear() + 1, 0, 1);
  } else {
    start = startOfDay(anchor);
    end = addDays(start, 1);
  }
  return { start, end, keyStart: toKey(start), keyEnd: toKey(end) };
}

function periodTitle(period, anchor) {
  const { start } = periodRange(period, anchor);
  const now = new Date();
  if (period === 'day') {
    const diff = dayDiff(startOfDay(now), start);
    const base = `${start.getDate()} ${monthGen(start)}`;
    if (diff === 0) return `Сегодня, ${base}`;
    if (diff === 1) return `Вчера, ${base}`;
    if (diff === -1) return `Завтра, ${base}`;
    return `${base}, ${weekdayName(start)}`;
  }
  if (period === 'week') {
    const last = addDays(start, 6);
    const sameMonth = start.getMonth() === last.getMonth() && start.getFullYear() === last.getFullYear();
    const y = start.getFullYear() !== now.getFullYear() ? ` ${start.getFullYear()}` : '';
    if (sameMonth) return `${start.getDate()}–${last.getDate()} ${monthGen(start)}${y}`;
    return `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]} – ${last.getDate()} ${MONTHS_SHORT[last.getMonth()]}${y}`;
  }
  if (period === 'month') {
    const y = start.getFullYear() !== now.getFullYear() ? ` ${start.getFullYear()}` : '';
    return `${MONTHS_NOM[start.getMonth()]}${y}`;
  }
  return `${start.getFullYear()} год`;
}

function shiftPeriod(dir) {
  const a = new Date(ui.anchor);
  if (ui.period === 'day') a.setDate(a.getDate() + dir);
  else if (ui.period === 'week') a.setDate(a.getDate() + 7 * dir);
  else if (ui.period === 'month') { a.setDate(1); a.setMonth(a.getMonth() + dir); }
  else { a.setFullYear(a.getFullYear() + dir); }
  ui.anchor = a;
}

function entriesIn(keyStart, keyEnd) {
  return data.entries.filter((e) => e.date >= keyStart && e.date < keyEnd);
}

const sumOf = (list) => round2(list.reduce((acc, e) => acc + (Number(e.amount) || 0), 0));
const byDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0));

function employeeById(id) {
  return data.employees.find((e) => e.id === id) || null;
}
function employeeName(id) {
  const e = employeeById(id);
  return e ? e.name : 'Без сотрудника';
}
function employeeColor(id) {
  const e = employeeById(id);
  return e ? e.color : '#98a2b3';
}
function initial(name) {
  return String(name || '?').trim().charAt(0).toUpperCase() || '?';
}
function avatarHtml(name, color, cls = '') {
  return `<div class="avatar ${cls}" style="background:${color}22;color:${color}">${esc(initial(name))}</div>`;
}

/* ---------------- главный экран ---------------- */

function breakdown(list) {
  const map = new Map();
  for (const e of list) {
    const key = e.employeeId || '__none';
    if (!map.has(key)) {
      map.set(key, {
        id: e.employeeId || null,
        name: employeeName(e.employeeId),
        color: employeeColor(e.employeeId),
        sum: 0,
        count: 0,
      });
    }
    const item = map.get(key);
    item.sum = round2(item.sum + (Number(e.amount) || 0));
    item.count += 1;
  }
  return Array.from(map.values()).sort((a, b) => b.sum - a.sum);
}

function entryRowHtml(e) {
  const name = employeeName(e.employeeId);
  const color = employeeColor(e.employeeId);
  const items = e.items || [];
  const title = items.map((it) => it.service).join(' + ') || 'Услуга';
  const parts = [name];
  if (items.length > 1) parts.push(`${items.length} ${plural(items.length, 'услуга', 'услуги', 'услуг')}`);
  const multiQty = items.filter((it) => Number(it.qty) > 1);
  if (multiQty.length === 1) parts.push(`${nfInt.format(multiQty[0].qty)} × ${money(multiQty[0].price)}`);
  if (e.note) parts.push(e.note);
  return `<button class="entry" type="button" data-action="edit-entry" data-id="${esc(e.id)}">
    ${avatarHtml(name, color)}
    <div>
      <div class="entry-title">${esc(title)}</div>
      <div class="entry-sub">${esc(parts.join(' · '))}</div>
    </div>
    <div class="entry-amount">${money(e.amount)}</div>
  </button>`;
}

function chartHtml(list) {
  const p = ui.period;
  const a = ui.anchor;
  const now = new Date();
  const buckets = [];

  const pushDay = (d) => {
    const key = toKey(d);
    buckets.push({
      label: String(d.getDate()),
      full: `${d.getDate()} ${monthGen(d)}`,
      now: isSameDay(d, now),
      sum: 0,
      match: (e) => e.date === key,
    });
  };

  if (p === 'day' || p === 'week') {
    const start = p === 'day' ? addDays(startOfDay(a), -6) : periodRange('week', a).start;
    for (let i = 0; i < 7; i++) pushDay(addDays(start, i));
  } else if (p === 'month') {
    const start = periodRange('month', a).start;
    const y = start.getFullYear();
    const m = start.getMonth();
    const days = new Date(y, m + 1, 0).getDate();
    for (let first = 1; first <= days; first += 7) {
      const last = Math.min(first + 6, days);
      const from = toKey(new Date(y, m, first));
      const to = toKey(new Date(y, m, last + 1));
      buckets.push({
        label: `${first}–${last}`,
        full: `${first}–${last} ${monthGen(new Date(y, m, first))}`,
        now: now.getFullYear() === y && now.getMonth() === m && now.getDate() >= first && now.getDate() <= last,
        sum: 0,
        match: (e) => e.date >= from && e.date < to,
      });
    }
  } else {
    const y = a.getFullYear();
    for (let m = 0; m < 12; m++) {
      const prefix = `${y}-${pad(m + 1)}`;
      buckets.push({
        label: MONTHS_SHORT[m],
        full: `${MONTHS_NOM[m]} ${y}`,
        now: y === now.getFullYear() && m === now.getMonth(),
        sum: 0,
        match: (e) => e.date.slice(0, 7) === prefix,
      });
    }
  }

  for (const e of data.entries) {
    for (const b of buckets) {
      if (b.match(e)) { b.sum = round2(b.sum + e.amount); break; }
    }
  }

  const max = Math.max(0, ...buckets.map((b) => b.sum));
  const cols = buckets.map((b) => {
    const h = max > 0 && b.sum > 0 ? Math.max(4, (b.sum / max) * 100) : 0;
    return `<div class="col ${b.now ? 'now' : ''}" title="${esc(b.full)}: ${esc(money(b.sum))}">
      <div class="track"><div class="b" style="height:${h}%"></div></div>
      <div class="lbl">${esc(b.label)}</div>
    </div>`;
  }).join('');

  const totalShown = buckets.reduce((s, b) => s + b.sum, 0);
  return `<div class="chart">${cols}</div>
    <div class="tiny muted mt8">Показано: ${money(totalShown)}</div>`;
}

function renderHome() {
  const el = $('#view-home');
  if (!el) return;
  const { keyStart, keyEnd } = periodRange(ui.period, ui.anchor);
  const list = entriesIn(keyStart, keyEnd).sort(byDateDesc);
  const total = sumOf(list);
  const empList = breakdown(list);
  const involved = empList.filter((e) => e.id).length;

  const periodWords = { day: 'день', week: 'неделю', month: 'месяц', year: 'год' };
  const seg = [['day', 'День'], ['week', 'Неделя'], ['month', 'Месяц'], ['year', 'Год']]
    .map(([k, l]) => `<button type="button" data-period="${k}" class="${ui.period === k ? 'active' : ''}">${l}</button>`)
    .join('');

  const maxEmp = Math.max(0, ...empList.map((e) => e.sum));
  const empRows = empList.map((e) => {
    const share = total > 0 ? Math.round((e.sum / total) * 100) : 0;
    const w = maxEmp > 0 ? Math.max(3, (e.sum / maxEmp) * 100) : 0;
    return `<div class="emp-row">
      ${avatarHtml(e.name, e.color)}
      <div>
        <div class="name">${esc(e.name)}</div>
        <div class="share">${share}% · ${e.count} ${plural(e.count, 'запись', 'записи', 'записей')}</div>
        <div class="bar"><i style="width:${w}%;background:${e.color}"></i></div>
      </div>
      <div class="amount">${money(e.sum)}</div>
    </div>`;
  }).join('');

  const recent = list.slice(0, 6);
  const recentHtml = recent.length
    ? recent.map(entryRowHtml).join('')
    : `<div class="empty">
        <div class="ico">🧾</div>
        <div class="t">Пока пусто</div>
        <div class="d">Добавьте первую услугу за этот период —<br>и сумма появится здесь.</div>
        <button class="btn primary" type="button" data-action="add-entry">${PLUS_ICON} Добавить запись</button>
      </div>`;

  el.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Заработок</h1>
        <div class="sub">${list.length ? `${list.length} ${plural(list.length, 'запись', 'записи', 'записей')} за период` : 'Учёт оказанных услуг'}</div>
      </div>
      <button class="icon-btn" type="button" data-action="add-entry" aria-label="Добавить запись">${PLUS_ICON}</button>
    </div>

    <div class="segmented">${seg}</div>

    <div class="period-nav">
      <button type="button" data-action="period-prev" aria-label="Назад"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <button class="period-label" type="button" data-action="period-today" title="Вернуться к текущему периоду">${esc(periodTitle(ui.period, ui.anchor))}</button>
      <button type="button" data-action="period-next" aria-label="Вперёд"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    </div>

    <div class="hero">
      <div class="hero-label">Итого за ${periodWords[ui.period]}</div>
      <div class="hero-sum">${money(total)}</div>
      <div class="hero-sub">${list.length ? `${list.length} ${plural(list.length, 'запись', 'записи', 'записей')}${involved ? ` · ${involved} ${plural(involved, 'сотрудник', 'сотрудника', 'сотрудников')}` : ''}` : 'Нет записей за этот период'}</div>
    </div>

    ${backupBannerHtml()}

    ${empList.length ? `<div class="card">
      <div class="card-head"><h2>По сотрудникам</h2><span class="hint">${esc(periodTitle(ui.period, ui.anchor))}</span></div>
      ${empRows}
    </div>` : ''}

    ${data.entries.length ? `<div class="card">
      <div class="card-head"><h2>Динамика</h2><span class="hint">${ui.period === 'year' ? 'по месяцам' : ui.period === 'month' ? 'по неделям' : 'по дням'}</span></div>
      ${chartHtml(list)}
    </div>` : ''}

    <div class="card">
      <div class="card-head"><h2>Записи</h2><button class="txt-btn" type="button" data-nav="records">Все →</button></div>
      ${recentHtml}
    </div>

    <div class="center tiny muted" style="margin:6px 0 4px">Данные хранятся на этом устройстве</div>
  `;
}

/* ---------------- записи ---------------- */

function dayLabel(key) {
  const d = fromKey(key);
  const diff = dayDiff(startOfDay(new Date()), d);
  const base = `${d.getDate()} ${monthGen(d)}`;
  if (diff === 0) return `Сегодня, ${base}`;
  if (diff === 1) return `Вчера, ${base}`;
  return `${base}, ${weekdayName(d)}`;
}

function filteredEntries() {
  const q = ui.recordsQuery.trim().toLowerCase();
  return data.entries
    .filter((e) => e.date.startsWith(`${ui.recordsMonth.getFullYear()}-${pad(ui.recordsMonth.getMonth() + 1)}`))
    .filter((e) => {
      if (ui.recordsEmployee === 'all') return true;
      if (ui.recordsEmployee === 'none') return !e.employeeId;
      return e.employeeId === ui.recordsEmployee;
    })
    .filter((e) => {
      if (!q) return true;
      const hay = [
        (e.items || []).map((it) => it.service).join(' '),
        e.note,
        employeeName(e.employeeId),
        String(e.amount),
        e.date,
      ].join(' ').toLowerCase();
      return hay.includes(q);
    })
    .sort(byDateDesc);
}

function groupByDate(list) {
  const map = new Map();
  for (const e of list) {
    if (!map.has(e.date)) map.set(e.date, []);
    map.get(e.date).push(e);
  }
  return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

function recordsListHtml() {
  const list = filteredEntries();
  if (!list.length) {
    return `<div class="card empty">
      <div class="ico">🔎</div>
      <div class="t">${ui.recordsQuery || ui.recordsEmployee !== 'all' ? 'Ничего не найдено' : 'Нет записей за этот месяц'}</div>
      <div class="d">${ui.recordsQuery || ui.recordsEmployee !== 'all' ? 'Попробуйте изменить фильтр или поиск.' : 'Добавьте услугу, чтобы начать учёт.'}</div>
      <button class="btn primary" type="button" data-action="add-entry">${PLUS_ICON} Добавить запись</button>
    </div>`;
  }
  const groups = groupByDate(list);
  return groups.map(([date, items]) => `
    <div class="day-group">
      <div class="day-head"><span class="d">${esc(dayLabel(date))}</span><span class="s">${money(sumOf(items))}</span></div>
      <div class="card" style="padding:4px 16px">${items.map(entryRowHtml).join('')}</div>
    </div>
  `).join('');
}

function renderRecordsList() {
  const wrap = $('#records-list');
  if (wrap) wrap.innerHTML = recordsListHtml();
  const sub = $('#records-sub');
  if (sub) {
    const monthList = data.entries.filter((e) => e.date.startsWith(`${ui.recordsMonth.getFullYear()}-${pad(ui.recordsMonth.getMonth() + 1)}`));
    sub.textContent = `${money(sumOf(monthList))} за месяц · ${monthList.length} ${plural(monthList.length, 'запись', 'записи', 'записей')}`;
  }
}

function renderRecords() {
  const el = $('#view-records');
  if (!el) return;
  const monthLabel = `${MONTHS_NOM[ui.recordsMonth.getMonth()]} ${ui.recordsMonth.getFullYear()}`;

  const chips = [`<button class="chip ${ui.recordsEmployee === 'all' ? 'active' : ''}" data-emp-filter="all">Все</button>`]
    .concat(data.employees.map((emp) => `<button class="chip ${ui.recordsEmployee === emp.id ? 'active' : ''}" data-emp-filter="${esc(emp.id)}"><span class="dot" style="background:${emp.color}"></span>${esc(emp.name)}</button>`))
    .concat([`<button class="chip ${ui.recordsEmployee === 'none' ? 'active' : ''}" data-emp-filter="none">Без сотрудника</button>`])
    .join('');

  el.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Записи</h1>
        <div class="sub" id="records-sub"></div>
      </div>
      <button class="icon-btn" type="button" data-action="add-entry" aria-label="Добавить запись">${PLUS_ICON}</button>
    </div>

    <div class="period-nav">
      <button type="button" data-action="month-prev" aria-label="Предыдущий месяц"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <button class="period-label" type="button" data-action="month-today">${esc(monthLabel)}</button>
      <button type="button" data-action="month-next" aria-label="Следующий месяц"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    </div>

    <div class="search">
      ${SEARCH_ICON}
      <input id="rec-search" type="search" placeholder="Поиск по услуге, сотруднику, сумме" value="${esc(ui.recordsQuery)}" autocomplete="off">
    </div>

    <div class="chips">${chips}</div>

    <div id="records-list"></div>
  `;
  renderRecordsList();
}

/* ---------------- сотрудники ---------------- */

function renderStaff() {
  const el = $('#view-staff');
  if (!el) return;
  const today = new Date();
  const rDay = periodRange('day', today);
  const rWeek = periodRange('week', today);
  const rMonth = periodRange('month', today);
  const rYear = periodRange('year', today);
  const monthList = entriesIn(rMonth.keyStart, rMonth.keyEnd);
  const monthTotal = sumOf(monthList);

  const statsFor = (empId) => {
    const filter = (e) => (empId === null ? !e.employeeId : e.employeeId === empId);
    return {
      day: sumOf(entriesIn(rDay.keyStart, rDay.keyEnd).filter(filter)),
      week: sumOf(entriesIn(rWeek.keyStart, rWeek.keyEnd).filter(filter)),
      month: sumOf(entriesIn(rMonth.keyStart, rMonth.keyEnd).filter(filter)),
      year: sumOf(entriesIn(rYear.keyStart, rYear.keyEnd).filter(filter)),
      monthCount: entriesIn(rMonth.keyStart, rMonth.keyEnd).filter(filter).length,
      totalCount: data.entries.filter(filter).length,
    };
  };

  const rows = data.employees.map((emp) => ({ emp, st: statsFor(emp.id) }));
  rows.sort((a, b) => b.st.month - a.st.month || b.st.year - a.st.year || a.emp.name.localeCompare(b.emp.name));

  const cards = rows.map(({ emp, st }) => {
    return `<div class="emp-card">
      <div class="top">
        ${avatarHtml(emp.name, emp.color)}
        <div>
          <div class="nm">${esc(emp.name)}</div>
          <div class="sm">${st.monthCount} ${plural(st.monthCount, 'запись', 'записи', 'записей')} за месяц · всего ${st.totalCount}</div>
        </div>
        <button class="icon-btn plain" type="button" data-action="edit-employee" data-id="${esc(emp.id)}" aria-label="Изменить сотрудника">${CHEV}</button>
      </div>
      <div class="emp-stats">
        <div class="st"><div class="k">День</div><div class="v">${money(st.day)}</div></div>
        <div class="st"><div class="k">Неделя</div><div class="v">${money(st.week)}</div></div>
        <div class="st"><div class="k">Месяц</div><div class="v">${money(st.month)}</div></div>
        <div class="st"><div class="k">Год</div><div class="v">${money(st.year)}</div></div>
      </div>
      <button class="btn block" type="button" data-action="add-entry" data-emp="${esc(emp.id)}">Добавить запись</button>
    </div>`;
  }).join('');

  const noneStats = statsFor(null);
  const noneCard = noneStats.totalCount
    ? `<div class="emp-card">
        <div class="top">
          ${avatarHtml('Без сотрудника', '#98a2b3')}
          <div><div class="nm">Без сотрудника</div><div class="sm">${noneStats.monthCount} ${plural(noneStats.monthCount, 'запись', 'записи', 'записей')} за месяц</div></div>
        </div>
        <div class="emp-stats">
          <div class="st"><div class="k">День</div><div class="v">${money(noneStats.day)}</div></div>
          <div class="st"><div class="k">Неделя</div><div class="v">${money(noneStats.week)}</div></div>
          <div class="st"><div class="k">Месяц</div><div class="v">${money(noneStats.month)}</div></div>
          <div class="st"><div class="k">Год</div><div class="v">${money(noneStats.year)}</div></div>
        </div>
      </div>`
    : '';

  el.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Сотрудники</h1>
        <div class="sub">Всего за месяц: ${money(monthTotal)}</div>
      </div>
      <button class="icon-btn" type="button" data-action="add-employee" aria-label="Добавить сотрудника">${PLUS_ICON}</button>
    </div>

    ${data.employees.length ? cards : `<div class="card empty">
      <div class="ico">👥</div>
      <div class="t">Сотрудников пока нет</div>
      <div class="d">Добавьте сотрудников, чтобы видеть,<br>кто сколько заработал.</div>
      <button class="btn primary" type="button" data-action="add-employee">${PLUS_ICON} Добавить сотрудника</button>
    </div>`}

    ${noneCard}

    ${data.employees.length ? `<div class="card">
      <div class="card-head"><h2>За всё время</h2></div>
      ${data.employees.map((emp) => {
        const count = data.entries.filter((e) => e.employeeId === emp.id).length;
        return { emp, count, total: sumOf(data.entries.filter((e) => e.employeeId === emp.id)) };
      }).sort((a, b) => b.total - a.total).map(({ emp, count, total }) => `<button class="line" type="button" data-action="edit-employee" data-id="${esc(emp.id)}">
          ${avatarHtml(emp.name, emp.color)}
          <div class="grow"><div class="ttl">${esc(emp.name)}</div><div class="dsc">${count} ${plural(count, 'запись', 'записи', 'записей')}</div></div>
          <div class="val">${money(total)}</div>
          ${CHEV}
        </button>`).join('')}
    </div>` : ''}

    <div class="center tiny muted" style="margin:8px 0">Зарплата считается по суммам услуг каждого сотрудника</div>
  `;
}

/* ---------------- ещё ---------------- */

function renderMore() {
  const el = $('#view-more');
  if (!el) return;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  let installBlock = '';
  if (!isStandalone) {
    if (deferredPrompt) {
      installBlock = `<div class="card">
        <div class="card-head"><h2>Установить приложение</h2></div>
        <p class="tiny muted">Добавьте приложение на главный экран — оно будет открываться как обычное и работать без интернета.</p>
        <button class="btn primary block mt12" type="button" data-action="install">Установить</button>
      </div>`;
    } else if (isIOS) {
      installBlock = `<div class="card">
        <div class="card-head"><h2>Установка на iPhone</h2></div>
        <p class="tiny muted">Откройте эту страницу в <b>Safari</b>, нажмите «Поделиться» <b>⎋</b> и выберите «На экран „Домой“». После этого приложение будет запускаться с иконки.</p>
      </div>`;
    } else {
      installBlock = `<div class="card">
        <div class="card-head"><h2>Установка на Android</h2></div>
        <p class="tiny muted">Откройте меню браузера <b>⋮</b> и выберите «Установить приложение» или «На главный экран».</p>
      </div>`;
    }
  }

  const cloudOn = !!cloud.token;
  const lastLocalText = backupInfo.lastAt ? fmtDateTime(backupInfo.lastAt) : 'ещё не было';
  const lastCloudText = cloud.lastAt ? fmtDateTime(cloud.lastAt) : 'ещё не было';

  const cloudBlock = cloudOn
    ? `<div class="divider"></div>
       <div class="card-head" style="margin-bottom:6px"><h2>Облачная копия GitHub</h2><span class="badge ok">включено</span></div>
       <p class="tiny muted">Последняя копия: ${esc(lastCloudText)}${cloud.error ? ` · <span style="color:var(--danger)">${esc(cloud.error)}</span>` : ''}</p>
       <div class="row-actions mt12">
         <button class="btn primary" type="button" data-action="cloud-backup">Копировать</button>
         <button class="btn" type="button" data-action="cloud-restore">Восстановить</button>
       </div>
       <button class="txt-btn mt8" type="button" data-action="cloud-off" style="color:var(--danger)">Отключить облачную копию</button>`
    : `<div class="divider"></div>
       <div class="card-head" style="margin-bottom:6px"><h2>Облачная копия GitHub</h2><span class="badge">не подключена</span></div>
       <p class="tiny muted">Копия будет сама уходить в секретный GitHub Gist раз в месяц — данные переживут потерю или поломку телефона.</p>
       <label class="field mt12"><span>Токен GitHub (право «gist»)</span><input id="cloud-token" type="password" placeholder="ghp_..." autocomplete="off" autocapitalize="off" spellcheck="false"></label>
       <button class="btn primary block" type="button" data-action="cloud-connect">Подключить</button>
       <p class="tiny muted mt8">Создайте <a href="https://github.com/settings/tokens/new?scopes=gist&description=Zarabotok" target="_blank" rel="noopener" style="color:var(--accent)">классический токен</a> и отметьте только галочку «gist». Токен хранится только на этом телефоне.</p>
       <p class="tiny muted mt8"><b>Важно:</b> Gist не зашифрован. Он не попадает в поиск, но открывается по прямой ссылке — не публикуйте её и не передавайте токен.</p>`;

  const backupCardHtml = `<div class="section-title">Резервные копии</div>
    <div class="card" id="backup-card">
      <div class="card-head"><h2>Автокопия</h2><span class="badge ok">каждый месяц</span></div>
      <p class="tiny muted">Приложение сохраняет копию данных на телефоне. Текущий месяц обновляется при каждом запуске, прошлые месяцы остаются как история.</p>
      <div class="backup-status">
        <div><div class="k">На телефоне</div><div class="v">${esc(lastLocalText)}</div></div>
        <div><div class="k">Всего копий</div><div class="v">${backupInfo.count || 0}</div></div>
      </div>
      <div class="row-actions mt12">
        <button class="btn" type="button" data-action="backup-now">Сохранить</button>
        <button class="btn" type="button" data-action="backup-history">История</button>
      </div>
      ${cloudBlock}
    </div>

    <div class="section-title">Данные</div>`;

  el.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Ещё</h1>
        <div class="sub">Услуги, настройки и резервные копии</div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2>Каталог услуг</h2><button class="txt-btn" type="button" data-action="add-service">+ Добавить</button></div>
      ${data.services.length
        ? data.services.map((s) => `<div class="service-row">
            <button class="line" type="button" data-action="edit-service" data-id="${esc(s.id)}">
              <div class="grow"><div class="ttl">${esc(s.name)}</div><div class="dsc">подставляется в запись</div></div>
              <div class="val">${money(s.price)}</div>
            </button>
            <button class="raise-one" type="button" data-action="raise-one-price" data-id="${esc(s.id)}" aria-label="Повысить цену: ${esc(s.name)}" title="Повысить цену только этой услуги">+%</button>
          </div>`).join('')
        : `<p class="tiny muted">Добавьте частые услуги с ценой — при создании записи цена подставится автоматически, и заполнять станет быстрее.</p>`}
      ${data.services.length ? `<p class="tiny muted" style="margin:4px 2px 2px">Кнопка «+%» — повысить цену только этой услуги</p>` : ''}
      ${data.services.length ? `<div class="mt12">
        <button class="btn primary block" type="button" data-action="raise-prices">Повысить выбранные услуги</button>
        <button class="btn block" type="button" data-action="raise-all-prices" style="margin-top:8px">Повысить все цены</button>
      </div>
      ${priceUndoAvailable() ? '<button class="txt-btn" type="button" data-action="undo-prices">Отменить последнее изменение цен</button>' : ''}` : ''}
    </div>

    ${installBlock}

    <div class="card">
      <div class="card-head"><h2>Настройки</h2></div>
      <label class="field" style="margin-bottom:14px">
        <span>Валюта</span>
        <select id="currency-select">
          ${CURRENCIES.map((c) => `<option value="${esc(c.v)}" ${c.v === currency() ? 'selected' : ''}>${esc(c.n)} (${esc(c.v)})</option>`).join('')}
        </select>
      </label>
      <div class="field" style="margin-bottom:4px">
        <span>Начало недели</span>
        <div class="chips" style="padding-bottom:0">
          <button class="chip ${data.settings.weekStart === 1 ? 'active' : ''}" type="button" data-start="1">Понедельник</button>
          <button class="chip ${data.settings.weekStart === 0 ? 'active' : ''}" type="button" data-start="0">Воскресенье</button>
        </div>
      </div>
    </div>

    ${backupCardHtml}

    <div class="section-title">Сбор данных от сотрудников</div>
    <div class="card">
      <p class="tiny muted">Если сотрудники ведут учёт на своих телефонах: они нажимают «Отправить мои данные» и присылают файл. Здесь выберите эти файлы — записи объединятся с вашими, дубликаты не появятся.</p>
      <div class="mt12">
        <button class="btn block" type="button" data-action="share-data">Отправить мои данные</button>
        <button class="btn primary block" type="button" data-action="import-employees" style="margin-top:8px">Импортировать файлы</button>
      </div>
    </div>

    <div class="card" style="padding:4px 16px">
      <button class="line" type="button" data-action="export-csv">
        <div class="grow"><div class="ttl">Экспорт в CSV</div><div class="dsc">для Excel / Google Таблиц</div></div>${CHEV}
      </button>
      <button class="line" type="button" data-action="export-json">
        <div class="grow"><div class="ttl">Резервная копия (JSON)</div><div class="dsc">все записи, сотрудники, услуги</div></div>${CHEV}
      </button>
      <button class="line" type="button" data-action="import-json">
        <div class="grow"><div class="ttl">Импорт из JSON</div><div class="dsc">восстановить или перенести на другое устройство</div></div>${CHEV}
      </button>
      <button class="line" type="button" data-action="demo">
        <div class="grow"><div class="ttl">Заполнить примерами</div><div class="dsc">посмотреть, как всё выглядит</div></div>${CHEV}
      </button>
      <button class="line danger" type="button" data-action="clear">
        <div class="grow"><div class="ttl">Очистить всё</div><div class="dsc">удалить записи, сотрудников и услуги</div></div>${CHEV}
      </button>
    </div>

    <div class="card">
      <div class="card-head"><h2>О приложении</h2></div>
      <p class="tiny muted">
        «Заработок» — простой учёт оказанных услуг. В одну запись можно добавить несколько услуг, а приложение
        посчитает суммы за день, неделю, месяц и год, в том числе по каждому сотруднику.
      </p>
      <p class="tiny muted mt8">
        Все данные хранятся на этом устройстве. Раз в месяц приложение автоматически делает копию на телефоне,
        а при подключении GitHub — ещё и в секретный Gist. Копии можно скачать или восстановить в разделе
        «Ещё → Резервные копии».
      </p>
      <p class="tiny muted mt8">Версия ${APP_VERSION}</p>
      <button class="txt-btn" type="button" data-action="check-updates" style="padding-left:0">Проверить обновление</button>
    </div>
  `;
}

/* ---------------- общее обновление ---------------- */

function renderNav() {
  $$('.tab').forEach((btn) => btn.classList.toggle('active', btn.dataset.nav === ui.tab));
}

function renderAll() {
  renderHome();
  renderStaff();
  renderMore();
  if (ui.tab === 'records') renderRecords();
  renderNav();
}

function switchTab(tab) {
  if (!['home', 'records', 'staff', 'more'].includes(tab)) return;
  ui.tab = tab;
  $$('.view').forEach((v) => { v.hidden = v.dataset.view !== tab; });
  if (tab === 'home') renderHome();
  if (tab === 'records') renderRecords();
  if (tab === 'staff') renderStaff();
  if (tab === 'more') renderMore();
  renderNav();
  window.scrollTo(0, 0);
}

/* ---------------- шторки ---------------- */

function openSheet(html) {
  const root = $('#sheet-root');
  root.innerHTML = `<div class="sheet-backdrop" data-action="close-sheet"></div>
    <div class="sheet-wrap"><div class="sheet">${html}</div></div>`;
  document.body.classList.add('sheet-open');
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('open')));
}

function closeSheet() {
  const root = $('#sheet-root');
  if (!root || !root.classList.contains('open')) {
    if (root) root.innerHTML = '';
    document.body.classList.remove('sheet-open');
    return;
  }
  root.classList.remove('open');
  document.body.classList.remove('sheet-open');
  if (confirmResolver) { const r = confirmResolver; confirmResolver = null; r(false); }
  setTimeout(() => { if (!root.classList.contains('open')) root.innerHTML = ''; }, 260);
}

function askConfirm({ title, text, okText = 'Удалить', danger = true }) {
  return new Promise((resolve) => {
    confirmResolver = resolve;
    openSheet(`
      <div class="grab"></div>
      <div class="sheet-head"><h2>${esc(title)}</h2><button class="x" type="button" data-action="close-sheet" aria-label="Закрыть">${X_ICON}</button></div>
      <p class="tiny muted" style="font-size:14px">${esc(text)}</p>
      <div class="sheet-actions" style="margin-top:20px">
        <button class="btn" type="button" data-action="confirm-no">Отмена</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" type="button" data-action="confirm-yes">${esc(okText)}</button>
      </div>
      <div style="height:4px"></div>
    `);
  });
}

/* ---------------- запись ---------------- */

function itemRowHtml(item) {
  const it = item || { service: '', qty: 1, price: 0, amount: 0 };
  const priceValue = Number(it.price) > 0 ? it.price : '';
  const amount = round2((Number(it.price) || 0) * (Number(it.qty) || 1));
  return `<div class="item-row">
    <div class="item-head">
      <input name="item-service" list="service-options" placeholder="Название услуги" value="${esc(it.service || '')}" autocomplete="off">
      <button class="item-del" type="button" data-action="remove-item" aria-label="Убрать услугу">${X_ICON}</button>
    </div>
    <div class="item-grid">
      <label class="mini-field"><span>Цена, ${esc(currency())}</span><input name="item-price" inputmode="decimal" placeholder="0" value="${esc(priceValue)}"></label>
      <label class="mini-field"><span>Кол-во</span><input name="item-qty" inputmode="numeric" placeholder="1" value="${esc(it.qty || 1)}"></label>
      <div class="item-line"><span>Сумма</span><b class="item-sum">${money(amount)}</b></div>
    </div>
  </div>`;
}

function entrySheetHtml(entry) {
  const isEdit = !!entry;
  const date = entry ? entry.date : toKey(new Date());
  const employees = data.employees;
  const selected = sheetState.employeeId;
  const initialItems = entry && entry.items && entry.items.length
    ? entry.items
    : [{ service: '', qty: 1, price: 0, amount: 0 }];

  const empChips = employees.map((emp) => `
    <button class="chip ${selected === emp.id ? 'active' : ''}" type="button" data-pick-emp="${esc(emp.id)}">
      <span class="dot" style="background:${emp.color}"></span>${esc(emp.name)}
    </button>`).join('') +
    `<button class="chip ${!selected ? 'active' : ''}" type="button" data-pick-emp=""><span class="dot" style="background:#98a2b3"></span>Без сотрудника</button>`;

  return `
    <div class="grab"></div>
    <div class="sheet-head">
      <h2>${isEdit ? 'Изменить запись' : 'Новая запись'}</h2>
      <button class="x" type="button" data-action="close-sheet" aria-label="Закрыть">${X_ICON}</button>
    </div>
    <form id="entry-form" novalidate>
      <label class="field"><span>Дата</span><input type="date" name="date" value="${esc(date)}" required></label>

      <div class="field">
        <span>Сотрудник</span>
        <div class="chips wrap" style="padding-bottom:0">${empChips}</div>
      </div>

      <div class="field">
        <span>Услуги в записи</span>
        <div id="entry-items">${initialItems.map(itemRowHtml).join('')}</div>
        <button class="btn block" type="button" data-action="add-item">${PLUS_ICON} Добавить услугу</button>
        <datalist id="service-options">
          ${data.services.map((s) => `<option value="${esc(s.name)}"></option>`).join('')}
        </datalist>
      </div>

      <div class="total-line"><span>Итого <span id="entry-items-count" style="font-weight:600;opacity:.75"></span></span><b id="entry-total">${money(entry ? entry.amount : 0)}</b></div>

      <label class="field"><span>Заметка</span><input name="note" placeholder="Необязательно" value="${esc(entry ? entry.note : '')}" autocomplete="off"></label>

      <div class="sheet-actions">
        ${isEdit ? '<button class="btn danger" type="button" data-action="delete-entry">Удалить</button>' : ''}
        <button class="btn primary" type="submit">${isEdit ? 'Сохранить' : 'Добавить'}</button>
      </div>
      <div class="sheet-note">${isEdit ? 'Изменения сохранятся на этом устройстве' : 'Можно добавить несколько услуг в одну запись'}</div>
    </form>
  `;
}

function openEntrySheet(id, presetEmployeeId) {
  const entry = id ? data.entries.find((e) => e.id === id) : null;
  sheetState.type = 'entry';
  sheetState.id = entry ? entry.id : null;
  sheetState.employeeId = entry ? (entry.employeeId || '') : (presetEmployeeId !== undefined ? (presetEmployeeId || '') : (data.employees[0] ? data.employees[0].id : ''));
  openSheet(entrySheetHtml(entry));
  updateEntryTotal();
}

function updateEntryTotal() {
  const form = $('#entry-form');
  if (!form) return { total: 0, count: 0 };
  let total = 0;
  let count = 0;

  $$('.item-row', form).forEach((row) => {
    const price = parseAmount(row.querySelector('[name="item-price"]').value);
    const qty = parseAmount(row.querySelector('[name="item-qty"]').value) || 1;
    const amount = round2(price * qty);
    const sum = row.querySelector('.item-sum');
    if (sum) sum.textContent = money(amount);
    total = round2(total + amount);
    const name = row.querySelector('[name="item-service"]').value.trim();
    if (price > 0 || name) count += 1;
  });

  const out = $('#entry-total');
  if (out) out.textContent = money(total);
  const cnt = $('#entry-items-count');
  if (cnt) cnt.textContent = count ? `· ${count} ${plural(count, 'услуга', 'услуги', 'услуг')}` : '';
  return { total, count };
}

function addItemRow() {
  const wrap = $('#entry-items');
  if (!wrap) return;
  wrap.insertAdjacentHTML('beforeend', itemRowHtml(null));
  const rows = $$('.item-row', wrap);
  const last = rows[rows.length - 1];
  const input = last ? last.querySelector('[name="item-service"]') : null;
  if (input) input.focus();
  updateEntryTotal();
}

function removeItemRow(btn) {
  const row = btn.closest('.item-row');
  if (!row) return;
  const wrap = row.parentElement;
  if ($$('.item-row', wrap).length <= 1) {
    const service = row.querySelector('[name="item-service"]');
    const price = row.querySelector('[name="item-price"]');
    const qty = row.querySelector('[name="item-qty"]');
    if (service) service.value = '';
    if (price) price.value = '';
    if (qty) qty.value = '1';
  } else {
    row.remove();
  }
  updateEntryTotal();
}

function saveEntry(form) {
  const fd = new FormData(form);
  const date = String(fd.get('date') || '');
  const note = String(fd.get('note') || '').trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return toast('Укажите дату');

  const rows = $$('.item-row', form)
    .map((row) => ({
      service: row.querySelector('[name="item-service"]').value.trim(),
      price: round2(parseAmount(row.querySelector('[name="item-price"]').value)),
      qty: parseAmount(row.querySelector('[name="item-qty"]').value) || 1,
    }))
    .filter((it) => it.service || it.price > 0);

  if (!rows.length) return toast('Добавьте хотя бы одну услугу');
  const noPrice = rows.find((it) => !(it.price > 0));
  if (noPrice) return toast(`Укажите цену: ${noPrice.service || 'услуга'}`);

  const items = rows.map((it) => ({
    service: it.service || 'Услуга',
    qty: it.qty,
    price: it.price,
    amount: round2(it.price * it.qty),
  }));
  const amount = round2(items.reduce((sum, it) => sum + it.amount, 0));
  const payload = {
    date,
    employeeId: sheetState.employeeId || null,
    items,
    amount,
    note,
  };

  if (sheetState.id) {
    const entry = data.entries.find((e) => e.id === sheetState.id);
    if (entry) Object.assign(entry, payload, { updatedAt: Date.now() });
    toast('Запись сохранена');
  } else {
    data.entries.push(Object.assign({ id: uid(), createdAt: Date.now() }, payload));
    toast('Запись добавлена');
  }

  save();
  closeSheet();
  ui.anchor = fromKey(date);
  ui.recordsMonth = new Date(fromKey(date).getFullYear(), fromKey(date).getMonth(), 1);
  renderAll();
}

async function deleteEntry() {
  if (!sheetState.id) return;
  const ok = await askConfirm({
    title: 'Удалить запись?',
    text: 'Запись будет удалена без возможности восстановления.',
    okText: 'Удалить',
  });
  if (!ok) return;
  data.entries = data.entries.filter((e) => e.id !== sheetState.id);
  save();
  closeSheet();
  renderAll();
  toast('Запись удалена');
}

/* ---------------- сотрудники ---------------- */

function openEmployeeSheet(id) {
  const emp = id ? employeeById(id) : null;
  sheetState.type = 'employee';
  sheetState.id = emp ? emp.id : null;
  sheetState.color = emp ? emp.color : PALETTE[data.employees.length % PALETTE.length];
  openSheet(`
    <div class="grab"></div>
    <div class="sheet-head">
      <h2>${emp ? 'Сотрудник' : 'Новый сотрудник'}</h2>
      <button class="x" type="button" data-action="close-sheet" aria-label="Закрыть">${X_ICON}</button>
    </div>
    <form id="employee-form" novalidate>
      <label class="field"><span>Имя</span><input name="name" value="${esc(emp ? emp.name : '')}" placeholder="Например, Анна" autocomplete="off" enterkeyhint="done"></label>
      <div class="field"><span>Цвет</span>
        <div class="colors">
          ${PALETTE.map((c) => `<button type="button" class="color-dot ${c === sheetState.color ? 'sel' : ''}" style="background:${c}" data-color="${c}" aria-label="Цвет ${c}"></button>`).join('')}
        </div>
      </div>
      <div class="sheet-actions">
        ${emp ? '<button class="btn danger" type="button" data-action="delete-employee">Удалить</button>' : ''}
        <button class="btn primary" type="submit">Сохранить</button>
      </div>
      ${emp ? '<div class="sheet-note">При удалении записи сотрудника сохранятся, но станут «Без сотрудника»</div>' : ''}
    </form>
  `);
}

function saveEmployee(form) {
  const name = String(new FormData(form).get('name') || '').trim();
  if (!name) return toast('Введите имя');

  if (sheetState.id) {
    const emp = employeeById(sheetState.id);
    if (emp) { emp.name = name; emp.color = sheetState.color; }
    toast('Сохранено');
  } else {
    data.employees.push({ id: uid(), name, color: sheetState.color, createdAt: Date.now() });
    toast('Сотрудник добавлен');
  }
  save();
  closeSheet();
  renderAll();
}

async function deleteEmployee() {
  const emp = employeeById(sheetState.id);
  if (!emp) return;
  const ok = await askConfirm({
    title: `Удалить «${emp.name}»?`,
    text: 'Записи этого сотрудника сохранятся, но останутся без привязки к сотруднику.',
    okText: 'Удалить',
  });
  if (!ok) return;
  data.employees = data.employees.filter((e) => e.id !== emp.id);
  data.entries.forEach((e) => { if (e.employeeId === emp.id) e.employeeId = null; });
  if (ui.recordsEmployee === emp.id) ui.recordsEmployee = 'all';
  save();
  closeSheet();
  renderAll();
  toast('Сотрудник удалён');
}

/* ---------------- услуги ---------------- */

function openServiceSheet(id) {
  const svc = id ? data.services.find((s) => s.id === id) : null;
  sheetState.type = 'service';
  sheetState.id = svc ? svc.id : null;
  openSheet(`
    <div class="grab"></div>
    <div class="sheet-head">
      <h2>${svc ? 'Услуга' : 'Новая услуга'}</h2>
      <button class="x" type="button" data-action="close-sheet" aria-label="Закрыть">${X_ICON}</button>
    </div>
    <form id="service-form" novalidate>
      <label class="field"><span>Название</span><input name="name" value="${esc(svc ? svc.name : '')}" placeholder="Например, стрижка" autocomplete="off"></label>
      <label class="field"><span>Цена, ${esc(currency())}</span><input name="price" inputmode="decimal" placeholder="0" value="${esc(svc ? svc.price : '')}"></label>
      ${svc ? `<div class="quick-raise">
        <span>Повысить цену</span>
        <div class="chips" style="padding-bottom:0">
          ${[5, 10, 15, 20].map((p) => `<button class="chip" type="button" data-quick-raise="${p}">+${p}%</button>`).join('')}
        </div>
      </div>` : ''}
      <div class="sheet-actions">
        ${svc ? '<button class="btn danger" type="button" data-action="delete-service">Удалить</button>' : ''}
        <button class="btn primary" type="submit">Сохранить</button>
      </div>
    </form>
  `);
}

function saveService(form) {
  const fd = new FormData(form);
  const name = String(fd.get('name') || '').trim();
  const price = round2(parseAmount(fd.get('price')));
  if (!name) return toast('Введите название услуги');
  if (sheetState.id) {
    const svc = data.services.find((s) => s.id === sheetState.id);
    if (svc) {
      if (svc.price !== price) clearPriceUndo();
      svc.name = name;
      svc.price = price;
    }
    toast('Услуга сохранена');
  } else {
    data.services.push({ id: uid(), name, price });
    toast('Услуга добавлена');
  }
  save();
  closeSheet();
  renderMore();
}

async function deleteService() {
  const svc = data.services.find((s) => s.id === sheetState.id);
  if (!svc) return;
  const ok = await askConfirm({
    title: `Удалить «${svc.name}»?`,
    text: 'Услуга исчезнет из каталога. Уже созданные записи не изменятся.',
    okText: 'Удалить',
  });
  if (!ok) return;
  data.services = data.services.filter((s) => s.id !== svc.id);
  save();
  closeSheet();
  renderMore();
  toast('Услуга удалена');
}

/* ---------------- массовое изменение цен ---------------- */

let priceUndo = loadPriceUndo();
const priceRaise = { mode: 'percent', value: 10, round: 0, selected: new Set() };

function loadPriceUndo() {
  try { return JSON.parse(localStorage.getItem(PRICE_UNDO_KEY) || 'null'); } catch (err) { return null; }
}

function clearPriceUndo() {
  try { localStorage.removeItem(PRICE_UNDO_KEY); } catch (err) { /* ignore */ }
  priceUndo = null;
}

function priceUndoAvailable() {
  if (!priceUndo || !Array.isArray(priceUndo.prices)) return false;
  return data.services.some((s) => {
    const old = priceUndo.prices.find((p) => p.id === s.id);
    return old && old.price !== s.price;
  });
}

function calcNewPrice(price) {
  const value = Number(priceRaise.value) || 0;
  let next = priceRaise.mode === 'percent' ? price * (1 + value / 100) : price + value;
  const step = Number(priceRaise.round) || 0;
  if (step > 0) next = Math.round(next / step) * step;
  return Math.max(0, round2(next));
}

function priceChangedCount() {
  return data.services.filter((s) => priceRaise.selected.has(s.id) && calcNewPrice(s.price) !== s.price).length;
}

function priceRowValHtml(s, on) {
  const next = calcNewPrice(s.price);
  const changed = on && next !== s.price;
  return `${changed ? `<span class="price-old">${money(s.price)}</span><span class="price-arrow">→</span>` : ''}
    <span class="${changed ? 'price-new' : ''}">${money(on ? next : s.price)}</span>`;
}

function pricePreviewHtml() {
  if (!data.services.length) {
    return '<div class="empty" style="padding:18px"><div class="d">В каталоге пока нет услуг</div></div>';
  }
  return data.services.map((s) => {
    const on = priceRaise.selected.has(s.id);
    return `<label class="line price-row ${on ? '' : 'off'}" data-service-id="${esc(s.id)}">
      <input type="checkbox" data-price-service="${esc(s.id)}" ${on ? 'checked' : ''}>
      <div class="grow"><div class="ttl">${esc(s.name)}</div></div>
      <div class="val price-val" style="font-size:13px">${priceRowValHtml(s, on)}</div>
    </label>`;
  }).join('');
}

function pricePresetsHtml() {
  const list = priceRaise.mode === 'percent' ? [5, 10, 15, 20] : [100, 200, 500, 1000];
  return list.map((v) => `<button class="chip" type="button" data-price-preset="${v}">${priceRaise.mode === 'percent' ? `+${v}%` : `+${nfInt.format(v)} ${currency()}`}</button>`).join('');
}

function priceIntroText() {
  const count = priceRaise.selected.size;
  if (!count) return 'Отметьте услуги, на которые нужно повысить цену. Записи и суммы за прошлые дни не изменятся.';
  if (count === data.services.length) return 'Отмечены все услуги. Записи и суммы за прошлые дни не изменятся.';
  if (count === 1) {
    const one = data.services.find((s) => priceRaise.selected.has(s.id));
    return `Отмечена только «${one ? one.name : 'услуга'}». Изменятся только отмеченные услуги, записи и суммы за прошлые дни не изменятся.`;
  }
  return `Отмечено услуг: ${count} из ${data.services.length}. Изменятся только отмеченные, записи и суммы за прошлые дни не изменятся.`;
}

function priceSheetHtml() {
  const isPercent = priceRaise.mode === 'percent';
  const roundOptions = [
    [0, 'Без округления'],
    [1, 'До целого'],
    [10, 'До 10'],
    [50, 'До 50'],
    [100, 'До 100'],
  ].map(([v, label]) => `<option value="${v}" ${Number(priceRaise.round) === v ? 'selected' : ''}>${label}</option>`).join('');

  return `
    <div class="grab"></div>
    <div class="sheet-head">
      <h2 id="price-title">${priceRaise.selected.size === 1 ? 'Повышение цены' : 'Повышение цен'}</h2>
      <button class="x" type="button" data-action="close-sheet" aria-label="Закрыть">${X_ICON}</button>
    </div>
    <p class="tiny muted" id="price-intro">${priceIntroText()}</p>

    <div class="segmented" style="grid-template-columns:1fr 1fr;margin:14px 0 10px">
      <button type="button" data-price-mode="percent" class="${isPercent ? 'active' : ''}">Процент</button>
      <button type="button" data-price-mode="amount" class="${!isPercent ? 'active' : ''}">Сумма</button>
    </div>

    <form id="price-form" novalidate>
      <label class="field">
        <span id="price-value-label">${isPercent ? 'На сколько процентов' : `На сколько ${esc(currency())}`}</span>
        <input name="value" inputmode="decimal" value="${esc(priceRaise.value)}" placeholder="${isPercent ? '10' : '100'}">
      </label>

      <div class="chips" id="price-presets" style="padding-bottom:12px">${pricePresetsHtml()}</div>

      <label class="field">
        <span>Округлить новые цены</span>
        <select name="round">${roundOptions}</select>
      </label>

      <div class="price-select-head">
        <span id="price-selected-count">Выбрано: ${priceRaise.selected.size} из ${data.services.length}</span>
        <div class="price-select-actions">
          <button type="button" data-price-select="all">Все</button>
          <button type="button" data-price-select="none">Ничего</button>
        </div>
      </div>

      <div class="card" id="price-preview" style="margin:0 0 12px;padding:2px 14px;max-height:250px;overflow:auto">${pricePreviewHtml()}</div>

      <div class="total-line"><span>Изменится услуг</span><b id="price-count">${priceChangedCount()} из ${data.services.length}</b></div>

      <div class="sheet-actions">
        <button class="btn" type="button" data-action="close-sheet">Отмена</button>
        <button class="btn primary" type="submit" id="price-apply" ${priceRaise.selected.size ? '' : 'disabled'}>Применить</button>
      </div>
      <div class="sheet-note">Изменение можно отменить в каталоге услуг</div>
    </form>
  `;
}

function openPriceSheet(preselect) {
  if (!data.services.length) return toast('Сначала добавьте услуги в каталог');
  sheetState.type = 'price';
  sheetState.id = null;
  priceRaise.mode = 'percent';
  priceRaise.value = 10;
  priceRaise.round = 0;

  if (preselect === 'all') {
    priceRaise.selected = new Set(data.services.map((s) => s.id));
  } else if (preselect && data.services.some((s) => s.id === preselect)) {
    priceRaise.selected = new Set([preselect]);
  } else {
    priceRaise.selected = new Set();
  }

  openSheet(priceSheetHtml());
}

function refreshPriceUi() {
  const count = $('#price-count');
  if (count) count.textContent = `${priceChangedCount()} из ${data.services.length}`;
  const selected = $('#price-selected-count');
  if (selected) selected.textContent = `Выбрано: ${priceRaise.selected.size} из ${data.services.length}`;
  const apply = $('#price-apply');
  if (apply) apply.disabled = priceRaise.selected.size === 0;
  const title = $('#price-title');
  if (title) title.textContent = priceRaise.selected.size === 1 ? 'Повышение цены' : 'Повышение цен';
  const intro = $('#price-intro');
  if (intro) intro.textContent = priceIntroText();
}

function renderPricePreview() {
  const preview = $('#price-preview');
  if (preview) preview.innerHTML = pricePreviewHtml();
  refreshPriceUi();
}

// Обновление галочек без перерисовки списка: иначе клик по строке срабатывает дважды.
function renderPriceSelection() {
  $$('.price-row').forEach((row) => {
    const id = row.dataset.serviceId;
    const on = priceRaise.selected.has(id);
    const checkbox = row.querySelector('[data-price-service]');
    if (checkbox) checkbox.checked = on;
    row.classList.toggle('off', !on);
    const svc = data.services.find((s) => s.id === id);
    const val = row.querySelector('.price-val');
    if (svc && val) val.innerHTML = priceRowValHtml(svc, on);
  });
  refreshPriceUi();
}

function syncPriceForm() {
  const form = $('#price-form');
  if (!form) return;
  priceRaise.value = parseAmount(form.querySelector('[name="value"]').value);
  priceRaise.round = Number(form.querySelector('[name="round"]').value) || 0;
  renderPricePreview();
}

function setPriceMode(mode) {
  priceRaise.mode = mode;
  syncPriceForm();
  $$('[data-price-mode]').forEach((b) => b.classList.toggle('active', b.dataset.priceMode === mode));
  const label = $('#price-value-label');
  if (label) label.textContent = mode === 'percent' ? 'На сколько процентов' : `На сколько ${currency()}`;
  const presets = $('#price-presets');
  if (presets) presets.innerHTML = pricePresetsHtml();
  const input = $('#price-form [name="value"]');
  if (input) input.placeholder = mode === 'percent' ? '10' : '100';
  syncPriceForm();
}

function applyPricePreset(value) {
  const input = $('#price-form [name="value"]');
  if (input) input.value = value;
  syncPriceForm();
}

function applyPriceChange() {
  syncPriceForm();
  if (!priceRaise.value) return toast('Укажите, на сколько изменить цены');
  if (!priceRaise.selected.size) return toast('Выберите хотя бы одну услугу');
  const changes = data.services.filter((s) => priceRaise.selected.has(s.id) && calcNewPrice(s.price) !== s.price);
  if (!changes.length) return toast('Цены не изменились');

  try {
    localStorage.setItem(PRICE_UNDO_KEY, JSON.stringify({
      at: Date.now(),
      prices: data.services.map((s) => ({ id: s.id, price: s.price })),
    }));
  } catch (err) { /* ignore */ }
  priceUndo = loadPriceUndo();

  for (const svc of changes) svc.price = calcNewPrice(svc.price);
  save();
  closeSheet();
  renderMore();
  toast(`Обновлено услуг: ${changes.length}`);
}

function undoPriceChange() {
  const rec = loadPriceUndo();
  if (!rec || !Array.isArray(rec.prices)) return toast('Нечего отменять');
  let restored = 0;
  for (const item of rec.prices) {
    const svc = data.services.find((s) => s.id === item.id);
    if (svc && svc.price !== item.price) {
      svc.price = item.price;
      restored += 1;
    }
  }
  clearPriceUndo();
  save();
  renderMore();
  toast(restored ? 'Прежние цены восстановлены' : 'Цены уже прежние');
}

/* ---------------- обмен данными с сотрудниками ---------------- */

let importState = { files: [], groups: [] };

function loadImportMap() {
  try { return JSON.parse(localStorage.getItem(IMPORT_MAP_KEY) || '{}'); } catch (err) { return {}; }
}

function saveImportMap(map) {
  try { localStorage.setItem(IMPORT_MAP_KEY, JSON.stringify(map)); } catch (err) { /* ignore */ }
}

function shortDate(key) {
  const d = fromKey(key);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(-2)}`;
}

function importRange(group) {
  return group.from === group.to
    ? shortDate(group.from)
    : `${shortDate(group.from)} – ${shortDate(group.to)}`;
}

async function shareMyData() {
  if (!data.entries.length) return toast('Пока нет записей для отправки');

  const payload = {
    format: 'zarabotok-share',
    version: 1,
    exportedAt: Date.now(),
    employees: data.employees,
    services: data.services,
    entries: data.entries,
  };
  const json = JSON.stringify(payload);
  const who = data.employees.map((e) => e.name).join('-') || 'zarabotok';
  const safe = who.replace(/[^\wа-яА-ЯёЁ-]+/g, '-').slice(0, 40) || 'zarabotok';
  const filename = `zarabotok-${safe}-${toKey(new Date())}.json`;

  try {
    if (typeof File !== 'undefined' && navigator.canShare) {
      const file = new File([json], filename, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Данные заработка', text: 'Файл для руководителя' });
        toast('Файл отправлен');
        return;
      }
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return;
    console.warn('Не удалось поделиться файлом', err);
  }

  download(filename, json, 'application/json');
  toast('Файл сохранён — отправьте его руководителю');
}

function importFromEmployees() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.multiple = true;
  input.onchange = () => {
    const files = Array.from(input.files || []);
    if (files.length) openImportFromFiles(files);
  };
  input.click();
}

async function openImportFromFiles(files) {
  const parsed = [];
  for (const file of files) {
    try {
      const text = await file.text();
      const obj = JSON.parse(text);
      const norm = normalize(obj);
      if (!norm.entries.length) continue;
      parsed.push({ name: file.name, data: norm });
    } catch (err) {
      console.warn('Не удалось прочитать файл', file.name, err);
    }
  }
  if (!parsed.length) return toast('В выбранных файлах нет записей');

  importState = { files: parsed, groups: buildImportGroups(parsed) };
  openSheet(importSheetHtml(parsed, importState.groups, loadImportMap()));
}

function buildImportGroups(files) {
  const groups = [];
  files.forEach((file, index) => {
    const employees = new Map((file.data.employees || []).map((e) => [e.id, e]));
    const byEmployee = new Map();

    for (const entry of file.data.entries) {
      const key = `${index}:${entry.employeeId || 'none'}`;
      if (!byEmployee.has(key)) {
        const emp = entry.employeeId ? employees.get(entry.employeeId) : null;
        byEmployee.set(key, {
          key,
          name: emp ? emp.name : 'Без сотрудника',
          file: file.name,
          entries: [],
        });
      }
      byEmployee.get(key).entries.push(entry);
    }

    for (const group of byEmployee.values()) {
      const dates = group.entries.map((e) => e.date).sort();
      group.total = round2(group.entries.reduce((sum, e) => sum + e.amount, 0));
      group.count = group.entries.length;
      group.from = dates[0];
      group.to = dates[dates.length - 1];
      groups.push(group);
    }
  });
  return groups;
}

function defaultImportTarget(name, map) {
  if (name === 'Без сотрудника') return 'none';
  const saved = map[name];
  if (saved && data.employees.some((e) => e.id === saved)) return `emp:${saved}`;
  if (name && name !== 'Я') {
    const match = data.employees.find((e) => e.name.toLowerCase() === name.toLowerCase());
    if (match) return `emp:${match.id}`;
  }
  return 'new';
}

function importSheetHtml(files, groups, map) {
  const rows = groups.map((group) => {
    const selected = defaultImportTarget(group.name, map);
    const newName = group.name === 'Я' || group.name === 'Без сотрудника' ? '' : group.name;
    const options = [
      `<option value="new" ${selected === 'new' ? 'selected' : ''}>Создать сотрудника</option>`,
      ...data.employees.map((emp) => `<option value="emp:${esc(emp.id)}" ${selected === `emp:${emp.id}` ? 'selected' : ''}>${esc(emp.name)}</option>`),
      `<option value="none" ${selected === 'none' ? 'selected' : ''}>Без сотрудника</option>`,
      `<option value="skip" ${selected === 'skip' ? 'selected' : ''}>Не импортировать</option>`,
    ].join('');

    return `<div class="import-group" data-key="${esc(group.key)}">
      <div class="ttl">${esc(group.name)}</div>
      <div class="dsc">${group.count} ${plural(group.count, 'запись', 'записи', 'записей')} · ${money(group.total)} · ${esc(importRange(group))}</div>
      <div class="dsc">${esc(group.file)}</div>
      <select name="target" data-import-target>${options}</select>
      <input class="import-name" name="new-name" placeholder="Имя нового сотрудника" value="${esc(newName)}" style="${selected === 'new' ? '' : 'display:none'}">
    </div>`;
  }).join('');

  return `
    <div class="grab"></div>
    <div class="sheet-head">
      <h2>Импорт от сотрудников</h2>
      <button class="x" type="button" data-action="close-sheet" aria-label="Закрыть">${X_ICON}</button>
    </div>
    <p class="tiny muted">Проверьте, кому принадлежат записи. Из файлов добавятся записи и недостающие услуги; настройки и сотрудники из чужого телефона не затрагиваются. Повторный импорт не создаёт дубликаты.</p>
    ${files.length > 1 ? `<p class="tiny muted mt8">Файлов: ${files.length}</p>` : ''}
    <form id="import-form" novalidate>
      <div class="mt12">${rows}</div>
      <label class="check-row"><input type="checkbox" name="overwrite"> Обновлять уже импортированные записи</label>
      <div class="sheet-actions">
        <button class="btn" type="button" data-action="close-sheet">Отмена</button>
        <button class="btn primary" type="submit">Импортировать</button>
      </div>
      <div class="sheet-note">Импортированные записи появятся в общих итогах и в разделе «Сотрудники»</div>
    </form>
  `;
}

function toggleImportName(select) {
  const row = select.closest('.import-group');
  const input = row ? row.querySelector('.import-name') : null;
  if (!input) return;
  const isNew = select.value === 'new';
  input.style.display = isNew ? '' : 'none';
  if (isNew) input.focus();
}

function applyImport(form) {
  const overwrite = !!form.querySelector('[name="overwrite"]').checked;
  const map = loadImportMap();
  const plans = [];

  for (const row of $$('.import-group', form)) {
    const group = importState.groups.find((g) => g.key === row.dataset.key);
    if (!group) continue;
    const select = row.querySelector('[name="target"]');
    const value = select.value;
    if (value === 'skip') continue;

    let targetId = null;
    if (value === 'new') {
      const input = row.querySelector('[name="new-name"]');
      const name = input ? input.value.trim() : '';
      if (!name) {
        if (input) input.focus();
        return toast('Укажите имя сотрудника');
      }
      const emp = {
        id: uid(),
        name,
        color: PALETTE[data.employees.length % PALETTE.length],
        createdAt: Date.now(),
      };
      data.employees.push(emp);
      targetId = emp.id;
    } else if (value === 'none') {
      targetId = null;
    } else if (value.startsWith('emp:')) {
      targetId = value.slice(4);
    }

    plans.push({ group, targetId, name: group.name });
  }

  if (!plans.length) return toast('Все сотрудники пропущены');

  let addedServices = 0;
  for (const file of importState.files) {
    for (const svc of file.data.services || []) {
      if (!data.services.some((s) => s.name.toLowerCase() === svc.name.toLowerCase())) {
        data.services.push({ id: uid(), name: svc.name, price: round2(svc.price) });
        addedServices += 1;
      }
    }
  }

  const existing = new Map(data.entries.map((e) => [e.id, e]));
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const plan of plans) {
    for (const entry of plan.group.entries) {
      const copy = Object.assign({}, entry, { employeeId: plan.targetId });
      if (!existing.has(entry.id)) {
        data.entries.push(copy);
        existing.set(entry.id, copy);
        added += 1;
      } else if (overwrite) {
        Object.assign(existing.get(entry.id), copy);
        updated += 1;
      } else {
        skipped += 1;
      }
    }
    if (plan.name && plan.name !== 'Я' && plan.name !== 'Без сотрудника' && plan.targetId) {
      map[plan.name] = plan.targetId;
    }
  }

  saveImportMap(map);
  save();
  closeSheet();
  ui.anchor = new Date();
  renderAll();

  const parts = [];
  if (added) parts.push(`добавлено ${added}`);
  if (updated) parts.push(`обновлено ${updated}`);
  if (skipped) parts.push(`пропущено ${skipped}`);
  if (addedServices) parts.push(`услуг ${addedServices}`);
  toast(parts.length ? parts.join(' · ') : 'Новых записей нет');
}

/* ---------------- резервные копии ---------------- */

const DOWN_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10m0 0 4-4m-4 4-4-4M5 19h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const RESTORE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10a8 8 0 1 1 2.3 6.7M4 5v5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

let cloud = loadCloud();

function loadCloud() {
  const base = { token: '', gistId: '', lastAt: 0, month: '', enabled: true, error: '' };
  try {
    return Object.assign(base, JSON.parse(localStorage.getItem(CLOUD_KEY) || '{}'));
  } catch (err) {
    return base;
  }
}

function saveCloud() {
  try { localStorage.setItem(CLOUD_KEY, JSON.stringify(cloud)); } catch (err) { /* ignore */ }
}

const backupInfo = { ready: false, count: 0, lastAt: 0, lastId: '', busy: false, error: '' };

/* --- локальные снимки в IndexedDB --- */

let dbPromise = null;

function getDb() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB недоступен'));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('zarabotok_backups', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('snapshots')) db.createObjectStore('snapshots', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function dbRun(mode, fn) {
  return getDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction('snapshots', mode);
    const req = fn(tx.objectStore('snapshots'));
    let value;
    if (req) req.onsuccess = () => { value = req.result; };
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Транзакция отменена'));
  }));
}

const dbAll = () => dbRun('readonly', (s) => s.getAll());
const dbGet = (id) => dbRun('readonly', (s) => s.get(id));
const dbPut = (rec) => dbRun('readwrite', (s) => s.put(rec));
const dbDel = (id) => dbRun('readwrite', (s) => s.delete(id));

function snapshotTitle(s) {
  if (/^\d{4}-\d{2}$/.test(s.id)) {
    const [y, m] = s.id.split('-').map(Number);
    return `${MONTHS_NOM[m - 1]} ${y}`;
  }
  return fmtDateTime(s.at);
}

function snapshotSize(s) {
  const kb = Math.max(1, Math.round((s.json || '').length / 1024));
  return kb > 1024 ? `${(kb / 1024).toFixed(1)} МБ` : `${kb} КБ`;
}

async function refreshBackupInfo() {
  try {
    const list = (await dbAll()).sort((a, b) => b.at - a.at);
    backupInfo.count = list.length;
    backupInfo.lastAt = list[0] ? list[0].at : 0;
    backupInfo.lastId = list[0] ? list[0].id : '';
    backupInfo.error = '';
  } catch (err) {
    backupInfo.error = err && err.message ? err.message : String(err);
  }
  backupInfo.ready = true;
}

async function pruneSnapshots() {
  const list = (await dbAll()).sort((a, b) => b.at - a.at);
  const autos = list.filter((s) => s.kind === 'auto');
  for (const s of autos.slice(12)) await dbDel(s.id);
  const rest = (await dbAll()).sort((a, b) => b.at - a.at);
  for (const s of rest.slice(24)) await dbDel(s.id);
}

let snapshotTimer = null;
let snapshotsPaused = false;

function scheduleSnapshot() {
  if (snapshotsPaused) return;
  clearTimeout(snapshotTimer);
  snapshotTimer = setTimeout(() => { refreshCurrentSnapshot(); }, 1200);
}

async function refreshCurrentSnapshot() {
  try {
    const month = toKey(new Date()).slice(0, 7);
    const json = JSON.stringify(data);
    const existing = await dbGet(month);
    if (existing && existing.json === json) return;
    await dbPut({ id: month, at: Date.now(), kind: 'auto', json });
    await refreshBackupInfo();
  } catch (err) {
    /* копию обновим при следующем запуске */
  }
}

async function autoMonthlyBackup() {
  const month = toKey(new Date()).slice(0, 7);
  try {
    const json = JSON.stringify(data);
    const existing = await dbGet(month);
    if (!existing) {
      await dbPut({ id: month, at: Date.now(), kind: 'auto', json });
    } else if (existing.json !== json) {
      await dbPut({ id: month, at: Date.now(), kind: 'auto', json });
    }
    await pruneSnapshots();
  } catch (err) {
    console.warn('Автокопия не создана', err);
  }
  await refreshBackupInfo();

  if (cloud.token && cloud.enabled && cloud.month !== month && !backupInfo.busy) {
    cloudBackup({ silent: true });
  }
  if (ui.tab === 'home') renderHome();
  if (ui.tab === 'more') renderMore();
}

async function manualBackup() {
  try {
    await dbPut({ id: 'manual-' + Date.now(), at: Date.now(), kind: 'manual', json: JSON.stringify(data) });
    await pruneSnapshots();
    await refreshBackupInfo();
    renderMore();
    renderHome();
    toast('Копия сохранена на телефоне');
  } catch (err) {
    toast('Не удалось сохранить копию');
  }
}

async function downloadLatest() {
  try {
    const month = toKey(new Date()).slice(0, 7);
    const rec = (await dbGet(month)) || (await dbAll()).sort((a, b) => b.at - a.at)[0];
    if (!rec) return toast('Копий пока нет');
    download(`zarabotok-${rec.id}.json`, rec.json, 'application/json');
  } catch (err) {
    toast('Не удалось скачать копию');
  }
}

function dismissBackupPrompt() {
  try { localStorage.setItem(BACKUP_PROMPT_KEY, toKey(new Date()).slice(0, 7)); } catch (err) { /* ignore */ }
  renderHome();
}

function backupBannerHtml() {
  const month = toKey(new Date()).slice(0, 7);
  let dismissed = '';
  try { dismissed = localStorage.getItem(BACKUP_PROMPT_KEY) || ''; } catch (err) { /* ignore */ }
  if (!backupInfo.lastAt || cloud.token || dismissed === month) return '';
  return `<div class="notice">
    <div class="notice-ico">🛟</div>
    <div class="grow">
      <div class="notice-t">Копия за ${esc(MONTHS_NOM[new Date().getMonth()].toLowerCase())} сохранена</div>
      <div class="notice-d">Скачайте файл или включите облачную копию, чтобы данные не пропали вместе с телефоном.</div>
      <div class="notice-actions">
        <button class="btn small primary" type="button" data-action="download-latest">Скачать</button>
        <button class="btn small" type="button" data-action="open-cloud">Включить облако</button>
      </div>
    </div>
    <button class="notice-x" type="button" data-action="dismiss-backup" aria-label="Скрыть">${X_ICON}</button>
  </div>`;
}

/* --- облачная копия в GitHub Gist --- */

async function ghApi(path, options = {}) {
  const res = await fetch('https://api.github.com' + path, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + cloud.token,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (err) { json = null; }
  if (!res.ok) throw new Error((json && json.message) || 'HTTP ' + res.status);
  return json;
}

async function pushGist(content) {
  if (cloud.gistId) {
    try {
      await ghApi('/gists/' + cloud.gistId, {
        method: 'PATCH',
        body: JSON.stringify({ files: { 'zarabotok-backup.json': { content } } }),
      });
      return;
    } catch (err) {
      if (!/not found/i.test(err.message)) throw err;
      cloud.gistId = '';
    }
  }
  const gist = await ghApi('/gists', {
    method: 'POST',
    body: JSON.stringify({
      description: 'Заработок — автоматическая резервная копия',
      public: false,
      files: { 'zarabotok-backup.json': { content } },
    }),
  });
  cloud.gistId = gist.id;
}

async function cloudBackup({ silent = false } = {}) {
  if (!cloud.token) {
    if (!silent) toast('Сначала подключите GitHub');
    return false;
  }
  if (backupInfo.busy) return false;
  backupInfo.busy = true;
  try {
    await pushGist(JSON.stringify(data));
    cloud.month = toKey(new Date()).slice(0, 7);
    cloud.lastAt = Date.now();
    cloud.error = '';
    saveCloud();
    if (!silent) toast('Копия сохранена в GitHub');
    return true;
  } catch (err) {
    cloud.error = err.message || 'ошибка';
    saveCloud();
    if (!silent) toast('Не удалось: ' + cloud.error);
    return false;
  } finally {
    backupInfo.busy = false;
    if (ui.tab === 'more') renderMore();
    if (ui.tab === 'home') renderHome();
  }
}

async function connectCloud() {
  const input = $('#cloud-token');
  const token = input ? input.value.trim() : '';
  if (!token) return toast('Вставьте токен GitHub');
  const prev = cloud.token;
  cloud.token = token;
  cloud.error = '';
  try {
    const me = await ghApi('/user');
    cloud.enabled = true;
    cloud.month = '';
    saveCloud();
    const ok = await cloudBackup({ silent: true });
    toast(ok ? `GitHub подключён: ${me.login}` : 'Токен принят, но копия не создалась. Проверьте право «gist».');
    renderMore();
    renderHome();
  } catch (err) {
    cloud.token = prev;
    saveCloud();
    toast('Токен не подошёл');
  }
}

async function cloudRestore() {
  if (!cloud.token) return toast('Облачная копия не подключена');
  try {
    if (!cloud.gistId) {
      const gists = await ghApi('/gists?per_page=100');
      const found = (gists || []).find((g) => g.description === 'Заработок — автоматическая резервная копия');
      if (!found) return toast('Копия в GitHub не найдена');
      cloud.gistId = found.id;
      saveCloud();
    }
    const gist = await ghApi('/gists/' + cloud.gistId);
    const file = gist && gist.files && gist.files['zarabotok-backup.json'];
    if (!file) return toast('Файл копии не найден');
    let content = file.content || '';
    if (file.truncated && file.raw_url) {
      const res = await fetch(file.raw_url);
      content = await res.text();
    }
    const parsed = normalize(JSON.parse(content));
    const ok = await askConfirm({
      title: 'Восстановить из GitHub?',
      text: `Текущие данные будут заменены облачной копией от ${fmtDateTime(new Date(gist.updated_at).getTime())}.`,
      okText: 'Восстановить',
      danger: false,
    });
    if (!ok) return;
    await dbPut({ id: 'manual-' + Date.now(), at: Date.now(), kind: 'manual', json: JSON.stringify(data) });
    data = parsed;
    save();
    ui.anchor = new Date();
    ui.recordsMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    ui.recordsEmployee = 'all';
    ui.recordsQuery = '';
    renderAll();
    toast('Данные восстановлены из GitHub');
  } catch (err) {
    toast('Ошибка: ' + (err.message || 'не удалось восстановить'));
  }
}

async function cloudOff() {
  const ok = await askConfirm({
    title: 'Отключить облачную копию?',
    text: 'Токен будет удалён с этого устройства. Копии, которые уже есть в GitHub, останутся.',
    okText: 'Отключить',
  });
  if (!ok) return;
  cloud = { token: '', gistId: '', lastAt: 0, month: '', enabled: true, error: '' };
  saveCloud();
  renderMore();
  toast('Облачная копия отключена');
}

/* --- история копий --- */

async function openBackupHistory() {
  let list = [];
  try {
    list = (await dbAll()).sort((a, b) => b.at - a.at);
  } catch (err) {
    return toast('Не удалось прочитать копии');
  }
  if (!list.length) return toast('Копий пока нет');

  openSheet(`
    <div class="grab"></div>
    <div class="sheet-head">
      <h2>История копий</h2>
      <button class="x" type="button" data-action="close-sheet" aria-label="Закрыть">${X_ICON}</button>
    </div>
    <p class="tiny muted">Каждый месяц добавляется новая копия, текущий месяц обновляется при открытии приложения. Хранятся последние 12 месяцев.</p>
    <div class="card" style="margin-top:12px;padding:4px 14px">
      ${list.map((s) => `<div class="line">
        <div class="grow">
          <div class="ttl">${esc(snapshotTitle(s))}</div>
          <div class="dsc">${esc(fmtDateTime(s.at))} · ${esc(snapshotSize(s))}${s.kind === 'manual' ? ' · вручную' : ''}</div>
        </div>
        <button class="icon-btn plain sm" type="button" data-action="snapshot-download" data-id="${esc(s.id)}" aria-label="Скачать">${DOWN_ICON}</button>
        <button class="icon-btn plain sm" type="button" data-action="snapshot-restore" data-id="${esc(s.id)}" aria-label="Восстановить">${RESTORE_ICON}</button>
      </div>`).join('')}
    </div>
    <button class="btn danger block" type="button" data-action="snapshots-clear">Удалить все копии</button>
    <div class="sheet-note">Скачанный JSON можно восстановить кнопкой «Импорт из JSON»</div>
  `);
}

async function snapshotDownload(id) {
  try {
    const rec = await dbGet(id);
    if (!rec) return toast('Копия не найдена');
    download(`zarabotok-${rec.id}.json`, rec.json, 'application/json');
  } catch (err) {
    toast('Не удалось скачать');
  }
}

async function snapshotRestore(id) {
  let rec = null;
  try { rec = await dbGet(id); } catch (err) { /* ignore */ }
  if (!rec) return toast('Копия не найдена');
  const ok = await askConfirm({
    title: 'Восстановить копию?',
    text: `Текущие данные будут заменены копией «${snapshotTitle(rec)}». Перед заменой текущие данные сохранятся отдельно.`,
    okText: 'Восстановить',
    danger: false,
  });
  if (!ok) return;
  try {
    const parsed = normalize(JSON.parse(rec.json));
    await dbPut({ id: 'manual-' + Date.now(), at: Date.now(), kind: 'manual', json: JSON.stringify(data) });
    data = parsed;
    save();
    ui.anchor = new Date();
    ui.recordsMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    ui.recordsEmployee = 'all';
    ui.recordsQuery = '';
    renderAll();
    toast('Данные восстановлены');
  } catch (err) {
    toast('Копия повреждена');
  }
}

async function snapshotsClear() {
  const ok = await askConfirm({
    title: 'Удалить все копии?',
    text: 'Будут удалены все резервные копии на этом устройстве. Копии в GitHub останутся.',
    okText: 'Удалить',
  });
  if (!ok) return;
  try {
    const list = await dbAll();
    for (const s of list) await dbDel(s.id);
    await refreshBackupInfo();
    renderMore();
    closeSheet();
    toast('Копии удалены');
  } catch (err) {
    toast('Не удалось удалить копии');
  }
}

function openCloudSection() {
  switchTab('more');
  setTimeout(() => {
    const el = $('#backup-card');
    if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, 60);
}

/* ---------------- экспорт / импорт ---------------- */

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1500);
}

function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv() {
  const rows = [['Дата', 'Сотрудник', 'Услуга', 'Кол-во', 'Цена', 'Сумма', 'Заметка']];
  data.entries
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .forEach((e) => {
      const items = e.items && e.items.length
        ? e.items
        : [{ service: 'Услуга', qty: 1, price: e.amount, amount: e.amount }];
      items.forEach((it) => {
        rows.push([
          e.date,
          employeeName(e.employeeId),
          it.service,
          String(it.qty).replace('.', ','),
          String(round2(it.price)).replace('.', ','),
          String(round2(it.amount)).replace('.', ','),
          e.note || '',
        ]);
      });
    });
  const csv = '\uFEFF' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n');
  const stamp = toKey(new Date());
  download(`zarabotok-${stamp}.csv`, csv, 'text/csv;charset=utf-8');
  toast('CSV сохранён');
}

function exportJson() {
  const stamp = toKey(new Date());
  download(`zarabotok-backup-${stamp}.json`, JSON.stringify(data, null, 2), 'application/json');
  toast('Резервная копия сохранена');
}

function importJson() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = normalize(JSON.parse(text));
      const ok = await askConfirm({
        title: 'Импортировать данные?',
        text: `В файле ${parsed.entries.length} записей и ${parsed.employees.length} сотрудников. Новые данные добавятся к текущим, дубликаты записей не появятся.`,
        okText: 'Импортировать',
        danger: false,
      });
      if (!ok) return;

      const empIds = new Set(data.employees.map((e) => e.id));
      parsed.employees.forEach((e) => { if (!empIds.has(e.id)) { data.employees.push(e); empIds.add(e.id); } });
      const svcIds = new Set(data.services.map((s) => s.id));
      parsed.services.forEach((s) => { if (!svcIds.has(s.id)) { data.services.push(s); svcIds.add(s.id); } });
      const entryIds = new Set(data.entries.map((e) => e.id));
      parsed.entries.forEach((e) => { if (!entryIds.has(e.id)) { data.entries.push(e); entryIds.add(e.id); } });

      save();
      renderAll();
      toast('Данные импортированы');
    } catch (err) {
      console.error(err);
      toast('Не удалось прочитать файл');
    }
  };
  input.click();
}

function addDemo() {
  const demoServices = [
    { name: 'Стрижка', price: 1500 },
    { name: 'Окрашивание', price: 4500 },
    { name: 'Маникюр', price: 1800 },
    { name: 'Педикюр', price: 2200 },
    { name: 'Укладка', price: 1200 },
  ];
  const demoEmployees = ['Анна', 'Дмитрий', 'Ольга'];

  const emps = demoEmployees.map((name) => {
    let emp = data.employees.find((e) => e.name.toLowerCase() === name.toLowerCase());
    if (!emp) {
      emp = { id: uid(), name, color: PALETTE[data.employees.length % PALETTE.length], createdAt: Date.now() };
      data.employees.push(emp);
    }
    return emp;
  });

  demoServices.forEach((s) => {
    if (!data.services.some((x) => x.name.toLowerCase() === s.name.toLowerCase())) {
      data.services.push({ id: uid(), name: s.name, price: s.price });
    }
  });

  const today = startOfDay(new Date());
  for (let i = 60; i >= 0; i--) {
    const day = addDays(today, -i);
    if (day.getDay() === 0 && Math.random() < 0.6) continue;
    const count = 1 + Math.floor(Math.random() * 3);
    for (let j = 0; j < count; j++) {
      const emp = emps[Math.floor(Math.random() * emps.length)];
      const serviceCount = Math.random() < 0.35 ? 2 : 1;
      const items = [];
      for (let k = 0; k < serviceCount; k++) {
        const svc = demoServices[Math.floor(Math.random() * demoServices.length)];
        const qty = Math.random() < 0.15 ? 2 : 1;
        items.push({
          service: svc.name,
          qty,
          price: svc.price,
          amount: round2(svc.price * qty),
        });
      }
      data.entries.push({
        id: uid(),
        date: toKey(day),
        employeeId: emp.id,
        items,
        amount: round2(items.reduce((s, it) => s + it.amount, 0)),
        note: '',
        createdAt: day.getTime() + j * 3600000,
      });
    }
  }
  save();
  renderAll();
  toast('Добавлены примеры записей');
}

async function clearAll() {
  const ok = await askConfirm({
    title: 'Очистить все данные?',
    text: 'Будут удалены все записи, сотрудники, услуги и настройки. Это действие нельзя отменить.',
    okText: 'Очистить',
  });
  if (!ok) return;
  try {
    await dbPut({ id: 'manual-' + Date.now(), at: Date.now(), kind: 'manual', json: JSON.stringify(data) });
  } catch (err) { /* если хранилище недоступно — продолжаем */ }
  snapshotsPaused = true;
  try {
    data = defaultData();
    save();
  } finally {
    snapshotsPaused = false;
  }
  refreshBackupInfo();
  closeSheet();
  ui.anchor = new Date();
  ui.recordsMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  ui.recordsEmployee = 'all';
  ui.recordsQuery = '';
  renderAll();
  toast('Все данные удалены');
}

/* ---------------- тосты ---------------- */

let toastTimer = null;
function toast(text) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2300);
  if (navigator.vibrate) navigator.vibrate(8);
}

/* ---------------- события ---------------- */

document.addEventListener('click', (e) => {
  const navBtn = e.target.closest('[data-nav]');
  if (navBtn) {
    switchTab(navBtn.dataset.nav);
    return;
  }

  const empChip = e.target.closest('[data-pick-emp]');
  if (empChip) {
    sheetState.employeeId = empChip.dataset.pickEmp || '';
    const wrap = empChip.parentElement;
    if (wrap) $$('[data-pick-emp]', wrap).forEach((b) => b.classList.toggle('active', b === empChip));
    return;
  }

  const colorDot = e.target.closest('[data-color]');
  if (colorDot) {
    sheetState.color = colorDot.dataset.color;
    const wrap = colorDot.parentElement;
    if (wrap) $$('[data-color]', wrap).forEach((b) => b.classList.toggle('sel', b === colorDot));
    return;
  }

  const startChip = e.target.closest('[data-start]');
  if (startChip) {
    data.settings.weekStart = Number(startChip.dataset.start);
    save();
    renderMore();
    renderHome();
    return;
  }

  const priceMode = e.target.closest('[data-price-mode]');
  if (priceMode) {
    setPriceMode(priceMode.dataset.priceMode);
    return;
  }

  const pricePreset = e.target.closest('[data-price-preset]');
  if (pricePreset) {
    applyPricePreset(pricePreset.dataset.pricePreset);
    return;
  }

  const priceSelect = e.target.closest('[data-price-select]');
  if (priceSelect) {
    if (priceSelect.dataset.priceSelect === 'all') {
      priceRaise.selected = new Set(data.services.map((s) => s.id));
    } else {
      priceRaise.selected.clear();
    }
    renderPriceSelection();
    return;
  }

  const quickRaise = e.target.closest('[data-quick-raise]');
  if (quickRaise) {
    const form = $('#service-form');
    const input = form ? form.querySelector('[name="price"]') : null;
    if (!input) return;
    const base = parseAmount(input.value);
    if (!(base > 0)) return toast('Сначала укажите цену');
    const pct = Number(quickRaise.dataset.quickRaise) || 0;
    const next = round2(base * (1 + pct / 100));
    input.value = next;
    toast(`Новая цена: ${money(next)} · нажмите «Сохранить»`);
    return;
  }

  const periodBtn = e.target.closest('[data-period]');
  if (periodBtn) {
    ui.period = periodBtn.dataset.period;
    renderHome();
    return;
  }

  const filterChip = e.target.closest('[data-emp-filter]');
  if (filterChip) {
    ui.recordsEmployee = filterChip.dataset.empFilter;
    renderRecords();
    return;
  }

  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;

  switch (action) {
    case 'add-entry':
      openEntrySheet(null, btn.dataset.emp !== undefined ? btn.dataset.emp : undefined);
      break;
    case 'edit-entry':
      openEntrySheet(id);
      break;
    case 'delete-entry':
      deleteEntry();
      break;
    case 'add-item':
      addItemRow();
      break;
    case 'remove-item':
      removeItemRow(btn);
      break;
    case 'close-sheet':
      closeSheet();
      break;
    case 'period-prev':
      shiftPeriod(-1);
      renderHome();
      break;
    case 'period-next':
      shiftPeriod(1);
      renderHome();
      break;
    case 'period-today':
      ui.anchor = new Date();
      renderHome();
      break;
    case 'month-prev':
      ui.recordsMonth = new Date(ui.recordsMonth.getFullYear(), ui.recordsMonth.getMonth() - 1, 1);
      renderRecords();
      break;
    case 'month-next':
      ui.recordsMonth = new Date(ui.recordsMonth.getFullYear(), ui.recordsMonth.getMonth() + 1, 1);
      renderRecords();
      break;
    case 'month-today':
      ui.recordsMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      renderRecords();
      break;
    case 'add-employee':
      openEmployeeSheet();
      break;
    case 'edit-employee':
      openEmployeeSheet(id);
      break;
    case 'delete-employee':
      deleteEmployee();
      break;
    case 'add-service':
      openServiceSheet();
      break;
    case 'edit-service':
      openServiceSheet(id);
      break;
    case 'delete-service':
      deleteService();
      break;
    case 'raise-prices':
      openPriceSheet();
      break;
    case 'raise-all-prices':
      openPriceSheet('all');
      break;
    case 'raise-one-price':
      openPriceSheet(id);
      break;
    case 'undo-prices':
      undoPriceChange();
      break;
    case 'share-data':
      shareMyData();
      break;
    case 'import-employees':
      importFromEmployees();
      break;
    case 'check-updates':
      checkForUpdates();
      break;
    case 'export-csv':
      exportCsv();
      break;
    case 'backup-now':
      manualBackup();
      break;
    case 'backup-history':
      openBackupHistory();
      break;
    case 'snapshot-download':
      snapshotDownload(id);
      break;
    case 'snapshot-restore':
      snapshotRestore(id);
      break;
    case 'snapshots-clear':
      snapshotsClear();
      break;
    case 'cloud-connect':
      connectCloud();
      break;
    case 'cloud-backup':
      cloudBackup();
      break;
    case 'cloud-restore':
      cloudRestore();
      break;
    case 'cloud-off':
      cloudOff();
      break;
    case 'download-latest':
      downloadLatest();
      break;
    case 'dismiss-backup':
      dismissBackupPrompt();
      break;
    case 'open-cloud':
      openCloudSection();
      break;
    case 'export-json':
      exportJson();
      break;
    case 'import-json':
      importJson();
      break;
    case 'demo':
      addDemo();
      break;
    case 'clear':
      clearAll();
      break;
    case 'install':
      installApp();
      break;
    case 'confirm-yes': {
      const r = confirmResolver;
      confirmResolver = null;
      if (r) r(true);
      closeSheet();
      break;
    }
    case 'confirm-no':
      closeSheet();
      break;
    default:
      break;
  }
});

document.addEventListener('submit', (e) => {
  e.preventDefault();
  if (e.target.id === 'entry-form') saveEntry(e.target);
  else if (e.target.id === 'employee-form') saveEmployee(e.target);
  else if (e.target.id === 'service-form') saveService(e.target);
  else if (e.target.id === 'price-form') applyPriceChange();
  else if (e.target.id === 'import-form') applyImport(e.target);
});

document.addEventListener('input', (e) => {
  if (e.target.closest('#entry-form')) updateEntryTotal();
  if (e.target.matches('#price-form [name="value"]')) syncPriceForm();
  if (e.target.id === 'rec-search') {
    ui.recordsQuery = e.target.value;
    renderRecordsList();
  }
});

document.addEventListener('change', (e) => {
  if (e.target.matches('#entry-form [name="item-service"]')) {
    const value = e.target.value.trim().toLowerCase();
    const svc = data.services.find((s) => s.name.toLowerCase() === value);
    const row = e.target.closest('.item-row');
    const priceEl = row ? row.querySelector('[name="item-price"]') : null;
    if (svc && priceEl && !parseAmount(priceEl.value)) {
      priceEl.value = svc.price;
      updateEntryTotal();
    }
  }
  if (e.target.id === 'currency-select') {
    data.settings.currency = e.target.value;
    save();
    renderAll();
    toast('Валюта изменена');
  }
  if (e.target.closest('#price-form') && e.target.name === 'round') syncPriceForm();
  if (e.target.matches('[data-import-target]')) toggleImportName(e.target);
  if (e.target.matches('[data-price-service]')) {
    const id = e.target.dataset.priceService;
    const on = e.target.checked;
    if (on) priceRaise.selected.add(id);
    else priceRaise.selected.delete(id);

    const row = e.target.closest('.price-row');
    if (row) {
      row.classList.toggle('off', !on);
      const svc = data.services.find((s) => s.id === id);
      const val = row.querySelector('.price-val');
      if (svc && val) val.innerHTML = priceRowValHtml(svc, on);
    }
    refreshPriceUi();
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeSheet();
    return;
  }
  if (e.key !== 'Enter' || !e.target.closest) return;
  const row = e.target.closest('.item-row');
  if (!row) return;
  e.preventDefault();
  const name = e.target.getAttribute('name');
  if (name === 'item-service') {
    const next = row.querySelector('[name="item-price"]');
    if (next) next.focus();
  } else if (name === 'item-price') {
    const next = row.querySelector('[name="item-qty"]');
    if (next) next.focus();
  } else if (name === 'item-qty') {
    const rows = $$('.item-row', row.parentElement);
    if (rows[rows.length - 1] === row) addItemRow();
  }
});

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (ui.tab === 'more') renderMore();
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  toast('Приложение установлено');
});

async function installApp() {
  if (!deferredPrompt) return toast('Используйте меню браузера → «Установить приложение»');
  deferredPrompt.prompt();
  try {
    await deferredPrompt.userChoice;
  } catch (err) { /* ignore */ }
  deferredPrompt = null;
  renderMore();
}

async function checkForUpdates() {
  toast('Проверяю обновление...');
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.update().catch(() => {})));
    }
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith('zarabotok')).map((key) => caches.delete(key)));
  } catch (err) {
    /* ignore */
  }
  setTimeout(() => location.reload(), 800);
}

/* ---------------- запуск ---------------- */

function init() {
  if (!data.employees.length && !data.entries.length) {
    // первый запуск: сотрудник «Я» уже создан в defaultData()
  }
  save();
  renderAll();
  switchTab('home');

  autoMonthlyBackup().catch((err) => console.warn('Резервная копия', err));

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => reg.update().catch(() => {}))
        .catch((err) => console.warn('SW не зарегистрирован', err));
    });
  }
}

init();
