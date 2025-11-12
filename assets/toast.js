// /assets/toast.js  (ES module + namespaced DOM classes)
const TOAST_CONTAINER_ID = 'liab-toast-container';
const FLASH_KEY = 'toast_flash_message';

function ensureHost() {
  let el = document.getElementById(TOAST_CONTAINER_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = TOAST_CONTAINER_ID;
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'true');
    document.body.appendChild(el);
  }
  return el;
}

export function showToast({
  title='Success',
  message='',
  type='success',
  duration=2200,
  position='br'     // 'br' = bottom-right (default), 'center' = middle of screen
} = {}) {
  const host = ensureHost();
  const toast = document.createElement('div');
toast.className = `liab-toast liab-toast--${type}`;
// optional placement: 'top' | 'center' | default bottom-right
if (position === 'top') toast.classList.add('liab-toast--top');
if (position === 'center') toast.classList.add('liab-toast--center');

  toast.setAttribute('role','status');
  toast.innerHTML = `
    <div class="liab-toast__icon">${type==='error'?'✖':(type==='info'?'ℹ':'✔')}</div>
    <div class="liab-toast__content">
      <p class="liab-toast__title">${title}</p>
      ${message ? `<p class="liab-toast__msg">${message}</p>` : ''}
    </div>
    <button class="liab-toast__close" aria-label="Dismiss">×</button>
    <div class="liab-toast__progress"><i style="animation-duration:${duration}ms"></i></div>
  `;

 const remove = () => {
  if (toast.classList.contains('liab-toast--center')) {
    toast.style.animation = 'liab-toast-center-out .18s ease-in forwards';
  } else if (toast.classList.contains('liab-toast--top')) {
    toast.style.animation = 'liab-toast-top-out .18s ease-in forwards';
  } else {
    toast.style.animation = 'liab-toast-out .18s ease-in forwards';
  }
  setTimeout(() => toast.remove(), 180);
};



  toast.querySelector('.liab-toast__close').addEventListener('click', remove);
  setTimeout(remove, duration);
  host.appendChild(toast);
}


export function queueFlashToast(opts) {
  sessionStorage.setItem(FLASH_KEY, JSON.stringify(opts));
}

export function consumeFlashToast() {
  const raw = sessionStorage.getItem(FLASH_KEY);
  if (!raw) return;
  sessionStorage.removeItem(FLASH_KEY);
  try { showToast(JSON.parse(raw)); } catch {}
}

// Optional global (won't hurt)
if (typeof window !== 'undefined') window.Toast = { showToast, queueFlashToast, consumeFlashToast };

// Confirm toast with buttons. Returns Promise<boolean>
export function confirmToast({
  title = 'Are you sure?',
  message = '',
  okText = 'OK',
  cancelText = 'Cancel',
  type = 'error',        // red accent by default for destructive actions
} = {}) {
  return new Promise((resolve) => {
    const host = ensureHost();
    const toast = document.createElement('div');
    toast.className = `liab-toast liab-toast--${type} liab-toast--confirm`;
    toast.setAttribute('role','dialog');
    toast.setAttribute('aria-live','assertive');

    toast.innerHTML = `
      <div class="liab-toast__icon">${type==='error'?'✖':(type==='info'?'ℹ':'✔')}</div>
      <div class="liab-toast__content">
        <p class="liab-toast__title">${title}</p>
        ${message ? `<p class="liab-toast__msg">${message}</p>` : ''}
      </div>
      <button class="liab-toast__close" aria-label="Dismiss">×</button>
      <div class="liab-toast__actions">
        <button class="liab-btn liab-btn--ghost" data-action="cancel">${cancelText}</button>
        <button class="liab-btn liab-btn--danger" data-action="ok">${okText}</button>
      </div>
    `;

    const cleanup = (result) => {
      toast.style.animation = 'liab-toast-top-out .18s ease-in forwards';
      setTimeout(() => toast.remove(), 180);
      resolve(result);
      window.removeEventListener('keydown', onKey);
    };

    const onKey = (e) => {
      if (e.key === 'Escape') cleanup(false);
      if (e.key === 'Enter') cleanup(true);
    };

    toast.querySelector('.liab-toast__close').addEventListener('click', () => cleanup(false));
    toast.querySelector('[data-action="cancel"]').addEventListener('click', () => cleanup(false));
    toast.querySelector('[data-action="ok"]').addEventListener('click', () => cleanup(true));

    host.appendChild(toast);
    window.addEventListener('keydown', onKey);

    // focus OK for fast keyboard enter
    toast.querySelector('[data-action="ok"]').focus();
  });
}

// optional: expose on window
if (typeof window !== 'undefined') {
  window.Toast = window.Toast || {};
  window.Toast.confirmToast = confirmToast;
}

