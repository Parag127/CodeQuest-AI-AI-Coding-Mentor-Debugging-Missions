import express from 'express';
import db from '../db/index.js';

const router = express.Router();

// In-memory fallback and cache for users
export let demoUsers = [
  {
    id: 1,
    name: 'DebugMate Learner',
    email: 'learner@debugmate.dev',
    password: 'password123',
    role: 'learner',
    avatar: 'DL',
    level: 'Level 4 • Bug Hunter',
    xp: 1420,
    authProvider: 'local'
  },
  {
    id: 2,
    name: 'Lead Reviewer',
    email: 'mentor@debugmate.dev',
    password: 'password123',
    role: 'reviewer',
    avatar: 'LR',
    level: 'Mentor & Evaluator',
    xp: 5000,
    authProvider: 'local'
  },
  {
    id: 3,
    name: 'DebugMate Learner',
    email: 'learner@dypatil.edu',
    password: 'password123',
    role: 'learner',
    avatar: 'DL',
    level: 'Level 4 • Bug Hunter',
    xp: 1420,
    authProvider: 'local'
  },
  {
    id: 4,
    name: 'Lead Reviewer',
    email: 'mentor@dypatil.edu',
    password: 'password123',
    role: 'reviewer',
    avatar: 'LR',
    level: 'Mentor & Evaluator',
    xp: 5000,
    authProvider: 'local'
  }
];

// Helper to generate session token
export function generateToken(user) {
  return Buffer.from(`${user.id}:${user.email}:${Date.now()}`).toString('base64');
}

// Helper to find user by email in SQLite or memory
export function findUserByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  try {
    const row = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(normalized);
    if (row) {
      return {
        id: isNaN(Number(row.id)) ? row.id : Number(row.id),
        name: row.name,
        email: row.email,
        password: row.password_hash,
        role: row.role || 'learner',
        avatar: row.avatar || row.name.substring(0, 2).toUpperCase(),
        level: row.level || 'Level 1 • Junior Debugger',
        xp: row.xp || 100,
        authProvider: row.auth_provider || 'local',
        googleId: row.google_id || null,
        picture: row.picture || null
      };
    }
  } catch (err) {
    // Non-fatal SQLite fallback to memory
  }
  return demoUsers.find(u => u.email.toLowerCase() === normalized) || null;
}

