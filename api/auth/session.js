import { clearSessionCookies, resolveSession, setSessionCookies } from '../../src/auth-session.mjs';
export default async function handler(request, response, { resolveSessionImpl = resolveSession } = {}) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') { response.setHeader('Allow', 'GET'); response.status(405).json({ error: 'METHOD_NOT_ALLOWED' }); return; }
  try { const session = await resolveSessionImpl(request); if (!session) { clearSessionCookies(response); response.status(401).json({ authenticated: false }); return; } if (session.refreshed) setSessionCookies(response, session.refreshed); response.status(200).json({ authenticated: true, user: session.user }); }
  catch { response.status(503).json({ error: 'AUTH_UNAVAILABLE' }); }
}
