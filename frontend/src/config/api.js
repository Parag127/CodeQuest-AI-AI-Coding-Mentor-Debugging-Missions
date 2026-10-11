/**
 * DebugMate API Configuration & Client Adapter
 * 
 * Manages backend target resolution across local dev, Docker, Vercel Serverless, and cloud providers (Render).
 * Supports:
 * - Dynamic runtime override via localStorage (no rebuild required if user deploys backend elsewhere)
 * - Build-time VITE_API_URL environment variable injection
 * - Relative /api root proxying in HTTPS production (Vercel)
 * - Safe JSON parsing with automatic HTML-response detection
 */

const STORAGE_KEY = 'debugmate_api_url';

/**
 * Returns the currently active backend API base URL (without trailing slash).
 */
export function getApiBase() {
  const isBrowser = typeof window !== 'undefined';
  const isDeployed = isBrowser && 
                     window.location.hostname !== 'localhost' && 
                     window.location.hostname !== '127.0.0.1';

  // 1. Check user-configured override from IDE settings modal
  if (isBrowser) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && stored.trim()) {
        const cleanStored = stored.trim().replace(/\/+$/, '');
        // If deployed to production, ignore stored localhost URLs to prevent mixed content errors
        if (!(isDeployed && (cleanStored.includes('localhost') || cleanStored.includes('127.0.0.1')))) {
          return cleanStored;
        }
      }
    } catch {
      // Storage access blocked or restricted
    }
  }

  // 2. Check build-time or runtime environment variable
  const envUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');

  // 3. When deployed on Vercel or cloud domain (non-localhost):
  if (isDeployed) {
    // If VITE_API_URL is an external production URL (e.g. Render, Railway), use it
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
      return envUrl;
    }
    // Otherwise, use relative same-origin root (/api/* on Vercel)
    return '';
  }

  // 4. Local development: use envUrl if provided, otherwise default to port 5000
  if (envUrl) {
    return envUrl;
  }

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
  window.dispatchEvent(new CustomEvent('debugmate_api_changed', { detail: { url: clean } }));
}

/**
 * Clears custom API URL override and restores auto-detected backend URL.
 */
export function resetCustomApiBase() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  const base = getApiBase();
  window.dispatchEvent(new CustomEvent('debugmate_api_changed', { detail: { url: base } }));
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
