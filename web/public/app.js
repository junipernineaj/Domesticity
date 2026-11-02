// Domesticity web: Status (landing), Outstanding (views), Configure (routines), Spaces, Snags.
// Data is stored on the server (ADR-0011). The page keeps a working copy and sends changes back.
import { todayIn } from '/src/dates.js';
import { nextDue, completionsFor } from '/src/schedule.js';
import { householdStats } from '/src/stats.js';
import { group, inRange, LENSES, LONG_RANGES, outstanding } from '/src/outstanding.js';
import { status } from '/src/status.js';
import { scheduleText } from '/src/describe.js';
import { expandRoutines } from '/src/spaces.js';
import {
  ASSIGNEE_LABELS, closedIssues, groupIssuesBySpace, ISSUE_KINDS, issueCounts, openIssues, RAG_LABELS, SEVERITY_LABELS,
} from '/src/issues.js';
import { scoreOf } from '/src/issues-rules.js';
import { isBooked, nextOccurrence } from '/src/holidays.js';

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
  ['renewal', 'Renewal on a set date (every 3, 6 or 12 months)'],
];

// Mon first, to match how people read a week. Values are Calendar weekday numbers (1 = Sunday).
const WEEKDAYS = [[2, 'Mon'], [3, 'Tue'], [4, 'Wed'], [5, 'Thu'], [6, 'Fri'], [7, 'Sat'], [1, 'Sun']];

const today = todayIn(TIME_ZONE);
// Data collections come from GET /api/data. `state` is the working copy. `saved` holds what the
// server last confirmed, and sync() sends whatever differs.
const COLLECTIONS = ['persons', 'spaces', 'things', 'routines', 'issues', 'completions', 'holidays'];
// issueImages: item id -> a version number for the picture URL, set when the picture loads or changes.
// Pictures are not part of the synced working copy (ADR-0013).
const state = { today, horizonDays: 7, longRange: null, loaded: false, error: null, saveError: null, issueImages: new Map(), imageError: null };
const MAX_PHOTO_EDGE = 1600;
for (const c of COLLECTIONS) state[c] = [];
let saved = new Map();

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
// Routines as the schedule sees them: targeted routines expanded to one per thing.
const allRoutines = () => expandRoutines(state.routines, state.spaces, state.things);
const outstandingItems = (horizonDays) => outstanding({
  routines: allRoutines(),
  holidays: state.holidays,
  completions: state.completions,
  today: state.today,
  horizonDays,
  persons: persons(),
});

// ---- actions --------------------------------------------------------------------------