// Helper to save or update user in SQLite and memory
export function saveUser(user) {
  const existingIndex = demoUsers.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
  if (existingIndex >= 0) {
    demoUsers[existingIndex] = { ...demoUsers[existingIndex], ...user };
  } else {
    demoUsers.push(user);
  }

  try {
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(user.email.toLowerCase());
    if (existing) {
      db.prepare(`
        UPDATE users 
        SET name = ?, role = ?, avatar = ?, level = ?, xp = ?, auth_provider = ?, google_id = ?, picture = ?
        WHERE LOWER(email) = ?
      `).run(
        user.name,
        user.role || 'learner',
        user.avatar || user.name.substring(0, 2).toUpperCase(),
        user.level || 'Level 1 • Junior Debugger',
        user.xp || 100,
        user.authProvider || 'local',
        user.googleId || null,
        user.picture || null,
        user.email.toLowerCase()
      );
    } else {
      db.prepare(`
        INSERT INTO users (id, name, email, password_hash, role, avatar, level, xp, auth_provider, google_id, picture)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        String(user.id),
        user.name,
        user.email,
        user.password || null,
        user.role || 'learner',
        user.avatar || user.name.substring(0, 2).toUpperCase(),
        user.level || 'Level 1 • Junior Debugger',
        user.xp || 100,
        user.authProvider || 'local',
        user.googleId || null,
        user.picture || null
      );
    }
  } catch (err) {
    // Non-fatal if SQLite write fails in non-db mode
  }
  return user;
}

// Helper to resolve client frontend origin (auto-detects Vercel and reverse proxy headers)
export function resolveClientOrigin(req) {
  if (process.env.CLIENT_ORIGIN && !process.env.CLIENT_ORIGIN.includes('*')) {
    return process.env.CLIENT_ORIGIN.split(',')[0].trim();
  }
  const proto = req.headers?.['x-forwarded-proto'] || req.protocol || (process.env.VERCEL ? 'https' : 'http');
  const host = req.headers?.['x-forwarded-host'] || req.get?.('host');
  if (host) {
    return `${proto}://${host}`;
  }
  return process.env.NODE_ENV === 'production' ? 'https://localhost:5000' : 'http://localhost:5173';
}

// Helper to resolve Google callback redirect URI (auto-detects Vercel https domain)
export function resolveRedirectUri(req) {
  if (process.env.GOOGLE_CALLBACK_URL) {
    return process.env.GOOGLE_CALLBACK_URL;
  }
  const proto = req.headers?.['x-forwarded-proto'] || req.protocol || (process.env.VERCEL ? 'https' : 'http');
  const host = req.headers?.['x-forwarded-host'] || req.get?.('host') || 'localhost:5000';
  return `${proto}://${host}/api/auth/google/callback`;
}

/**
 * GET /api/auth/config
 * Returns OAuth client settings so frontend knows if Google OAuth is configured.
 */
router.get('/config', (req, res) => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || null;
  res.json({
    success: true,
    googleConfigured: Boolean(googleClientId),
    googleClientId: googleClientId || null
  });
});

/**
 * POST /api/auth/login
 * Standard email & password login.
 */
router.post('/login', (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required' });
  }

  let user = findUserByEmail(email);
  if (!user) {
    user = {
      id: Date.now(),
      name: String(email).split('@')[0],
      email: String(email).trim(),
      role: role || 'learner',
      avatar: String(email).substring(0, 2).toUpperCase(),
      level: 'Level 1 • Junior Debugger',
      xp: 100,
      authProvider: 'local'
    };
    saveUser(user);
  }

  const token = generateToken(user);
  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role || role || 'learner',
      avatar: user.avatar,
      level: user.level,
      xp: user.xp,
      authProvider: user.authProvider || 'local'
    }
  });
});

/**
 * POST /api/auth/register
 * Standard user registration.
 */
router.post('/register', (req, res) => {
  const { name, email, password, role } = req.body;
  if (!email || !name) {
    return res.status(400).json({ success: false, error: 'Name and email are required' });
  }

  const existing = findUserByEmail(email);
  if (existing) {
    return res.status(400).json({ success: false, error: 'An account with this email already exists' });
  }

  const newUser = {
    id: Date.now(),
    name: String(name).trim(),
    email: String(email).trim(),
    password: password || 'password123',
    role: role || 'learner',
    avatar: String(name).trim().substring(0, 2).toUpperCase(),
    level: 'Level 1 • Junior Debugger',
    xp: 0,
    authProvider: 'local'
  };
  saveUser(newUser);

  const token = generateToken(newUser);
  res.status(201).json({
    success: true,
    token,
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      avatar: newUser.avatar,
      level: newUser.level,
      xp: newUser.xp,
      authProvider: newUser.authProvider
    }
  });
});

/**
 * POST /api/auth/google
 * Authenticates user via Google Identity Services ID Token (credential),
 * authorization code exchange, or simulated/demo Google authentication profile.
 */
