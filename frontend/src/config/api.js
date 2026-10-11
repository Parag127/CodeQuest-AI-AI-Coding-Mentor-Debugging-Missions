/**
 * CodeDNA API Configuration & Client Adapter
 * 
 * Manages backend target resolution across local dev, Docker, Vercel Serverless, and cloud providers (Render).
 * Supports:
 * - Dynamic runtime override via localStorage (no rebuild required if user deploys backend elsewhere)
 * - Build-time VITE_API_URL environment variable injection
 * - Relative /api root proxying in HTTPS production (Vercel)
 * - Safe JSON parsing with automatic HTML-response detection
 */

const STORAGE_KEY = 'codedna_api_url';

/**
 * Returns the currently active backend API base URL (without trailing slash).
 */
export function getApiBase() {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && stored.trim()) {
        return stored.trim().replace(/\/+$/, '');
      }
    } catch {
      // Storage access blocked or restricted
    }
  }

  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // When deployed under HTTPS (e.g. Vercel production), relative root routes to /api
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return '';
  }

  // Local development default
  return 'http://localhost:5000';
}

/**
 * Saves a custom API URL override in localStorage and notifies the application.
 */
export function setCustomApiBase(url) {
  if (typeof window === 'undefined') return;
  const clean = (url || '').trim().replace(/\/+$/, '');
  if (!clean) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, clean);
  }
  window.dispatchEvent(new CustomEvent('codedna_api_changed', { detail: { url: clean } }));
}

/**
 * Clears custom API URL override and restores auto-detected backend URL.
 */
export function resetCustomApiBase() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('codedna_api_changed', { detail: { url: getApiBase() } }));
}

/**
 * Pings /api/health on the specified or current API base to test connectivity.
 */
export async function testApiConnection(customUrl = null) {
  const base = customUrl !== null ? (customUrl || '').trim().replace(/\/+$/, '') : getApiBase();
  const endpoint = `${base}/api/health`;
  const startTime = performance.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const latencyMs = Math.round(performance.now() - startTime);
    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('text/html')) {
      return {
        ok: false,
        error: 'Target URL returned HTML (SPA fallback or 404 page) instead of JSON from /api/health.'
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        error: `Server responded with HTTP ${res.status}: ${res.statusText}`
      };
    }

    const data = await res.json();
    return {
      ok: true,
      latencyMs,
      data
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { ok: false, error: 'Connection timed out after 6 seconds. Server may be spinning up.' };
    }
    return { ok: false, error: err.message || 'Network error reaching backend server.' };
  }
}

/**
 * Safe fetch wrapper that handles JSON deserialization, CORS issues, and HTML SPA fallbacks.
 */
export async function safeApiFetch(endpoint, options = {}) {
  const base = getApiBase();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${base}${cleanEndpoint}`;

  const res = await fetch(url, options);
  const contentType = res.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const data = await res.json();
    return {
      res,
      ok: res.ok,
      status: res.status,
      data,
      isHtml: false
    };
  }

  const text = await res.text();
  const isHtml = text.includes('<!DOCTYPE html') || text.includes('<html') || contentType.includes('text/html');

  if (isHtml) {
    return {
      res,
      ok: false,
      status: res.status,
      data: null,
      error: 'Backend API returned HTML instead of JSON. Ensure backend routes are active or configure backend URL in settings.',
      isHtml: true
    };
  }

  // Other text/plain formats
  return {
    res,
    ok: res.ok,
    status: res.status,
    data: text,
    isHtml: false
  };
}