function markDone(routine, skipped) {
  const cs = completionsFor(state.completions, routine.id);
  state.completions.push({
    id: `c${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
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

// A routine's description sits behind an "i" button, so the list stays short.
// Tapping it (or clicking, on a desktop) shows or hides the description.
function titleWithInfo(title, description) {
  if (!description) return [el('div', { class: 'title' }, title)];
  const panel = el('div', { class: 'detail', hidden: true }, description);
  const button = el('button', {
    class: 'info', type: 'button', 'aria-label': `About ${title}`, 'aria-expanded': 'false',
  }, 'i');
  button.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    button.setAttribute('aria-expanded', String(!panel.hidden));
  });
  return [el('div', { class: 'title' }, title, ' ', button), panel];
}

function itemRow(item) {
  if (item.routine.kind === 'holiday') return holidayRow(item);
  const { text, cls } = dueText(item.days);
  return el('li', {},
    el('div', {},
      ...titleWithInfo(item.routine.title, item.routine.description),
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

function issueCard(label, kind, href, tone) {
  const count = issueCounts(state.issues)[kind === 'snag' ? 'snags' : 'nice'];
  const open = openIssues(state.issues, kind);
  return el('a', { class: `card ${tone}`, href },
    el('div', { class: 'count' }, count),
    el('div', { class: 'label' }, `Open ${label.toLowerCase()}`),
    open.length
      ? el('ul', { class: 'preview' },
          ...open.slice(0, 3).map((i) => el('li', {}, i.title)),
          open.length > 3 ? el('li', {}, `+${open.length - 3} more`) : null)
      : el('div', { class: 'preview' }, 'Nothing open'),
  );
}

function statusPage() {
  const s = status({ routines: allRoutines(), completions: state.completions, today: state.today });
  const stats = householdStats(allRoutines(), state.completions, state.today, 30);
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
    el('div', { class: 'cards', style: 'margin-top: 12px' },
      issueCard('Snags', 'snag', '#/issues/snag', 'late'),
      issueCard('Nice to haves', 'nice', '#/issues/nice', 'soon'),
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
  const isCadence = view.id === 'cadence';
  // Next quarter and Next year sit beside the 7 and 30 day windows, on the Cadence tab only.
  const range = isCadence && state.longRange ? LONG_RANGES[state.longRange] : null;
  const items = isOverdue
    ? outstandingItems(0).filter((i) => i.days < 0)
    : range
      ? inRange(outstandingItems(LONG_RANGES['next-year'].max), range.min, range.max)
      : outstandingItems(state.horizonDays);

  const viewBar = el('div', { class: 'segmented', role: 'group', 'aria-label': 'View' },
    ...VIEWS.map((v) => el('a', {
      href: `#/outstanding/${v.id}`,
      'aria-current': v.id === view.id ? 'page' : false,
    }, v.label)),
  );

  const windowButton = (label, selected, onclick) => el('button', {
    'aria-pressed': selected ? 'true' : 'false',
    onclick,
  }, label);
  const horizonBar = isOverdue ? null : el('div', { class: 'segmented', role: 'group', 'aria-label': 'Look ahead' },
    ...HORIZONS.map((h) => windowButton(h === 7 ? 'Next 7 days' : 'Next 30 days',
      !range && h === state.horizonDays, () => { state.longRange = null; state.horizonDays = h; render(); })),
    ...(isCadence ? Object.entries(LONG_RANGES).map(([id, r]) => windowButton(r.label,
      range === LONG_RANGES[id], () => { state.longRange = id; render(); })) : []),
  );

  let body;
  if (items.length === 0) {
    body = el('div', { class: 'empty' }, isOverdue ? 'Nothing overdue.' : range ? 'Nothing due in this range.' : 'Nothing outstanding in this window.');
  } else if (isOverdue) {
    body = groupSection('Overdue', items);
  } else {
    const lens = LENSES.find((l) => l.id === view.lens);
    body = el('div', {}, ...group(items, lens).map((g) => groupSection(g.key, g.items)));
  }

  const note = range
    ? `Due ${range.min} to ${range.max} days from today, grouped by how often each one repeats.`
    : 'A routine appears under every heading that applies, so one task can show up in several places.';
  return el('div', {},
    el('h1', {}, 'Outstanding'),
    el('div', { class: 'row' }, viewBar, horizonBar),
    body,
    el('p', { class: 'hint' }, note),
  );
}

// ---- Configure (routines) ---------------------------------------------------------------

