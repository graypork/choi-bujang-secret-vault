import { setSessionCookies, signInWithPassword } from '../../src/auth-session.mjs';
function parseBody(body) { if (body && typeof body === 'object' && !Array.isArray(body)) return body; if (typeof body === 'string') { try { return JSON.parse(body); } catch { return {}; } } return {}; }
export default async function handler(request, response, { signInWithPasswordImpl = signInWithPassword } = {}) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); response.status(405).json({ error: 'METHOD_NOT_ALLOWED' }); return; }
  const { email, password } = parseBody(request.body);
  try { const session = await signInWithPasswordImpl(email, password); setSessionCookies(response, session); response.status(200).json({ authenticated: true, user: session.user }); }
  catch (error) { if (error?.code === 'INVALID_LOGIN') { response.status(401).json({ error: 'INVALID_LOGIN' }); return; } response.status(503).json({ error: 'AUTH_UNAVAILABLE' }); }
}
