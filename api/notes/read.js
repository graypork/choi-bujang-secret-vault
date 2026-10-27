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

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  try {
    const notes = await readLearningNotes();
    response.status(200).json({ notes });
  } catch (error) {
    const code = error?.code === 'SUPABASE_NOT_CONFIGURED'
      ? 'SUPABASE_NOT_CONFIGURED'
      : 'DATA_SOURCE_UNAVAILABLE';
    response.status(code === 'SUPABASE_NOT_CONFIGURED' ? 503 : 502).json({ error: code });
  }
}
