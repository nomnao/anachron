// Small pop-up boxes that ask a yes/no question.
//
//   const ok = await showConfirmDialog(desktop, {
//     title: 'Confirm File Delete',
//     message: "Are you sure you want to delete 'diary.txt'?",
//     confirmLabel: 'Yes',
//     cancelLabel: 'No',
//   });
//
// The box covers `container` so nothing behind it can be clicked,
// and the promise gives back true (confirmed) or false (cancelled).

export function showConfirmDialog(container, { title, message, confirmLabel = 'OK', cancelLabel = 'Cancel' }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog" role="dialog">
        <div class="dialog-title"></div>
        <div class="dialog-body">
          <p class="dialog-message"></p>
          <div class="dialog-buttons">
            <button class="push-button" data-choice="confirm"></button>
            <button class="push-button" data-choice="cancel"></button>
          </div>
        </div>
      </div>
    `;

    // The message can contain file names people typed,
    // so all the words are set as plain text, never HTML
    overlay.querySelector('.dialog').setAttribute('aria-label', title);
    overlay.querySelector('.dialog-title').textContent = title;
    overlay.querySelector('.dialog-message').textContent = message;

    const confirmButton = overlay.querySelector('[data-choice="confirm"]');
    const cancelButton = overlay.querySelector('[data-choice="cancel"]');
    confirmButton.textContent = confirmLabel;
    cancelButton.textContent = cancelLabel;

    function finish(result) {
      overlay.remove();
      resolve(result);
    }

    confirmButton.addEventListener('click', () => finish(true));
    cancelButton.addEventListener('click', () => finish(false));
    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') finish(false);
    });

    container.append(overlay);

    // Enter presses the focused button, so Enter means "yes"
    confirmButton.focus();
  });
}
