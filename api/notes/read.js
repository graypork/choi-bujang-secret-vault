import config from '../../aleph.config.json' with { type: 'json' };
import { createLoginVerifier } from '../../src/verify-login.mjs';
import { requestAuthorization } from '../../src/auth-session.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export function codedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

export async function createNotesClient({ env = process.env, createClientImpl } = {}) {
  const supabaseUrl = env.SUPABASE_URL;
  const secretKey = env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secretKey) throw codedError('SUPABASE_NOT_CONFIGURED');

  const createClient = createClientImpl
    ?? (await import('@supabase/supabase-js')).createClient;
  return createClient(supabaseUrl, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function verifyRequestIdentity(request, verifyLoginAuthorization) {
  const authorization = requestAuthorization(request);
  if (!authorization) return null;

  try {
    const verify = verifyLoginAuthorization ?? createLoginVerifier({
      config,
      supabaseSecretKey: process.env.SUPABASE_SECRET_KEY,
    });
    const identity = await verify(authorization);
    return identity && typeof identity.userId === 'string' && UUID.test(identity.userId)
      ? identity
      : null;
  } catch {
    return null;
  }
}

export function normalizeNoteInput(raw, { allowId = true } = {}) {
  let input = raw;
  if (typeof input === 'string') {
    try { input = JSON.parse(input); } catch { throw codedError('INVALID_INPUT'); }
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw codedError('INVALID_INPUT');

  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const body = input.body;
  if (!title || typeof body !== 'string') throw codedError('INVALID_INPUT');

  const note = { title, body };
  if (allowId && input.id !== undefined) {
    if (typeof input.id !== 'string' || !UUID.test(input.id)) throw codedError('INVALID_INPUT');
    note.id = input.id;
  }
  return note;
}

export async function listLearningNotes(userId, options = {}) {
  const supabase = await createNotesClient(options);
  const { data, error } = await supabase
    .from('learning_notes')
    .select('id, title, content')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw codedError('DATA_SOURCE_UNAVAILABLE');
  return Array.isArray(data)
    ? data.map(({ id, title, content }) => ({ id, title, body: content }))
    : [];
}

export async function createLearningNote(userId, rawInput, options = {}) {
  const input = normalizeNoteInput(rawInput);
  const supabase = await createNotesClient(options);
  const row = { owner_id: userId, title: input.title, content: input.body };
  if (input.id) row.id = input.id;

  const { data, error } = await supabase
    .from('learning_notes')
    .insert(row)
    .select('id')
    .single();

  if (error || !data?.id) throw codedError('DATA_SOURCE_UNAVAILABLE');
  return { id: data.id };
}

function sendDataError(response, error) {
  if (error?.code === 'INVALID_INPUT') {
    response.status(400).json({ error: 'INVALID_INPUT' });
    return;
  }
  const code = error?.code === 'SUPABASE_NOT_CONFIGURED'
    ? 'SUPABASE_NOT_CONFIGURED'
    : 'DATA_SOURCE_UNAVAILABLE';
  response.status(code === 'SUPABASE_NOT_CONFIGURED' ? 503 : 502).json({ error: code });
}

export default async function handler(request, response, {
  verifyLoginAuthorization,
  listLearningNotesImpl = listLearningNotes,
  createLearningNoteImpl = createLearningNote,
} = {}) {
  response.setHeader('Cache-Control', 'no-store');

  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST');
    response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const identity = await verifyRequestIdentity(request, verifyLoginAuthorization);
  if (!identity) {
    response.setHeader('WWW-Authenticate', 'Bearer');
    response.status(401).json({ error: 'AUTH_REQUIRED' });
    return;
  }

  try {
    if (request.method === 'GET') {
      const notes = await listLearningNotesImpl(identity.userId);
      response.status(200).json(notes);
      return;
    }

    const input = normalizeNoteInput(request.body);
    const created = await createLearningNoteImpl(identity.userId, input);
    response.status(201).json(created);
  } catch (error) {
    sendDataError(response, error);
  }
}
