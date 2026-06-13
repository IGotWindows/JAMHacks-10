const StudiousAuth = (() => {
  const USERS_KEY = 'studious_users';
  const SESSION_KEY = 'studious_session';

  function getUsers() {
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function getCurrentUser() {
    const username = localStorage.getItem(SESSION_KEY);
    if (!username) return null;
    return getUsers().find((user) => user.username === username) || null;
  }

  function signUp({ firstName, lastName, birthday, username, password }) {
    if (!firstName || !lastName) return { ok: false, error: 'Please enter your first and last name.' };
    if (!birthday) return { ok: false, error: 'Please enter your birthday.' };
    if (!username) return { ok: false, error: 'Please choose a username.' };
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return { ok: false, error: 'Username must be 3–20 characters (letters, numbers, underscore).' };
    }
    if (!password || password.length < 4) {
      return { ok: false, error: 'Password must be at least 4 characters.' };
    }

    const users = getUsers();
    if (users.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
      return { ok: false, error: 'That username is already taken.' };
    }

    const user = {
      username,
      firstName,
      lastName,
      birthday,
      password,
      profilePicture: null,
    };
    users.push(user);
    saveUsers(users);
    localStorage.setItem(SESSION_KEY, username);
    return { ok: true };
  }

  function signIn(username, password) {
    if (!username || !password) {
      return { ok: false, error: 'Enter your username and password.' };
    }
    const user = getUsers().find(
      (entry) => entry.username.toLowerCase() === username.toLowerCase()
    );
    if (!user || user.password !== password) {
      return { ok: false, error: 'Invalid username or password.' };
    }
    localStorage.setItem(SESSION_KEY, user.username);
    return { ok: true };
  }

  function signOut() {
    localStorage.removeItem(SESSION_KEY);
  }

  function updateProfilePicture(dataUrl) {
    const current = getCurrentUser();
    if (!current) return false;
    const users = getUsers();
    const index = users.findIndex((user) => user.username === current.username);
    if (index === -1) return false;
    users[index].profilePicture = dataUrl;
    saveUsers(users);
    return true;
  }

  function requireAuth() {
    if (!getCurrentUser()) {
      window.location.href = '/login';
      return false;
    }
    return true;
  }

  function redirectIfAuthed() {
    if (getCurrentUser()) {
      window.location.href = '/dashboard';
      return true;
    }
    return false;
  }

  function initAuthPage() {
    const page = document.body.dataset.authPage;
    if (page === 'landing' || page === 'login' || page === 'signup') {
      redirectIfAuthed();
    }
  }

  function initProtectedPages() {
    if (document.body.dataset.requireAuth === 'true') {
      requireAuth();
    }
    const signOutBtn = document.getElementById('sign-out-btn');
    if (signOutBtn) {
      signOutBtn.addEventListener('click', () => {
        signOut();
        window.location.href = '/';
      });
    }
  }

  function showAuthError(el, message) {
    if (!el) return;
    el.textContent = message;
    el.classList.remove('hidden');
  }

  function bindAuthForms() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username')?.value.trim() || '';
        const password = document.getElementById('login-password')?.value || '';
        const errEl = document.getElementById('login-error');
        const result = signIn(username, password);
        if (result.ok) {
          window.location.href = loginForm.dataset.redirect || '/dashboard';
          return;
        }
        showAuthError(errEl, result.error);
      });
    }

    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
      signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const errEl = document.getElementById('signup-error');
        const result = signUp({
          firstName: document.getElementById('signup-first-name')?.value.trim() || '',
          lastName: document.getElementById('signup-last-name')?.value.trim() || '',
          birthday: document.getElementById('signup-birthday')?.value || '',
          username: document.getElementById('signup-username')?.value.trim() || '',
          password: document.getElementById('signup-password')?.value || '',
        });
        if (result.ok) {
          window.location.href = signupForm.dataset.redirect || '/dashboard';
          return;
        }
        showAuthError(errEl, result.error);
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initAuthPage();
    initProtectedPages();
    bindAuthForms();
  });

  return {
    getCurrentUser,
    signUp,
    signIn,
    signOut,
    updateProfilePicture,
    requireAuth,
    redirectIfAuthed,
  };
})();
