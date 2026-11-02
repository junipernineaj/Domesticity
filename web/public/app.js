// Domesticity web: Status (landing), Outstanding (views), Configure (routines).
// Phase 0: everything lives in memory. Changes last until the page or service restarts.
import { todayIn } from '/src/dates.js';
import { seed } from '/src/seed.js';
import { nextDue, completionsFor } from '/src/schedule.js';
import { householdStats } from '/src/stats.js';
import { group, LENSES, outstanding } from '/src/outstanding.js';
import { status } from '/src/status.js';
import { scheduleText } from '/src/describe.js';
import { expandRoutines } from '/src/spaces.js';
import { groupIssuesBySpace, ISSUE_KINDS, issueCounts, openIssues } from '/src/issues.js';

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
// Routines as the schedule sees them: targeted routines expanded to one per thing.
const allRoutines = () => expandRoutines(state.routines, state.spaces, state.things);
const outstandingItems = (horizonDays) => outstanding({
  routines: allRoutines(),
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
  const routine = {
    id: existing?.id ?? `r${Date.now()}`,
    title,
    kind: f.kind.value,
    intervalDays: Math.min(365, Math.max(1, Number(f.intervalDays.value) || 1)),
    weekdays: f.dayBoxes.filter((d) => d.checked).map((d) => Number(d.value)),
    dayOfMonth: Math.min(31, Math.max(1, Number(f.dayOfMonth.value) || 1)),
    startDate: existing?.startDate ?? state.today,
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
  f.targetType = el('input', { type: 'text', maxlength: '40', placeholder: 'e.g. Toilet' });
  f.targetType.value = r.targetType ?? '';
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
    add('What needs doing (optional)', f.description, 'Steps or notes for whoever does it. Shown when the i button is tapped.'),
    add('Places (comma-separated, e.g. Kitchen, Hall)', f.places, 'Leave empty if it isn\'t about a place.'),
    add('Tags (comma-separated, e.g. cleaning, laundry)', f.tags),
    add('Repeat for each of these things in your spaces (optional, e.g. Toilet)', f.targetType, 'Each toilet on the Spaces page becomes its own task, with its space named.'),
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
    el('div', { class: 'banner' }, 'Changes aren\'t saved yet, like Configure.'),
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

function issuesPage(arg) {
  const kind = ISSUE_KINDS.find((k) => k.id === arg)?.id ?? null;
  const groups = groupIssuesBySpace(openIssues(state.issues, kind), state.spaces);

  const viewBar = el('div', { class: 'segmented', role: 'group', 'aria-label': 'Kind' },
    el('a', { href: '#/issues', 'aria-current': kind ? false : 'page' }, 'All'),
    ...ISSUE_KINDS.map((k) => el('a', {
      href: `#/issues/${k.id}`,
      'aria-current': kind === k.id ? 'page' : false,
    }, k.plural)),
  );

  const body = groups.length === 0
    ? el('div', { class: 'empty' }, 'Nothing open here.')
    : el('div', {}, ...groups.map((g) => el('section', { class: 'group' },
        el('header', {}, el('h2', {}, g.key), el('span', {}, `${g.items.length} open`)),
        el('ul', { class: 'items' }, ...g.items.map(issueRow)),
      )));

  return el('div', {},
    el('h1', {}, 'Snags and nice to haves'),
    el('p', { class: 'sub' },
      'A snag is something that is wrong. A nice to have is an idea for later. Both stay on the list until you mark them done.'),
    el('div', { class: 'banner' }, 'Changes aren\'t saved yet, like Configure.'),
    issueForm(kind),
    el('div', { class: 'row' }, viewBar),
    body,
  );
}

function issueRow(issue) {
  const kindLabel = ISSUE_KINDS.find((k) => k.id === issue.kind).label;
  return el('li', {},
    el('div', {},
      el('div', { class: 'title' }, issue.title),
      el('div', { class: 'meta' }, kindLabel, ` · added ${issue.addedOn}`),
    ),
    el('div', { class: 'actions' },
      el('button', { class: 'done', onclick: () => closeIssue(issue) }, 'Done'),
      el('button', { onclick: () => removeIssue(issue) }, 'Remove'),
    ),
  );
}

function issueForm(defaultKind) {
  const titleInput = el('input', { type: 'text', maxlength: '120', placeholder: 'e.g. Tap is dripping in the utility room' });
  const kindSelect = el('select', {}, ...ISSUE_KINDS.map((k) => el('option', { value: k.id }, k.label)));
  kindSelect.value = defaultKind ?? 'snag';
  const spaceSelect = el('select', {},
    el('option', { value: '' }, 'Nowhere in particular'),
    ...state.spaces.map((s) => el('option', { value: s.id }, s.name)),
  );
  const errorEl = el('div', { class: 'error' });

  return el('form', {
    class: 'editor',
    onsubmit: (e) => {
      e.preventDefault();
      const title = titleInput.value.trim();
      if (!title) {
        errorEl.textContent = 'Say what it is.';
        return;
      }
      state.issues.push({
        id: `i${Date.now()}`,
        kind: kindSelect.value,
        title,
        spaceId: spaceSelect.value || null,
        addedOn: state.today,
        doneOn: null,
      });
      render();
    },
  },
    el('label', {}, 'What is it?', titleInput),
    el('div', { class: 'row' },
      el('label', {}, 'Type', kindSelect),
      el('label', {}, 'Where', spaceSelect),
    ),
    errorEl,
    el('div', { class: 'row' }, el('button', { class: 'btn primary', type: 'submit' }, 'Add')),
  );
}

function closeIssue(issue) {
  issue.doneOn = state.today;
  render();
}

function removeIssue(issue) {
  if (!window.confirm(`Remove "${issue.title}"?`)) return;
  state.issues = state.issues.filter((i) => i.id !== issue.id);
  render();
}

// ---- routing ----------------------------------------------------------------------------

function render() {
  const [page = 'status', arg] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  let content;
  if (page === 'outstanding') content = outstandingPage(arg);
  else if (page === 'spaces') content = spacesPage();
  else if (page === 'issues') content = issuesPage(arg);
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
