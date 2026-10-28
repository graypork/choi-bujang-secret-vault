import { createClient } from '@supabase/supabase-js';

export const ACCESS_COOKIE = 'aleph_access';
export const REFRESH_COOKIE = 'aleph_refresh';
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

function codedError(code) { const error = new Error(code); error.code = code; return error; }
export function parseCookies(header) {
  if (typeof header !== 'string' || !header) return {};
  return Object.fromEntries(header.split(';').map((part) => {
    const index = part.indexOf('='); if (index < 0) return [part.trim(), ''];
    const key = part.slice(0, index).trim(); const value = part.slice(index + 1).trim();
    try { return [key, decodeURIComponent(value)]; } catch { return [key, value]; }
  }).filter(([key]) => key));
}
export function requestAuthorization(request) {
  const header = request?.headers?.authorization;
  if (typeof header === 'string' && header.trim()) return header;
  const accessToken = parseCookies(request?.headers?.cookie)[ACCESS_COOKIE];
  return accessToken ? `Bearer ${accessToken}` : null;
}
export function readSessionCookies(request) { const cookies = parseCookies(request?.headers?.cookie); return { accessToken: cookies[ACCESS_COOKIE] || null, refreshToken: cookies[REFRESH_COOKIE] || null }; }
function cookie(name, value, maxAge) { return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.max(0, Math.trunc(maxAge))}`; }
export function setSessionCookies(response, session) {
  if (!session?.accessToken || !session?.refreshToken) throw codedError('INVALID_SESSION');
  const accessMaxAge = Number.isFinite(session.expiresIn) && session.expiresIn > 0 ? Math.trunc(session.expiresIn) : 3600;
  response.setHeader('Set-Cookie', [cookie(ACCESS_COOKIE, session.accessToken, accessMaxAge), cookie(REFRESH_COOKIE, session.refreshToken, REFRESH_MAX_AGE)]);
}
export function clearSessionCookies(response) { response.setHeader('Set-Cookie', [cookie(ACCESS_COOKIE, '', 0), cookie(REFRESH_COOKIE, '', 0)]); }
export async function createServerAuthClient({ env = process.env, createClientImpl = createClient } = {}) {
  const url = env.SUPABASE_URL; const secretKey = env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) throw codedError('AUTH_NOT_CONFIGURED');
  return createClientImpl(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
function normalizedSession(data) {
  const session = data?.session ?? data; const user = data?.user ?? session?.user;
  if (!session?.access_token || !session?.refresh_token || !user?.email) throw codedError('AUTH_UNAVAILABLE');
  return { accessToken: session.access_token, refreshToken: session.refresh_token, expiresIn: session.expires_in, user: { email: user.email } };
}
export async function signInWithPassword(email, password, options = {}) {
  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) throw codedError('INVALID_LOGIN');
  const client = await createServerAuthClient(options); const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw codedError('INVALID_LOGIN'); return normalizedSession(data);
}
export async function resolveSession(request, options = {}) {
  const { accessToken, refreshToken } = readSessionCookies(request); if (!accessToken && !refreshToken) return null;
  const client = await createServerAuthClient(options);
  if (accessToken) { const { data, error } = await client.auth.getUser(accessToken); if (!error && data?.user?.email) return { user: { email: data.user.email }, refreshed: null }; }
  if (!refreshToken) return null;
  const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken }); if (error) return null;
  const refreshed = normalizedSession(data); return { user: refreshed.user, refreshed };
}