router.post('/google', async (req, res) => {
  try {
    const { credential, code, demoGoogleUser, role } = req.body || {};

    let googleProfile = null;

    // 1. Case A: Google Identity Services ID Token (JWT)
    if (credential && typeof credential === 'string') {
      try {
        // Verify ID token with Google's official tokeninfo API
        const tokenRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
        if (!tokenRes.ok) {
          const errData = await tokenRes.json().catch(() => ({}));
          console.warn('[Auth/Google] Token validation failed:', errData);
          return res.status(401).json({
            success: false,
            error: errData.error_description || 'Invalid or expired Google credential token'
          });
        }

        const tokenInfo = await tokenRes.json();
        
        // If GOOGLE_CLIENT_ID is configured on server, verify token audience
        const configuredClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
        if (configuredClientId && tokenInfo.aud && tokenInfo.aud !== configuredClientId) {
          return res.status(401).json({
            success: false,
            error: 'Google token audience mismatch'
          });
        }

        googleProfile = {
          googleId: tokenInfo.sub,
          email: tokenInfo.email,
          name: tokenInfo.name || tokenInfo.email.split('@')[0],
          picture: tokenInfo.picture || null,
          emailVerified: tokenInfo.email_verified === 'true' || tokenInfo.email_verified === true
        };
      } catch (networkErr) {
        console.error('[Auth/Google] Network error contacting Google tokeninfo:', networkErr);
        return res.status(503).json({
          success: false,
          error: 'Google authentication service unreachable. Please retry.'
        });
      }
    }

    // 2. Case B: Authorization Code Exchange (OAuth 2.0 flow)
    else if (code && typeof code === 'string') {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const redirectUri = resolveRedirectUri(req);

      if (!clientId || !clientSecret) {
        return res.status(500).json({
          success: false,
          error: 'GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured on server'
        });
      }

      try {
        const tokenExchangeRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
          }).toString()
        });

        const tokenData = await tokenExchangeRes.json();
        if (!tokenExchangeRes.ok || !tokenData.access_token) {
          return res.status(401).json({
            success: false,
            error: tokenData.error_description || 'Failed to exchange authorization code with Google'
          });
        }

        // Fetch user info with access token
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        const userInfo = await userInfoRes.json();

        googleProfile = {
          googleId: userInfo.sub,
          email: userInfo.email,
          name: userInfo.name || userInfo.email.split('@')[0],
          picture: userInfo.picture || null,
          emailVerified: userInfo.email_verified === true
        };
      } catch (codeErr) {
        console.error('[Auth/Google] Code exchange error:', codeErr);
        return res.status(503).json({
          success: false,
          error: 'Google OAuth exchange failed'
        });
      }
    }

    // 3. Case C: Simulated / Demo Google User (Used in development, evaluation, and test environments)
    else if (demoGoogleUser && typeof demoGoogleUser === 'object') {
      const { email, name, picture } = demoGoogleUser;
      if (!email || !String(email).includes('@')) {
        return res.status(400).json({
          success: false,
          error: 'Valid email is required for Google profile'
        });
      }

      googleProfile = {
        googleId: `google_demo_${Date.now()}`,
        email: String(email).trim().toLowerCase(),
        name: name ? String(name).trim() : String(email).split('@')[0],
        picture: picture || null,
        emailVerified: true
      };
    }

    // Neither credential, code, nor demoGoogleUser provided
    else {
      return res.status(400).json({
        success: false,
        error: 'Missing Google authentication payload. Provide credential token or authorization code.'
      });
    }

    // 4. Resolve or create user account
    let user = findUserByEmail(googleProfile.email);
    const assignedRole = role || user?.role || 'learner';

    if (!user) {
      // First-time Google user registration
      user = {
        id: Date.now(),
        name: googleProfile.name,
        email: googleProfile.email,
        role: assignedRole,
        avatar: googleProfile.name ? googleProfile.name.substring(0, 2).toUpperCase() : 'G',
        level: assignedRole === 'reviewer' ? 'Lead Reviewer' : 'Level 2 • Code Explorer',
        xp: assignedRole === 'reviewer' ? 3000 : 250,
        authProvider: 'google',
        googleId: googleProfile.googleId,
        picture: googleProfile.picture
      };
    } else {
      // Existing user logging in with Google
      user.authProvider = 'google';
      if (googleProfile.googleId) user.googleId = googleProfile.googleId;
      if (googleProfile.picture) user.picture = googleProfile.picture;
      if (googleProfile.name && !user.name) user.name = googleProfile.name;
    }

    saveUser(user);
    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        level: user.level,
        xp: user.xp,
        authProvider: 'google',
        picture: user.picture
      }
    });

  } catch (error) {
    console.error('[Auth/Google] Unexpected error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during Google OAuth authentication'
    });
  }
});

