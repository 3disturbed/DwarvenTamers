let hideTimer = null;

function showToast(message, actionLabel = null, action = null, persistent = false) {
  const toast = document.getElementById('system-toast');
  const messageNode = document.getElementById('system-toast-message');
  const actionButton = document.getElementById('system-toast-action');
  if (!toast || !messageNode || !actionButton) return;

  if (hideTimer) clearTimeout(hideTimer);
  messageNode.textContent = message;
  actionButton.hidden = !actionLabel;
  actionButton.textContent = actionLabel || '';
  actionButton.onclick = action || null;
  toast.classList.add('visible');

  if (!persistent) {
    hideTimer = setTimeout(() => toast.classList.remove('visible'), 4500);
  }
}

export async function initializePwa() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('offline', () => {
    showToast('Offline mode — your adventure and saves remain available.');
  });
  window.addEventListener('online', () => {
    showToast('Back online.');
  });

  try {
    const registration = await navigator.serviceWorker.register('./sw.js');

    const offerUpdate = (worker) => {
      if (!worker) return;
      showToast(
        'A new SoloHiem version is ready.',
        'Update',
        () => worker.postMessage({ type: 'SKIP_WAITING' }),
        true,
      );
    };

    if (registration.waiting) offerUpdate(registration.waiting);
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          offerUpdate(worker);
        }
      });
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    // GitHub Pages can stay open for long sessions; check hourly for updates.
    setInterval(() => registration.update(), 60 * 60 * 1000);
  } catch (error) {
    console.warn('[PWA] Offline support unavailable:', error);
  }
}
