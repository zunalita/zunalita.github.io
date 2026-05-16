if (!window.zunalitaLoginJSInitialized) {
  window.zunalitaLoginJSInitialized = true;

  (function () {
    const AUTH_KEY = 'authorization';
    const LOGIN_PAGE = '/login/';
    const PENDING_KEY = 'login_pending';

    function getQueryParam(name) {
      return new URLSearchParams(window.location.search).get(name);
    }

    function isValidGitHubToken(token) {
      return typeof token === 'string' && token.length > 30;
    }

    function getStoredToken() {
      const token = localStorage.getItem(AUTH_KEY);
      return isValidGitHubToken(token) ? token : null;
    }

    function setStoredToken(token) {
      if (!isValidGitHubToken(token)) return;
      localStorage.setItem(AUTH_KEY, token);
    }

    function removeStoredToken() {
      localStorage.removeItem(AUTH_KEY);
    }

    function getPendingState() {
      const raw = localStorage.getItem(PENDING_KEY);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        localStorage.removeItem(PENDING_KEY);
        return null;
      }
    }

    function savePendingState(next, msg) {
      const payload = { next: next || '/', msg: msg || '' };
      localStorage.setItem(PENDING_KEY, JSON.stringify(payload));
    }

    function removePendingState() {
      localStorage.removeItem(PENDING_KEY);
    }

    function normalizePath(path) {
      if (!path) return '/';
      return path.replace(/\/index\.html$/, '/').replace(/\/$/, '') || '/';
    }

    function isLoginPath(path) {
      const normalized = normalizePath(path);
      return normalized === '/login';
    }

    function buildLoginUrl({ next, msg } = {}) {
      const params = new URLSearchParams();
      if (next) params.set('next', next);
      if (msg) params.set('msg', msg);
      return `${LOGIN_PAGE}?${params.toString()}`;
    }

    function encodeState(data) {
      try {
        return btoa(JSON.stringify(data));
      } catch {
        return '';
      }
    }

    function decodeState(value) {
      if (!value) return null;
      try {
        return JSON.parse(atob(value));
      } catch {
        return null;
      }
    }

    function redirectToLogin(nextPath, message) {
      const next = nextPath || window.location.pathname;
      window.location.href = buildLoginUrl({ next, msg: message });
    }

    function updateLoginMessage() {
      const msg = getQueryParam('msg');
      const pending = getPendingState();
      const finalMsg = msg || pending?.msg;
      if (!finalMsg) return;
      const loginText = document.getElementById('login-text');
      if (!loginText) return;
      loginText.textContent = finalMsg;
    }

    async function handleOAuthCallback() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (!code) return false;

      let pending = getPendingState();
      const state = params.get('state');
      if (!pending && state) {
        pending = decodeState(state) || pending;
      }

      try {
        const res = await fetch('https://zunalita.vercel.app/api/oauth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          data = Object.fromEntries(new URLSearchParams(text));
        }

        let token = data?.token || data?.access_token || data?.accessToken || data?.github_token || data?.githubToken;
        if (!token && typeof data === 'string') token = data.trim();
        if (!token && text && !text.includes('<') && !text.includes('=') && text.trim().length > 0) token = text.trim();

        if (token && isValidGitHubToken(token)) {
          setStoredToken(token);
          window.githubToken = token;
          removePendingState();
          window.location.href = pending?.next || '/';
          return true;
        }

        console.error('OAuth callback did not return a valid token', {
          status: res.status,
          ok: res.ok,
          body: text,
          parsed: data,
        });
      } catch (error) {
        console.error('OAuth callback failed', error);
        removeStoredToken();
      }
      return false;
    }

    function runLoginPage() {
      updateLoginMessage();

      const auth = getStoredToken();
      const pending = getPendingState();
      const next = getQueryParam('next') || pending?.next || '/';
      const msg = getQueryParam('msg') || pending?.msg || '';

      if (auth) {
        window.githubToken = auth;
        window.location.href = next;
        return;
      }

      handleOAuthCallback().then((success) => {
        if (success) {
          return;
        }
      });

      const loginBtn = document.getElementById('login-btn');
      const clientId = 'Ov23lim8Ua2vYmUluLTp';
      const scope = 'repo';
      const state = encodeState({ next, msg });
      const oauthUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}`;
      loginBtn?.addEventListener('click', () => {
        savePendingState(next, msg);
        window.location.href = oauthUrl;
      });
    }

    function runProtectedPage() {
      const auth = getStoredToken();
      if (auth) {
        window.githubToken = auth;
        return;
      }
      redirectToLogin(window.location.pathname + window.location.search, 'Please login first to access this page');
    }

    document.addEventListener('DOMContentLoaded', () => {
      if (isLoginPath(window.location.pathname)) {
        runLoginPage();
      } else {
        runProtectedPage();
      }
    });
  })();
}
