import {
  codedError,
  createNotesClient,
  normalizeNoteInput,
  verifyRequestIdentity,
} from './read.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

function noteId(request) {
  const id = request.query?.id;
  if (typeof id !== 'string' || !UUID.test(id)) throw codedError('INVALID_INPUT');
  return id;
}

export async function getLearningNote(userId, id, options = {}) {
  const supabase = await createNotesClient(options);
  const { data, error } = await supabase
    .from('learning_notes')
    .select('id, title, content, owner_id')
    .eq('id', id)
    .eq('owner_id', userId)
    .maybeSingle();
  if (error) throw codedError('DATA_SOURCE_UNAVAILABLE');
  if (!data || data.owner_id !== userId) return null;
  return { id: data.id, title: data.title, body: data.content };
}

export async function updateLearningNote(userId, id, rawInput, options = {}) {
  const input = normalizeNoteInput(rawInput, { allowId: false });
  const supabase = await createNotesClient(options);

  const { data: existing, error: existingError } = await supabase
    .from('learning_notes')
    .select('id, owner_id')
    .eq('id', id)
    .eq('owner_id', userId)
    .maybeSingle();
  if (existingError) throw codedError('DATA_SOURCE_UNAVAILABLE');
  if (!existing || existing.owner_id !== userId) return null;

  const { data, error } = await supabase
    .from('learning_notes')
    .update({ title: input.title, content: input.body })
    .eq('id', id)
    .eq('owner_id', userId)
    .select('id, owner_id')
    .maybeSingle();
  if (error) throw codedError('DATA_SOURCE_UNAVAILABLE');
  return data?.id && data.owner_id === userId ? { id: data.id } : null;
}

export async function deleteLearningNote(userId, id, options = {}) {
  const supabase = await createNotesClient(options);
  const { data, error } = await supabase
    .from('learning_notes')
    .delete()
    .eq('id', id)
    .eq('owner_id', userId)
    .select('id, owner_id')
    .maybeSingle();
  if (error) throw codedError('DATA_SOURCE_UNAVAILABLE');
  return data?.id && data.owner_id === userId ? { id: data.id } : null;
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
  getLearningNoteImpl = getLearningNote,
  updateLearningNoteImpl = updateLearningNote,
  deleteLearningNoteImpl = deleteLearningNote,
} = {}) {
  response.setHeader('Cache-Control', 'no-store');

  if (!['GET', 'PUT', 'DELETE'].includes(request.method)) {
    response.setHeader('Allow', 'GET, PUT, DELETE');
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
    const id = noteId(request);
    if (request.method === 'GET') {
      const note = await getLearningNoteImpl(identity.userId, id);
      if (!note) {
        response.status(404).json({ error: 'NOT_FOUND' });
        return;
      }
      response.status(200).json(note);
      return;
    }

    if (request.method === 'PUT') {
      const input = normalizeNoteInput(request.body, { allowId: false });
      const updated = await updateLearningNoteImpl(identity.userId, id, input);
      if (!updated) {
        response.status(404).json({ error: 'NOT_FOUND' });
        return;
      }
      response.status(200).json(updated);
      return;
    }

    const deleted = await deleteLearningNoteImpl(identity.userId, id);
    if (!deleted) {
      response.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    response.status(200).json(deleted);
  } catch (error) {
    sendDataError(response, error);
  }
}
