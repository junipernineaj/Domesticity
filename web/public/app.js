// Domesticity web: Status (landing), Outstanding (views), Configure (routines).
// Phase 0: everything lives in memory. Changes last until the page or service restarts.
import { todayIn } from '/src/dates.js';
import { seed } from '/src/seed.js';
import { nextDue, completionsFor } from '/src/schedule.js';
import { householdStats } from '/src/stats.js';
import { group, LENSES, outstanding } from '/src/outstanding.js';
import { status } from '/src/status.js';
import { scheduleText } from '/src/describe.js';

const TIME_ZONE = 'Europe/London';
const HORIZONS = [7, 30];

// The views on the Outstanding page. "lens" views group the list; "overdue" is a filter.
const VIEWS = [
  { id: 'room', label: 'By room', lens: 'place' },
  { id: 'day', label: 'By day', lens: 'when' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'category', label: 'Category', lens: 'category' },
  { id: 'person', label: 'Person', lens: 'person' },
  { id: 'cadence', label: 'Cadence', lens: 'cadence' },
];

const KINDS = [
  ['interval', 'Every N days'],
  ['weekly', 'On set weekdays'],
  ['monthly', 'Monthly on a set day'],
];

// Mon first, to match how people read a week. Values are Calendar weekday numbers (1 = Sunday).
const WEEKDAYS = [[2, 'Mon'], [3, 'Tue'], [4, 'Wed'], [5, 'Thu'], [6, 'Fri'], [7, 'Sat'], [1, 'Sun']];

const today = todayIn(TIME_ZONE);
const state = {
  today,
  horizonDays: 7,
  ...seed(today),
};

// ---- small DOM helper -------------------------------------------------------------------

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

const persons = () => new Map(state.persons.map((p) => [p.id, p]));
const outstandingItems = (horizonDays) => outstanding({
  routines: state.routines,
  completions: state.completions,
  today: state.today,
  horizonDays,
  persons: persons(),
});

// ---- actions --------------------------------------------------------------------------

function markDone(routine, skipped) {
  const cs = completionsFor(state.completions, routine.id);
  state.completions.push({
    routineId: routine.id,
    doneOn: state.today,
    dueOn: nextDue(routine, cs),
    skipped,
    personId: null,
  });
  render();
}

// ---- shared pieces ----------------------------------------------------------------------

function dueText(days) {
  if (days < 0) return { text: `Overdue by ${-days} ${-days === 1 ? 'day' : 'days'}`, cls: 'due overdue' };
  if (days === 0) return { text: 'Due today', cls: 'due today' };
  if (days === 1) return { text: 'Due tomorrow', cls: 'due' };
  return { text: `Due in ${days} days`, cls: 'due' };
}

function itemRow(item) {
  const { text, cls } = dueText(item.days);
  return el('li', {},
    el('div', {},
      el('div', { class: 'title' }, item.routine.title),
      el('div', { class: 'meta' },
        item.routine.places.length ? item.routine.places.join(', ') : 'Anywhere',
        item.routine.tags.length ? ` · ${item.routine.tags.join(', ')}` : '',
        item.assigneeName ? ` · ${item.assigneeName}` : '',
      ),
    ),
    el('div', {},
      el('div', { class: cls }, text),
      el('div', { class: 'actions' },
        el('button', { class: 'done', onclick: () => markDone(item.routine, false) }, 'Done'),
        el('button', { onclick: () => markDone(item.routine, true) }, 'Skip'),
      ),
    ),
  );
}

function groupSection(title, items) {
  return el('section', { class: 'group' },
    el('header', {},
      el('h2', {}, title),
      el('span', {}, `${items.length} ${items.length === 1 ? 'routine' : 'routines'}`),
    ),
    el('ul', { class: 'items' }, ...items.map(itemRow)),
  );
}

// ---- Status (landing page) --------------------------------------------------------------

function statusCard(label, items, href, tone) {
  return el('a', { class: `card ${tone}`, href },
    el('div', { class: 'count' }, items.length),
    el('div', { class: 'label' }, label),
    items.length
      ? el('ul', { class: 'preview' },
          ...items.slice(0, 3).map((i) => el('li', {}, i.routine.title)),
          items.length > 3 ? el('li', {}, `+${items.length - 3} more`) : null)
      : el('div', { class: 'preview' }, 'Nothing here'),
  );
}

