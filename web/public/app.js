// Phase 0 Outstanding dashboard. Runs entirely in the browser on seeded data.
import { todayIn } from '/src/dates.js';
import { seed } from '/src/seed.js';
import { nextDue, completionsFor } from '/src/schedule.js';
import { householdStats } from '/src/stats.js';
import { group, LENSES, outstanding } from '/src/outstanding.js';

const TIME_ZONE = 'Europe/London';
const HORIZONS = [7, 30];

const state = {
  today: todayIn(TIME_ZONE),
  lens: 'when',
  horizonDays: 7,
  ...seed(todayIn(TIME_ZONE)),
};

const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key === 'aria-pressed') node.setAttribute(key, String(value));
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
};

function dueText(days) {
  if (days < 0) return { text: `Overdue by ${-days} ${-days === 1 ? 'day' : 'days'}`, cls: 'due overdue' };
  if (days === 0) return { text: 'Due today', cls: 'due today' };
  if (days === 1) return { text: 'Due tomorrow', cls: 'due' };
  return { text: `Due in ${days} days`, cls: 'due' };
}

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

function renderSummary() {
  const stats = householdStats(state.routines, state.completions, state.today, 30);
  const items = outstanding({ routines: state.routines, completions: state.completions, today: state.today, horizonDays: 0 });
  const rate = stats.onTimeRate == null ? '–' : `${Math.round(stats.onTimeRate * 100)}%`;
  const overdue = items.filter((i) => i.days < 0).length;
  const today = items.filter((i) => i.days === 0).length;
  document.getElementById('summary').replaceChildren(
    el('strong', {}, overdue), ` overdue · `,
    el('strong', {}, today), ` due today · on-time over 30 days `,
    el('strong', {}, rate),
  );
}

function renderControls() {
  document.getElementById('lenses').replaceChildren(
    ...LENSES.map((l) => el('button', {
      'aria-pressed': l.id === state.lens,
      onclick: () => { state.lens = l.id; render(); },
    }, l.label)),
  );
  document.getElementById('horizon').replaceChildren(
    ...HORIZONS.map((h) => el('button', {
      'aria-pressed': h === state.horizonDays,
      onclick: () => { state.horizonDays = h; render(); },
    }, h === 7 ? 'Next 7 days' : 'Next 30 days')),
  );
}

function renderGroups() {
  const items = outstanding({
    routines: state.routines,
    completions: state.completions,
    today: state.today,
    horizonDays: state.horizonDays,
    persons: new Map(state.persons.map((p) => [p.id, p])),
  });
  const lens = LENSES.find((l) => l.id === state.lens);
  const container = document.getElementById('groups');

  if (items.length === 0) {
    container.replaceChildren(el('div', { class: 'empty' }, 'Nothing outstanding in this window.'));
    return;
  }

  container.replaceChildren(...group(items, lens).map((g) =>
    el('section', { class: 'group' },
      el('header', {},
        el('h2', {}, g.key),
        el('span', {}, `${g.items.length} ${g.items.length === 1 ? 'routine' : 'routines'}${g.overdue ? ` · ${g.overdue} overdue` : ''}`),
      ),
      el('ul', {}, ...g.items.map((item) => {
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
      })),
    ),
  ));
}

function render() {
  renderSummary();
  renderControls();
  renderGroups();
}

render();
