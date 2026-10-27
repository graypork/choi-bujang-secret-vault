import config from '../../aleph.config.json' with { type: 'json' };
import { createLoginVerifier } from '../../src/verify-login.mjs';

function codedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

export async function readLearningNotes({ env = process.env, createClientImpl } = {}) {
  const supabaseUrl = env.SUPABASE_URL;
  const secretKey = env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    throw codedError('SUPABASE_NOT_CONFIGURED');
  }

  const createClient = createClientImpl
    ?? (await import('@supabase/supabase-js')).createClient;
  const supabase = createClient(supabaseUrl, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabase
    .from('learning_notes')
    .select('id, title, content')
    .order('created_at', { ascending: true });

  if (error) {
    throw codedError('DATA_SOURCE_UNAVAILABLE');
  }

  return Array.isArray(data)
    ? data.map(({ id, title, content }) => ({ id, title, content }))
    : [];
}

export default async function handler(request, response, {
  verifyLoginAuthorization,
  readLearningNotesImpl = readLearningNotes,
} = {}) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const authorization = request.headers?.authorization;
  if (typeof authorization !== 'string' || !authorization.trim()) {
    response.setHeader('WWW-Authenticate', 'Bearer');
    response.status(401).json({ error: 'AUTH_REQUIRED' });
    return;
  }

  let identity = null;
  try {
    const verify = verifyLoginAuthorization ?? createLoginVerifier({
      config,
      supabaseSecretKey: process.env.SUPABASE_SECRET_KEY,
    });
    identity = await verify(authorization);
  } catch {
    identity = null;
  }

  if (!identity) {
    response.setHeader('WWW-Authenticate', 'Bearer');
    response.status(401).json({ error: 'AUTH_REQUIRED' });
    return;
  }

  try {
    const notes = await readLearningNotesImpl();
    response.status(200).json({ notes });
  } catch (error) {
    const code = error?.code === 'SUPABASE_NOT_CONFIGURED'
      ? 'SUPABASE_NOT_CONFIGURED'
      : 'DATA_SOURCE_UNAVAILABLE';
    response.status(code === 'SUPABASE_NOT_CONFIGURED' ? 503 : 502).json({ error: code });
  }
}
