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

export async function getLearningNote(id, options = {}) {
  const supabase = await createNotesClient(options);
  const { data, error } = await supabase
    .from('learning_notes')
    .select('id, title, content')
    .eq('id', id)
    .maybeSingle();
  if (error) throw codedError('DATA_SOURCE_UNAVAILABLE');
  return data ? { id: data.id, title: data.title, body: data.content } : null;
}

export async function updateLearningNote(id, rawInput, options = {}) {
  const input = normalizeNoteInput(rawInput, { allowId: false });
  const supabase = await createNotesClient(options);
  const { data, error } = await supabase
    .from('learning_notes')
    .update({ title: input.title, content: input.body })
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) throw codedError('DATA_SOURCE_UNAVAILABLE');
  return data?.id ? { id: data.id } : null;
}

export async function deleteLearningNote(id, options = {}) {
  const supabase = await createNotesClient(options);
  const { data, error } = await supabase
    .from('learning_notes')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) throw codedError('DATA_SOURCE_UNAVAILABLE');
  return data?.id ? { id: data.id } : null;
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
      const note = await getLearningNoteImpl(id);
      if (!note) {
        response.status(404).json({ error: 'NOT_FOUND' });
        return;
      }
      response.status(200).json(note);
      return;
    }

    if (request.method === 'PUT') {
      const input = normalizeNoteInput(request.body, { allowId: false });
      const updated = await updateLearningNoteImpl(id, input);
      if (!updated) {
        response.status(404).json({ error: 'NOT_FOUND' });
        return;
      }
      response.status(200).json(updated);
      return;
    }

    const deleted = await deleteLearningNoteImpl(id);
    if (!deleted) {
      response.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    response.status(200).json(deleted);
  } catch (error) {
    sendDataError(response, error);
  }
}