function statusPage() {
  const s = status({ routines: state.routines, completions: state.completions, today: state.today });
  const stats = householdStats(state.routines, state.completions, state.today, 30);
  const rate = stats.onTimeRate == null ? 'no history yet' : `${Math.round(stats.onTimeRate * 100)}%`;
  const dateLabel = new Date(`${state.today}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  });

  return el('div', {},
    el('h1', {}, 'Status'),
    el('p', { class: 'sub' }, dateLabel),
    el('div', { class: 'cards' },
      statusCard('Overdue', s.overdue, '#/outstanding/overdue', 'late'),
      statusCard('To do today', s.dueToday, '#/outstanding/day', 'today'),
      statusCard('Coming up', s.comingUp, '#/outstanding/day', 'soon'),
    ),
    el('p', { class: 'sub', style: 'margin-top: 16px' }, `On time over the last 30 days: ${rate}`),
    el('div', { class: 'row' },
      el('a', { class: 'btn primary', href: '#/outstanding/room' }, 'See everything outstanding'),
      el('a', { class: 'btn', href: '#/configure' }, 'Configure routines'),
    ),
  );
}

// ---- Outstanding (views) ----------------------------------------------------------------

function outstandingPage(viewId) {
  const view = VIEWS.find((v) => v.id === viewId) ?? VIEWS[0];
  const isOverdue = view.id === 'overdue';
  const items = isOverdue
    ? outstandingItems(0).filter((i) => i.days < 0)
    : outstandingItems(state.horizonDays);

  const viewBar = el('div', { class: 'segmented', role: 'group', 'aria-label': 'View' },
    ...VIEWS.map((v) => el('a', {
      href: `#/outstanding/${v.id}`,
      'aria-current': v.id === view.id ? 'page' : false,
    }, v.label)),
  );

  const horizonBar = isOverdue ? null : el('div', { class: 'segmented', role: 'group', 'aria-label': 'Look ahead' },
    ...HORIZONS.map((h) => el('button', {
      'aria-pressed': h === state.horizonDays ? 'true' : 'false',
      onclick: () => { state.horizonDays = h; render(); },
    }, h === 7 ? 'Next 7 days' : 'Next 30 days')),
  );

  let body;
  if (items.length === 0) {
    body = el('div', { class: 'empty' }, isOverdue ? 'Nothing overdue.' : 'Nothing outstanding in this window.');
  } else if (isOverdue) {
    body = groupSection('Overdue', items);
  } else {
    const lens = LENSES.find((l) => l.id === view.lens);
    body = el('div', {}, ...group(items, lens).map((g) => groupSection(g.key, g.items)));
  }

  return el('div', {},
    el('h1', {}, 'Outstanding'),
    el('div', { class: 'row' }, viewBar, horizonBar),
    body,
    el('p', { class: 'hint' },
      'A routine appears under every heading that applies, so one task can show up in several places.'),
  );
}

// ---- Configure (routines) ---------------------------------------------------------------

function configureList() {
  return el('div', {},
    el('h1', {}, 'Configure'),
    el('div', { class: 'banner' },
      'Changes aren\'t saved yet. They last until the page or the service restarts, so treat this as a preview.'),
    el('div', { class: 'row' },
      el('a', { class: 'btn primary', href: '#/configure/new' }, 'Add routine'),
    ),
    state.routines.length === 0
      ? el('div', { class: 'empty' }, 'No routines yet.')
      : el('section', { class: 'group' },
          el('ul', { class: 'items' }, ...state.routines.map((r) =>
            el('li', {},
              el('div', {},
                el('div', { class: 'title' }, r.title, r.paused ? ' (paused)' : ''),
                el('div', { class: 'meta' },
                  scheduleText(r),
                  ' · ',
                  r.places.length ? r.places.join(', ') : 'Anywhere',
                  r.tags.length ? ` · ${r.tags.join(', ')}` : '',
                ),
              ),
              el('div', { class: 'actions' },
                el('a', { class: 'btn', href: `#/configure/${r.id}` }, 'Edit'),
              ),
            ))),
        ),
  );
}

const splitList = (value) => value.split(',').map((s) => s.trim()).filter(Boolean);

