// The calendar: click the clock in the corner of the taskbar and a
// month pops up above it, with today highlighted. The arrows go to
// the month before or after; the date at the bottom comes back to
// today. Clicking the clock again, anywhere else, or Escape closes it.

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// e.g. "Saturday, September 26, 2026"
export function formatLongDate(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

// Returns a function that cleans up when the desktop goes away.
export function setUpCalendar(desktop) {
  const clock = desktop.querySelector('#clock');

  const panel = document.createElement('div');
  panel.id = 'calendar';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="calendar-header">
      <button class="calendar-arrow" data-step="-1" aria-label="Previous month"></button>
      <span class="calendar-title"></span>
      <button class="calendar-arrow" data-step="1" aria-label="Next month"></button>
    </div>
    <div class="calendar-grid sunken-panel"></div>
    <button class="calendar-today"></button>
  `;
  desktop.append(panel);

  // The month on show: its year, and its month (0 = January)
  let shown = null;

  function render() {
    const today = new Date();
    const first = new Date(shown.year, shown.month, 1);
    const daysInMonth = new Date(shown.year, shown.month + 1, 0).getDate();

    panel.querySelector('.calendar-title').textContent =
      first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const cells = WEEKDAYS.map((day) => `<span class="calendar-weekday">${day}</span>`);
    // Blank squares before the 1st, so it lands on the right weekday
    for (let i = 0; i < first.getDay(); i++) cells.push('<span></span>');
    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = day === today.getDate()
        && shown.month === today.getMonth()
        && shown.year === today.getFullYear();
      cells.push(`<span class="calendar-day${isToday ? ' is-today' : ''}">${day}</span>`);
    }
    panel.querySelector('.calendar-grid').innerHTML = cells.join('');

    panel.querySelector('.calendar-today').textContent = `Today: ${formatLongDate(today)}`;
  }

  function setOpen(open) {
    panel.hidden = !open;
    clock.classList.toggle('is-pressed', open);
    if (open) {
      const today = new Date();
      shown = { year: today.getFullYear(), month: today.getMonth() };
      render();
    }
  }

  clock.addEventListener('click', () => setOpen(panel.hidden));

  panel.addEventListener('click', (event) => {
    const arrow = event.target.closest('.calendar-arrow');
    if (arrow) {
      // new Date() works out the year when the month runs past either end
      const next = new Date(shown.year, shown.month + Number(arrow.dataset.step), 1);
      shown = { year: next.getFullYear(), month: next.getMonth() };
      render();
    }

    if (event.target.closest('.calendar-today')) {
      setOpen(true);
    }
  });

  // Pressing anywhere else on the desktop closes it
  desktop.addEventListener('pointerdown', (event) => {
    if (!panel.hidden && !panel.contains(event.target) && !clock.contains(event.target)) {
      setOpen(false);
    }
  });

  // Escape closes it too. This listens on the whole page, so it
  // hands back a function that stops listening.
  function onKeyDown(event) {
    if (event.key === 'Escape' && !panel.hidden) setOpen(false);
  }
  document.addEventListener('keydown', onKeyDown);

  return () => document.removeEventListener('keydown', onKeyDown);
}