function configureList() {
  return el('div', {},
    el('h1', {}, 'Configure'),
    el('div', { class: 'row' },
      el('a', { class: 'btn primary', href: '#/configure/new' }, 'Add routine'),
    ),
    state.routines.length === 0
      ? el('div', { class: 'empty' }, 'No routines yet.')
      : el('section', { class: 'group' },
          el('ul', { class: 'items' }, ...state.routines.map((r) =>
            el('li', {},
              el('div', {},
                ...titleWithInfo(`${r.title}${r.paused ? ' (paused)' : ''}`, r.description),
                el('div', { class: 'meta' },
                  scheduleText(r),
                  ' · ',
                  r.places.length ? r.places.join(', ') : 'Anywhere',
                  r.tags.length ? ` · ${r.tags.join(', ')}` : '',
                  r.targetType ? ` · for each ${r.targetType}` : '',
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
  const isRenewal = f.kind.value === 'renewal';
  const routine = {
    id: existing?.id ?? `r${Date.now()}`,
    title,
    kind: f.kind.value,
    intervalDays: Math.min(365, Math.max(1, Number(f.intervalDays.value) || 1)),
    weekdays: f.dayBoxes.filter((d) => d.checked).map((d) => Number(d.value)),
    dayOfMonth: Math.min(31, Math.max(1, Number(f.dayOfMonth.value) || 1)),
    // For a renewal the set date is the start date (SPEC 5.11).
    startDate: isRenewal ? (f.setDate.value || existing?.startDate || state.today) : existing?.startDate ?? state.today,
    everyMonths: isRenewal ? Number(f.everyMonths.value) : null,
    leadDays: isRenewal ? Math.min(365, Math.max(0, Number(f.leadDays.value) || 0)) : null,
    paused: f.paused.checked,
    description: f.description.value.trim() || undefined,
    places: splitList(f.places.value),
    tags: splitList(f.tags.value),
    targetType: f.targetType.value.trim() || undefined,
    assigneeId: existing?.assigneeId ?? null,
  };
  if (existing) Object.assign(existing, routine);
  else state.routines.push(routine);
  location.hash = '#/configure';
}

function deleteRoutine(existing) {
  if (!window.confirm(`Delete "${existing.title}" and its history? This can't be undone.`)) return;
  state.routines = state.routines.filter((r) => r.id !== existing.id);
  state.completions = state.completions.filter((c) => c.routineId !== existing.id && !c.routineId.startsWith(`${existing.id}@`));
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
    description: el('textarea', { rows: '4', maxlength: '500' }),
    places: el('input', { type: 'text' }),
    tags: el('input', { type: 'text' }),
    kind: el('select', {}, ...KINDS.map(([value, label]) => el('option', { value }, label))),
    intervalDays: el('input', { type: 'number', min: '1', max: '365' }),
    dayOfMonth: el('input', { type: 'number', min: '1', max: '31' }),
    paused: el('input', { type: 'checkbox' }),
  };
  f.title.value = r.title;
  f.description.value = r.description ?? '';
  f.places.value = r.places.join(', ');
  f.tags.value = r.tags.join(', ');
  f.kind.value = r.kind;
  f.intervalDays.value = r.intervalDays ?? 7;
  f.dayOfMonth.value = r.dayOfMonth ?? 1;
  f.paused.checked = !!r.paused;
  f.setDate = el('input', { type: 'date' });
  f.setDate.value = r.startDate ?? state.today;
  f.everyMonths = el('select', {},
    el('option', { value: '3' }, 'Every 3 months (quarterly)'),
    el('option', { value: '6' }, 'Every 6 months (twice a year)'),
    el('option', { value: '12' }, 'Every 12 months (yearly)'));
  f.everyMonths.value = String(r.everyMonths ?? 12);
  f.leadDays = el('input', { type: 'number', min: '0', max: '365' });
  f.leadDays.value = String(r.leadDays ?? 30);
  f.targetType = el('input', { type: 'text', maxlength: '40', placeholder: 'e.g. Toilet' });
  f.targetType.value = r.targetType ?? '';
  f.dayBoxes = WEEKDAYS.map(([n, label]) => {
    const box = el('input', { type: 'checkbox', value: String(n) });
    box.checked = (r.weekdays ?? []).includes(n);
    return { box, label };
  });

  const errorEl = el('div', { class: 'error' });
  const add = (label, input, hint) => el('label', {}, label, input, hint ? el('span', { class: 'hint' }, hint) : null);

  const renewalFields = el('div', {},
    add('Set date (the renewal date for this item)', f.setDate, 'Changing it moves the schedule. Completed renewals keep their history.'),
    add('How often it renews', f.everyMonths),
    add('Remind this many days before (lead time)', f.leadDays, 'Reminders are not sent yet. Renewals show on Outstanding from this many days ahead.'),
  );
  // Renewals use the set date instead of the every-N-days, weekday and day-of-month fields.
  const otherScheduleFields = [
    add('Every how many days? (for "Every N days")', f.intervalDays),
    el('div', {},
      el('div', { class: 'hint' }, 'Which weekdays? (for "On set weekdays")'),
      el('div', { class: 'days' }, ...f.dayBoxes.map(({ box, label }) => el('label', {}, box, label)))),
    add('Day of the month (for "Monthly")', f.dayOfMonth, 'Days 29–31 fall back to the last day in shorter months.'),
  ];
  const syncRenewal = () => {
    const isRenewal = f.kind.value === 'renewal';
    renewalFields.hidden = !isRenewal;
    for (const node of otherScheduleFields) node.hidden = isRenewal;
  };
  f.kind.addEventListener('change', syncRenewal);
  syncRenewal();

  return el('form', {
    class: 'editor',
    onsubmit: (e) => { e.preventDefault(); saveRoutine(existing, { ...f, dayBoxes: f.dayBoxes.map(({ box }) => box) }, errorEl); },
  },
    el('h1', {}, existing ? 'Edit routine' : 'New routine'),
    add('Name', f.title),
    add('What needs doing (optional)', f.description, 'Steps or notes for whoever does it. Shown when the i button is tapped.'),
    add('Places (comma-separated, e.g. Kitchen, Hall)', f.places, 'Leave empty if it isn\'t about a place.'),
    add('Tags (comma-separated, e.g. cleaning, laundry)', f.tags),
    add('Repeat for each of these things in your spaces (optional, e.g. Toilet)', f.targetType, 'Each toilet on the Spaces page becomes its own task, with its space named.'),
    add('Schedule', f.kind),
    ...otherScheduleFields,
    renewalFields,
    el('label', { class: 'check' }, f.paused, 'Paused (doesn\'t come up or remind)'),
    errorEl,
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', type: 'submit' }, existing ? 'Save changes' : 'Add routine'),
      el('a', { class: 'btn', href: '#/configure' }, 'Cancel'),
      existing ? el('button', { class: 'btn danger', type: 'button', onclick: () => deleteRoutine(existing) }, 'Delete') : null,
    ),
  );
}

// ---- Spaces -----------------------------------------------------------------------------

function spacesPage() {
  const nameInput = el('input', { type: 'text', maxlength: '60', placeholder: 'e.g. Bedroom, Car, Front garden' });
  const addSpace = (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) return;
    state.spaces.push({ id: `s${Date.now()}`, name });
    render();
  };
  return el('div', {},
    el('h1', {}, 'Spaces'),
    el('p', { class: 'sub' },
      'Every place that needs something doing to it, and the things in each one. A routine such as "Clean the toilet" can then say where each toilet is.'),
    el('form', { class: 'row', onsubmit: addSpace }, nameInput, el('button', { class: 'btn primary', type: 'submit' }, 'Add space')),
    state.spaces.length === 0
      ? el('div', { class: 'empty' }, 'No spaces yet.')
      : el('div', {}, ...state.spaces.map(spaceCard)),
  );
}

function spaceCard(space) {
  const things = state.things.filter((t) => t.spaceId === space.id);
  const typeInput = el('input', { type: 'text', maxlength: '40', placeholder: 'e.g. Toilet, Oven, Fridge' });
  const addThing = (e) => {
    e.preventDefault();
    const type = typeInput.value.trim();
    if (!type) return;
    state.things.push({ id: `t${Date.now()}`, spaceId: space.id, type });
    render();
  };
  return el('section', { class: 'group' },
    el('header', {},
      el('h2', {}, space.name),
      el('span', {},
        el('button', { class: 'link', type: 'button', onclick: () => renameSpace(space) }, 'Rename'),
        ' · ',
        el('button', { class: 'link danger', type: 'button', onclick: () => deleteSpace(space) }, 'Delete'),
      ),
    ),
    el('div', { class: 'things' },
      things.length
        ? el('ul', { class: 'chips' }, ...things.map((t) => el('li', {},
            t.type,
            el('button', { class: 'x', type: 'button', 'aria-label': `Remove ${t.type}`, onclick: () => removeThing(t) }, '×'),
          )))
        : el('div', { class: 'hint' }, 'Nothing listed here yet.'),
      el('form', { class: 'row', onsubmit: addThing }, typeInput, el('button', { class: 'btn', type: 'submit' }, 'Add thing')),
    ),
  );
}

function renameSpace(space) {
  const name = window.prompt('Rename space', space.name);
  if (name && name.trim()) {
    space.name = name.trim();
    render();
  }
}

function deleteSpace(space) {
  const count = state.things.filter((t) => t.spaceId === space.id).length;
  const detail = count ? ` and its ${count} ${count === 1 ? 'thing' : 'things'}` : '';
  if (!window.confirm(`Delete "${space.name}"${detail}? Its snags and nice to haves move to "Nowhere in particular".`)) return;
  state.spaces = state.spaces.filter((s) => s.id !== space.id);
  state.things = state.things.filter((t) => t.spaceId !== space.id);
  state.issues = state.issues.map((i) => (i.spaceId === space.id ? { ...i, spaceId: null } : i));
  render();
}

function removeThing(thing) {
  state.things = state.things.filter((t) => t.id !== thing.id);
  render();
}

// ---- Snags and nice to haves ------------------------------------------------------------

const ISSUE_VIEWS = [
  { id: 'all', label: 'All open', href: '#/issues' },
  { id: 'snag', label: 'Snags', href: '#/issues/snag' },
  { id: 'nice', label: 'Nice to haves', href: '#/issues/nice' },
  { id: 'closed', label: 'Closed', href: '#/issues/closed' },
];

// ---- Holidays (ADR-0015) ---------------------------------------------------------------

function formatDay(date) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// Booking a holiday books it for its next occurrence. The server checks that the day matches.
function setHolidayBooked(holiday, booked) {
  holiday.bookedFor = booked ? nextOccurrence(holiday, state.today) : null;
  render();
}

function holidayRow(item) {
  const holiday = state.holidays.find((h) => h.id === item.routine.holidayId);
  return el('li', {},
    el('div', {},
      el('div', { class: 'title' }, item.routine.title),
      el('div', { class: 'meta' }, `Holiday · ${formatDay(item.dueOn)}`),
    ),
    el('div', {},
      el('div', {}, dueText(item.days).text),
      el('div', { class: 'actions' },
        el('button', { class: 'done', onclick: () => setHolidayBooked(holiday, true) }, 'Mark booked')),
    ),
  );
}

function holidayPlans() {
  return el('section', { class: 'group' },
    el('header', {}, el('h2', {}, 'Holiday plans'), el('span', {}, 'planned until booked')),
    el('ul', { class: 'items' }, ...state.holidays.map((h) => {
      const booked = isBooked(h, state.today);
      const note = el('input', { type: 'text', maxlength: '500', placeholder: 'Note (optional)' });
      note.value = h.note ?? '';
      note.addEventListener('change', () => { h.note = note.value.trim() || null; render(); });
      return el('li', {},
        el('div', {},
          el('div', { class: 'title' }, h.name),
          el('div', { class: 'meta' }, `${booked ? 'Booked' : 'Planned'} · ${formatDay(nextOccurrence(h, state.today))}`),
          note,
        ),
        el('div', { class: 'actions' },
          el('button', { class: booked ? '' : 'done', onclick: () => setHolidayBooked(h, !booked) },
            booked ? 'Mark planned' : 'Mark booked')),
      );
    })),
  );
}

function issuesPage(arg) {
  const view = ISSUE_VIEWS.find((v) => v.id === arg) ?? ISSUE_VIEWS[0];
  const viewBar = el('div', { class: 'segmented', role: 'group', 'aria-label': 'View' },
    ...ISSUE_VIEWS.map((v) => el('a', { href: v.href, 'aria-current': v.id === view.id ? 'page' : false }, v.label)));

  let body;
  if (view.id === 'closed') {
    const items = closedIssues(state.issues);
    body = items.length === 0
      ? el('div', { class: 'empty' }, 'Nothing closed yet.')
      : el('section', { class: 'group' }, el('ul', { class: 'items' }, ...items.map(issueRow)));
  } else {
    const groups = groupIssuesBySpace(openIssues(state.issues, view.id === 'all' ? null : view.id), state.spaces);
    body = groups.length === 0
      ? el('div', { class: 'empty' }, 'Nothing open here.')
      : el('div', {}, ...groups.map((g) => el('section', { class: 'group' },
          el('header', {}, el('h2', {}, g.key), el('span', {}, `${g.items.length} open`)),
          el('ul', { class: 'items' }, ...g.items.map(issueRow)),
        )));
  }

  return el('div', {},
    el('h1', {}, 'Snags and nice to haves'),
    el('p', { class: 'sub' },
      'Snags are things that are wrong, Red first. Nice to haves are ideas for later, cheapest and easiest first. Done closes an item, and Reopen brings it back.'),
    issueForm(view.id === 'nice' ? 'nice' : 'snag'),
    view.id === 'nice' ? holidayPlans() : null,
    el('div', { class: 'row' }, viewBar),
    body,
  );
}

function scoreText(issue) {
  const score = scoreOf(issue);
  return score == null ? 'not scored yet' : `score ${score.toFixed(1)} (cost ${issue.cost}, effort ${issue.effort})`;
}

function photoUrl(issue) {
  return `/api/issues/${encodeURIComponent(issue.id)}/image?v=${state.issueImages.get(issue.id)}`;
}

function issueRow(issue) {
  const isSnag = issue.kind === 'snag';
  const kindLabel = ISSUE_KINDS.find((k) => k.id === issue.kind).label;
  const details = isSnag ? [SEVERITY_LABELS[issue.severity], ASSIGNEE_LABELS[issue.assignee]] : [scoreText(issue)];
  const hasPhoto = state.issueImages.has(issue.id);
  const fileInput = el('input', { type: 'file', accept: 'image/*', hidden: true });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (file) uploadPhoto(issue, file);
  });

  const actions = issue.doneOn
    ? [el('button', { onclick: () => reopenIssue(issue) }, 'Reopen')]
    : [el('button', { class: 'done', onclick: () => closeIssue(issue) }, 'Done')];
  actions.push(el('button', { onclick: () => removeIssue(issue) }, 'Remove'));

  // Picture controls sit on their own row under the item, so the buttons above still fit a phone.
  const photoActions = el('div', { class: 'actions photo-actions' },
    el('button', { onclick: () => fileInput.click() }, hasPhoto ? 'Replace photo' : 'Add photo'),
    hasPhoto ? el('button', { onclick: () => removePhoto(issue) }, 'Remove photo') : null,
  );
  const picture = hasPhoto
    ? el('a', { class: 'issue-photo', href: photoUrl(issue), target: '_blank', rel: 'noopener' },
      el('img', { src: photoUrl(issue), alt: `Picture for ${issue.title}`, loading: 'lazy' }))
    : null;
  const error = state.imageError?.id === issue.id ? el('div', { class: 'error photo-error' }, state.imageError.text) : null;

  return el('li', { class: isSnag && issue.rag ? `urgent-${issue.rag}` : null },
    el('div', {},
      el('div', { class: 'title' },
        isSnag && issue.rag ? el('span', { class: `rag ${issue.rag}` }, RAG_LABELS[issue.rag]) : null,
        issue.title),
      el('div', { class: 'meta' },
        kindLabel,
        ...details.map((d) => ` · ${d}`),
        issue.doneOn ? ` · closed ${issue.doneOn}` : ` · added ${issue.addedOn}`,
      ),
    ),
    el('div', { class: 'actions' }, ...actions),
    picture,
    error,
    photoActions,
    fileInput,
  );
}

// Makes a picture small enough to send: longest side at most MAX_PHOTO_EDGE, as JPEG (ADR-0013).
async function shrinkPhoto(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => (blob ? resolve(blob) : reject(new Error('encode failed'))), 'image/jpeg', 0.85));
}