// The editor's inputs live in `f`, not on the form element, because some names
// (such as `title`) are already properties of every element.
function saveRoutine(existing, f, errorEl) {
  const title = f.title.value.trim();
  if (!title) {
    errorEl.textContent = 'Give the routine a name.';
    return;
  }
  const routine = {
    id: existing?.id ?? `r${Date.now()}`,
    title,
    kind: f.kind.value,
    intervalDays: Math.min(365, Math.max(1, Number(f.intervalDays.value) || 1)),
    weekdays: f.dayBoxes.filter((d) => d.checked).map((d) => Number(d.value)),
    dayOfMonth: Math.min(31, Math.max(1, Number(f.dayOfMonth.value) || 1)),
    startDate: existing?.startDate ?? state.today,
    paused: f.paused.checked,
    places: splitList(f.places.value),
    tags: splitList(f.tags.value),
    assigneeId: existing?.assigneeId ?? null,
  };
  if (existing) Object.assign(existing, routine);
  else state.routines.push(routine);
  location.hash = '#/configure';
}

function deleteRoutine(existing) {
  if (!window.confirm(`Delete "${existing.title}" and its history? This can't be undone.`)) return;
  state.routines = state.routines.filter((r) => r.id !== existing.id);
  state.completions = state.completions.filter((c) => c.routineId !== existing.id);
  location.hash = '#/configure';
}

function routineEditor(id) {
  const existing = id === 'new' ? null : state.routines.find((r) => r.id === id);
  if (id !== 'new' && !existing) {
    return el('div', {}, el('h1', {}, 'Not found'), el('a', { class: 'btn', href: '#/configure' }, 'Back to Configure'));
  }
  const r = existing ?? { title: '', kind: 'interval', intervalDays: 7, weekdays: [], dayOfMonth: 1, places: [], tags: [], paused: false };

  const f = {
    title: el('input', { type: 'text', maxlength: '80', required: true }),
    places: el('input', { type: 'text' }),
    tags: el('input', { type: 'text' }),
    kind: el('select', {}, ...KINDS.map(([value, label]) => el('option', { value }, label))),
    intervalDays: el('input', { type: 'number', min: '1', max: '365' }),
    dayOfMonth: el('input', { type: 'number', min: '1', max: '31' }),
    paused: el('input', { type: 'checkbox' }),
  };
  f.title.value = r.title;
  f.places.value = r.places.join(', ');
  f.tags.value = r.tags.join(', ');
  f.kind.value = r.kind;
  f.intervalDays.value = r.intervalDays ?? 7;
  f.dayOfMonth.value = r.dayOfMonth ?? 1;
  f.paused.checked = !!r.paused;
  f.dayBoxes = WEEKDAYS.map(([n, label]) => {
    const box = el('input', { type: 'checkbox', value: String(n) });
    box.checked = (r.weekdays ?? []).includes(n);
    return { box, label };
  });

  const errorEl = el('div', { class: 'error' });
  const add = (label, input, hint) => el('label', {}, label, input, hint ? el('span', { class: 'hint' }, hint) : null);

  return el('form', {
    class: 'editor',
    onsubmit: (e) => { e.preventDefault(); saveRoutine(existing, { ...f, dayBoxes: f.dayBoxes.map(({ box }) => box) }, errorEl); },
  },
    el('h1', {}, existing ? 'Edit routine' : 'New routine'),
    add('Name', f.title),
    add('Places (comma-separated, e.g. Kitchen, Hall)', f.places, 'Leave empty if it isn\'t about a place.'),
    add('Tags (comma-separated, e.g. cleaning, laundry)', f.tags),
    add('Schedule', f.kind),
    add('Every how many days? (for "Every N days")', f.intervalDays),
    el('div', {},
      el('div', { class: 'hint' }, 'Which weekdays? (for "On set weekdays")'),
      el('div', { class: 'days' }, ...f.dayBoxes.map(({ box, label }) => el('label', {}, box, label)))),
    add('Day of the month (for "Monthly")', f.dayOfMonth, 'Days 29–31 fall back to the last day in shorter months.'),
    el('label', { class: 'check' }, f.paused, 'Paused (doesn\'t come up or remind)'),
    errorEl,
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', type: 'submit' }, existing ? 'Save changes' : 'Add routine'),
      el('a', { class: 'btn', href: '#/configure' }, 'Cancel'),
      existing ? el('button', { class: 'btn danger', type: 'button', onclick: () => deleteRoutine(existing) }, 'Delete') : null,
    ),
  );
}

// ---- routing ----------------------------------------------------------------------------

function render() {
  const [page = 'status', arg] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  let content;
  if (page === 'outstanding') content = outstandingPage(arg);
  else if (page === 'configure') content = arg ? routineEditor(arg) : configureList();
  else content = statusPage();

  for (const link of document.querySelectorAll('nav a[data-page]')) {
    if (link.dataset.page === page) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  document.getElementById('app').replaceChildren(content);
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', render);
render();
