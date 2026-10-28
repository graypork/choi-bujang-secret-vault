import { clearSessionCookies } from '../../src/auth-session.mjs';
export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); response.status(405).json({ error: 'METHOD_NOT_ALLOWED' }); return; }
  clearSessionCookies(response); response.status(200).json({ authenticated: false });
}
