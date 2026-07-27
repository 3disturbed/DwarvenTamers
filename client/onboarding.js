import { APP_STORAGE_PREFIX } from '../shared/AppConfig.js';

const SEEN_KEY = `${APP_STORAGE_PREFIX}onboarding-seen`;

export function initializeOnboarding() {
  const dialog = document.getElementById('help-dialog');
  const openButton = document.getElementById('help-btn');
  const closeButton = document.getElementById('help-close');
  if (!dialog || !openButton || !closeButton) return;

  const open = () => {
    if (!dialog.open) dialog.showModal();
  };
  const close = () => {
    localStorage.setItem(SEEN_KEY, '1');
    dialog.close();
    openButton.focus({ preventScroll: true });
  };

  openButton.addEventListener('click', open);
  closeButton.addEventListener('click', close);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'F1') {
      event.preventDefault();
      dialog.open ? close() : open();
    }
  });

  if (!localStorage.getItem(SEEN_KEY)) {
    // Let the loading presentation finish before introducing the controls.
    window.setTimeout(open, 900);
  }
}
