(function () {
  const STORAGE_KEY = 'studious_focus_session';
  const FOCUS_PAGE = 'focus';

  function formatTime(seconds) {
    const total = Math.floor(seconds);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function save(partial) {
    const current = load() || {};
    const next = { ...current, ...partial, active: true };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('studious-focus-session-updated', { detail: next }));
    return next;
  }

  function clear() {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('studious-focus-session-updated', { detail: null }));
  }

  function getElapsed(state) {
    if (!state?.active || !state.sessionStartedAt) return 0;
    return (Date.now() - state.sessionStartedAt) / 1000;
  }

  function isFocusPage() {
    return document.body?.dataset?.page === FOCUS_PAGE;
  }

  function ensureWidget() {
    if (document.getElementById('focus-session-pip')) return;

    const pip = document.createElement('div');
    pip.id = 'focus-session-pip';
    pip.className = 'focus-session-pip';
    pip.hidden = true;
    pip.innerHTML = `
      <div class="focus-session-pip-card">
        <p class="focus-session-pip-title">Focus session</p>
        <div class="focus-session-pip-row">
          <span class="focus-session-pip-label">Focused</span>
          <span id="pip-focused-time" class="focus-session-pip-time focus-session-pip-time-focused">00:00</span>
        </div>
        <div class="focus-session-pip-row">
          <span class="focus-session-pip-label">Session</span>
          <span id="pip-session-time" class="focus-session-pip-time">00:00</span>
        </div>
        <a href="/focus" class="focus-session-pip-link">Open focus</a>
      </div>
    `;
    document.body.appendChild(pip);
  }

  function updateWidget() {
    ensureWidget();
    const pip = document.getElementById('focus-session-pip');
    if (!pip) return;

    const state = load();
    const show = Boolean(state?.active) && !isFocusPage();
    pip.hidden = !show;
    if (!show) return;

    const focusedEl = document.getElementById('pip-focused-time');
    const sessionEl = document.getElementById('pip-session-time');
    if (focusedEl) {
      focusedEl.textContent = formatTime(state.focusedSeconds || 0);
      focusedEl.classList.toggle('is-counting', Boolean(state.isInFocusZone));
      focusedEl.classList.toggle('is-paused', !state.isInFocusZone);
    }
    if (sessionEl) {
      sessionEl.textContent = formatTime(getElapsed(state));
    }
  }

  function refreshBackgroundTracking() {
    if (typeof window.__studiousRefreshBackground === 'function') {
      window.__studiousRefreshBackground();
    }
  }

  function initWidget() {
    ensureWidget();
    updateWidget();
    refreshBackgroundTracking();
    setInterval(updateWidget, 1000);
    setInterval(refreshBackgroundTracking, 3000);
    window.addEventListener('studious-focus-session-updated', () => {
      updateWidget();
      refreshBackgroundTracking();
    });
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY) {
        updateWidget();
        refreshBackgroundTracking();
      }
    });
  }

  window.StudiousFocusSession = {
    STORAGE_KEY,
    load,
    save,
    clear,
    formatTime,
    getElapsed,
    isFocusPage,
    refreshBackgroundTracking,
    sync(active, sessionStartedAt, focusedSeconds, isInFocusZone) {
      if (!active) {
        clear();
        refreshBackgroundTracking();
        return;
      }
      save({
        sessionStartedAt,
        focusedSeconds,
        isInFocusZone: Boolean(isInFocusZone),
      });
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }
})();