// A picture goes to the server by itself, so the item must be saved there first. Waits briefly
// for the save to land. This avoids re-rendering the page, which would clear a form being typed in.
async function waitUntilSaved(id) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    if (saved.get('issues').has(id)) return true;
    if (!syncing) sync();
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return saved.get('issues').has(id);
}

async function uploadPhoto(issue, file) {
  state.imageError = null;
  let blob;
  try {
    blob = await shrinkPhoto(file);
  } catch {
    state.imageError = { id: issue.id, text: 'Could not read that picture. Try a JPEG or PNG.' };
    render();
    return;
  }
  if (!(await waitUntilSaved(issue.id))) {
    state.imageError = { id: issue.id, text: 'Still saving this item. Try the picture again in a moment.' };
    render();
    return;
  }
  try {
    const res = await fetch(`/api/issues/${encodeURIComponent(issue.id)}/image`, {
      method: 'PUT', headers: { 'content-type': blob.type }, body: blob,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    state.issueImages.set(issue.id, Date.now());
  } catch (err) {
    state.imageError = { id: issue.id, text: `Could not save the picture. ${err.message}` };
  }
  render();
}

async function removePhoto(issue) {
  if (!window.confirm('Remove this picture?')) return;
  state.imageError = null;
  try {
    const res = await fetch(`/api/issues/${encodeURIComponent(issue.id)}/image`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.issueImages.delete(issue.id);
  } catch {
    state.imageError = { id: issue.id, text: 'Could not remove the picture. Check the connection and try again.' };
  }
  render();
}

// A slider from 1 to 5 with its current value shown beside it.
function ratingSlider(label, initial) {
  const input = el('input', { type: 'range', min: '1', max: '5', step: '1' });
  input.value = String(initial);
  const out = el('output', {}, String(initial));
  input.addEventListener('input', () => { out.textContent = input.value; });
  return { input, field: el('label', {}, `${label} (1 low, 5 high)`, el('div', { class: 'row' }, input, out)) };
}

function issueForm(defaultKind) {
  const titleInput = el('input', { type: 'text', maxlength: '120', placeholder: 'e.g. Tap is dripping in the utility room' });
  const kindSelect = el('select', {}, ...ISSUE_KINDS.map((k) => el('option', { value: k.id }, k.label)));
  kindSelect.value = defaultKind;
  const spaceSelect = el('select', {},
    el('option', { value: '' }, 'Nowhere in particular'),
    ...state.spaces.map((s) => el('option', { value: s.id }, s.name)),
  );
  const severitySelect = el('select', {}, ...Object.entries(SEVERITY_LABELS).map(([v, l]) => el('option', { value: v }, l)));
  severitySelect.value = 'soon';
  const ragSelect = el('select', {}, ...Object.entries(RAG_LABELS).map(([v, l]) => el('option', { value: v }, l)));
  ragSelect.value = 'amber';
  const assigneeSelect = el('select', {}, ...Object.entries(ASSIGNEE_LABELS).map(([v, l]) => el('option', { value: v }, l)));
  assigneeSelect.value = 'household';
  const cost = ratingSlider('Cost', 3);
  const effort = ratingSlider('Effort', 3);
  const errorEl = el('div', { class: 'error' });

  const snagFields = el('div', {},
    el('div', { class: 'row' },
      el('label', {}, 'Severity', severitySelect),
      el('label', {}, 'Urgency (RAG)', ragSelect),
      el('label', {}, 'Who fixes it', assigneeSelect),
    ),
  );
  const niceFields = el('div', {}, cost.field, effort.field);
  const syncKind = () => {
    snagFields.hidden = kindSelect.value !== 'snag';
    niceFields.hidden = kindSelect.value !== 'nice';
  };
  kindSelect.addEventListener('change', syncKind);
  syncKind();

  return el('form', {
    class: 'editor',
    onsubmit: (e) => {
      e.preventDefault();
      const title = titleInput.value.trim();
      if (!title) {
        errorEl.textContent = 'Say what it is.';
        return;
      }
      const kind = kindSelect.value;
      const base = {
        id: `i${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
        kind,
        title,
        spaceId: spaceSelect.value || null,
        addedOn: state.today,
        doneOn: null,
      };
      state.issues.push(kind === 'snag'
        ? { ...base, severity: severitySelect.value, rag: ragSelect.value, assignee: assigneeSelect.value, cost: null, effort: null }
        : { ...base, severity: null, rag: null, assignee: null, cost: Number(cost.input.value), effort: Number(effort.input.value) });
      render();
    },
  },
    el('label', {}, 'What is it?', titleInput),
    el('div', { class: 'row' },
      el('label', {}, 'Type', kindSelect),
      el('label', {}, 'Where', spaceSelect),
    ),
    snagFields,
    niceFields,
    errorEl,
    el('div', { class: 'row' }, el('button', { class: 'btn primary', type: 'submit' }, 'Add')),
  );
}

function closeIssue(issue) {
  issue.doneOn = state.today;
  render();
}

function reopenIssue(issue) {
  issue.doneOn = null;
  render();
}

function removeIssue(issue) {
  if (!window.confirm(`Remove "${issue.title}"?`)) return;
  state.issues = state.issues.filter((i) => i.id !== issue.id);
  render();
}

// ---- Activity ---------------------------------------------------------------------------

// Every change, newest first. Read from the server a page at a time (GET /api/activity).
function activityView() {
  const list = el('ul', { class: 'items' });
  const note = el('div', { class: 'hint' });
  let next = null;
  const more = el('button', { class: 'btn', type: 'button' }, 'Load older');
  const when = (iso) => new Date(iso).toLocaleString('en-GB', {
    timeZone: TIME_ZONE, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  async function load(before) {
    more.disabled = true;
    try {
      const res = await fetch(`/api/activity?limit=50${before ? `&before=${before}` : ''}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const page = await res.json();
      for (const entry of page.items) {
        list.append(el('li', {},
          el('div', {}, el('div', { class: 'title' }, entry.text)),
          el('div', { class: 'meta' }, when(entry.at)),
        ));
      }
      next = page.next;
      more.hidden = next == null;
      note.textContent = list.children.length === 0 ? 'Nothing has been recorded yet.' : '';
    } catch {
      note.textContent = 'Could not load the activity log.';
    } finally {
      more.disabled = false;
    }
  }

  more.addEventListener('click', () => load(next));
  load(null);
  return el('div', {},
    el('h1', {}, 'Activity'),
    el('p', { class: 'sub' }, 'Every change, newest first. Kept for good.'),
    list,
    note,
    el('div', { class: 'row' }, more),
  );
}

// ---- routing ----------------------------------------------------------------------------

function render() {
  const [page = 'status', arg] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  let content;
  if (page === 'outstanding') content = outstandingPage(arg);
  else if (page === 'spaces') content = spacesPage();
  else if (page === 'issues') content = issuesPage(arg);
  else if (page === 'activity') content = activityView();
  else if (page === 'configure') content = arg ? routineEditor(arg) : configureList();
  else content = statusPage();

  for (const link of document.querySelectorAll('nav a[data-page]')) {
    if (link.dataset.page === page) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  if (!state.loaded) content = el('div', { class: 'empty' }, state.error ?? 'Loading…');
  document.getElementById('app').replaceChildren(content);
  window.scrollTo(0, 0);
  updateSaveStatus();
  sync();
}

// ---- loading and saving -----------------------------------------------------------------

// Upserts go parent first and deletes go child first, so the server never sees a missing parent (ADR-0011).
const UPSERT_ORDER = COLLECTIONS;
const DELETE_ORDER = [...COLLECTIONS].reverse();
let syncing = false;
let retryTimer = null;

async function boot() {
  try {
    const res = await fetch('/api/data', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    for (const c of COLLECTIONS) state[c] = data[c];
    state.issueImages = new Map(data.issueImages.map((id) => [id, 0]));
    takeSnapshot();
    state.loaded = true;
    state.error = null;
  } catch {
    state.error = 'Could not load your data. Check the connection, then reload the page.';
  }
  render();
}

function takeSnapshot() {
  saved = new Map(COLLECTIONS.map((c) => [c, new Map(state[c].map((i) => [i.id, JSON.stringify(i)]))]));
}

// Everything that differs from what the server last confirmed.
function pendingOps() {
  const ops = [];
  for (const c of UPSERT_ORDER) {
    const prev = saved.get(c);
    for (const item of state[c]) {
      const serialized = JSON.stringify(item);
      if (prev.get(item.id) !== serialized) ops.push({ op: 'upsert', collection: c, item, serialized });
    }
  }
  for (const c of DELETE_ORDER) {
    const current = new Set(state[c].map((i) => i.id));
    for (const id of saved.get(c).keys()) {
      if (!current.has(id)) ops.push({ op: 'delete', collection: c, id });
    }
  }
  return ops;
}

async function sync() {
  if (!state.loaded || syncing) return;
  const ops = pendingOps();
  if (ops.length === 0) {
    state.saveError = null;
    updateSaveStatus();
    return;
  }
  syncing = true;
  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ops: ops.map(({ serialized, ...op }) => op) }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    for (const op of ops) {
      if (op.op === 'upsert') saved.get(op.collection).set(op.item.id, op.serialized);
      else saved.get(op.collection).delete(op.id);
    }
    state.saveError = null;
  } catch {
    state.saveError = "Couldn't save your last change. It will be retried.";
  } finally {
    syncing = false;
  }
  updateSaveStatus();
  if (state.saveError) {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(sync, 5000);
  } else if (pendingOps().length) {
    sync();
  }
}

function updateSaveStatus() {
  const box = document.getElementById('save-status');
  if (!box) return;
  box.textContent = state.saveError ?? '';
  box.hidden = !state.saveError;
}

window.addEventListener('hashchange', render);
boot();