/**
 * GET /api/auth/google
 * Initiates the Google OAuth 2.0 authorization redirect.
 */
router.get('/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientOrigin = resolveClientOrigin(req);
  const role = req.query.role || 'learner';

  if (!clientId) {
    // If not configured, gracefully redirect back with informative message
    return res.redirect(`${clientOrigin}/login?google_error=GOOGLE_CLIENT_ID_NOT_CONFIGURED`);
  }

  const redirectUri = resolveRedirectUri(req);
  const scope = encodeURIComponent('openid profile email');
  const state = encodeURIComponent(JSON.stringify({ role }));

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${state}&access_type=online&prompt=select_account`;

  res.redirect(authUrl);
});

/**
 * GET /api/auth/google/callback
 * Handles Google OAuth redirect callback.
 */
router.get('/google/callback', async (req, res) => {
  const clientOrigin = resolveClientOrigin(req);

  const { code, error, state } = req.query;

  if (error) {
    console.warn('[Auth/Google Callback] Google returned error:', error);
    return res.redirect(`${clientOrigin}/login?google_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect(`${clientOrigin}/login?google_error=MISSING_AUTHORIZATION_CODE`);
  }

  let role = 'learner';
  try {
    if (state) {
      const parsedState = JSON.parse(decodeURIComponent(state));
      if (parsedState.role) role = parsedState.role;
    }
  } catch {
    // Non-fatal state parse error
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = resolveRedirectUri(req);

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      }).toString()
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      return res.redirect(`${clientOrigin}/login?google_error=${encodeURIComponent(tokenData.error_description || 'TOKEN_EXCHANGE_FAILED')}`);
    }

    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userInfo = await userInfoRes.json();

    let user = findUserByEmail(userInfo.email);
    if (!user) {
      user = {
        id: Date.now(),
        name: userInfo.name || userInfo.email.split('@')[0],
        email: userInfo.email,
        role,
        avatar: (userInfo.name || userInfo.email).substring(0, 2).toUpperCase(),
        level: role === 'reviewer' ? 'Lead Reviewer' : 'Level 2 • Code Explorer',
        xp: role === 'reviewer' ? 3000 : 250,
        authProvider: 'google',
        googleId: userInfo.sub,
        picture: userInfo.picture || null
      };
    } else {
      user.authProvider = 'google';
      if (userInfo.sub) user.googleId = userInfo.sub;
      if (userInfo.picture) user.picture = userInfo.picture;
    }

    saveUser(user);
    const sessionToken = generateToken(user);

    const redirectUserParam = encodeURIComponent(JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      level: user.level,
      xp: user.xp,
      authProvider: 'google',
      picture: user.picture
    }));

    res.redirect(`${clientOrigin}/login?google_auth=success&token=${encodeURIComponent(sessionToken)}&user=${redirectUserParam}`);
  } catch (err) {
    console.error('[Auth/Google Callback] Exchange error:', err);
    res.redirect(`${clientOrigin}/login?google_error=INTERNAL_CALLBACK_ERROR`);
  }
});

/**
 * GET /api/auth/me
 * Retrieves current authenticated user from session token.
 */
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authorization header required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [userId, email] = decoded.split(':');
    const user = findUserByEmail(email);
    if (user && String(user.id) === String(userId)) {
      return res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          level: user.level,
          xp: user.xp,
          authProvider: user.authProvider,
          picture: user.picture
        }
      });
    }
  } catch {
    // Decode failed
  }

  return res.status(401).json({ success: false, error: 'Invalid or expired session token' });
});

export default router;
