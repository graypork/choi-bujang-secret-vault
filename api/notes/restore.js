import { createHash, timingSafeEqual } from 'node:crypto';
import { createNotesClient, verifyRequestIdentity } from './read.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const digest = value => createHash('sha256').update(value).digest('hex');
const equal = (a, b) => typeof a === 'string' && typeof b === 'string'
  && /^[a-f0-9]{64}$/u.test(a) && /^[a-f0-9]{64}$/u.test(b)
  && timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
const fail = code => { const error = new Error(code); error.code = code; throw error; };

// Backup remains a server-only environment variable. Never return or log its contents.
export function verifiedBackup(env = process.env) {
  if (!env.RESTORE_B_OWNER_ID || !UUID.test(env.RESTORE_B_OWNER_ID)
      || !env.RESTORE_NOTE_BACKUP_JSON) fail('BACKUP_UNAVAILABLE');
  let backup;
  try { backup = JSON.parse(env.RESTORE_NOTE_BACKUP_JSON); }
  catch { fail('BACKUP_INVALID'); }
  if (!backup || Object.keys(backup).sort().join(',') !== 'content,contentSha256,id,owner_id,title,version'
      || backup.version !== 'aleph.note.backup.v1'
      || !UUID.test(backup.id) || backup.owner_id !== env.RESTORE_B_OWNER_ID
      || typeof backup.title !== 'string' || !backup.title.trim()
      || typeof backup.content !== 'string' || !equal(digest(backup.content), backup.contentSha256)) {
    fail('BACKUP_INVALID');
  }
  return backup;
}

export async function restoreOne(identityId, id, mode, confirmation, options = {}) {
  const backup = verifiedBackup(options.env);
  if (identityId !== backup.owner_id || id !== backup.id) fail('RESTORE_FORBIDDEN');
  const client = await createNotesClient(options);
  const { data: existing, error: lookupError } = await client.from('learning_notes')
    .select('id, owner_id').eq('id', id).maybeSingle();
  if (lookupError) fail('DATA_SOURCE_UNAVAILABLE');
  if (existing) fail('RESTORE_CONFLICT'); // Never overwrite another row, even if owner matches.
  const plan = { version: backup.version, id: backup.id, owner_id: backup.owner_id,
    contentSha256: backup.contentSha256, scope: 'insert one missing learning_notes row; no other rows or audit records' };
  if (mode === 'preview') return { status: 'PREVIEW_ONLY', ...plan };
  if (mode !== 'apply' || !equal(confirmation, digest(JSON.stringify(plan)))) fail('CONFIRMATION_REQUIRED');
  const { data, error } = await client.from('learning_notes')
    .insert({ id: backup.id, owner_id: backup.owner_id, title: backup.title, content: backup.content })
    .select('id, owner_id, content').single();
  if (error || !data || data.id !== backup.id || data.owner_id !== backup.owner_id
      || !equal(digest(data.content), backup.contentSha256)) fail('RESTORE_VERIFY_FAILED');
  return { status: 'RESTORED', ...plan };
}

export function planConfirmation(plan) {
  return digest(JSON.stringify({ version: plan.version, id: plan.id, owner_id: plan.owner_id,
    contentSha256: plan.contentSha256, scope: plan.scope }));
}

export default async function handler(request, response, { verifyLoginAuthorization, restoreImpl = restoreOne } = {}) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  // Explicit bearer authorization avoids cookie-based cross-site POST.
  if (typeof request.headers?.authorization !== 'string' || !request.headers.authorization.startsWith('Bearer ')) {
    return response.status(401).json({ error: 'AUTH_REQUIRED' });
  }
  const identity = await verifyRequestIdentity(request, verifyLoginAuthorization);
  if (!identity) return response.status(401).json({ error: 'AUTH_REQUIRED' });
  try {
    const id = request.query?.id;
    if (typeof id !== 'string' || !UUID.test(id)) fail('INVALID_INPUT');
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) fail('INVALID_INPUT');
    const result = await restoreImpl(identity.userId, id, body.mode, body.confirmation);
    if (result.status === 'PREVIEW_ONLY') return response.status(200).json({ ...result, confirmation: planConfirmation(result) });
    return response.status(200).json(result);
  } catch (error) {
    const code = error.code || 'INVALID_INPUT';
    const status = code === 'RESTORE_FORBIDDEN' ? 403
      : code === 'RESTORE_CONFLICT' ? 409
      : code === 'INVALID_INPUT' || code === 'CONFIRMATION_REQUIRED' ? 400 : 503;
    return response.status(status).json({ error: code });
  }
}
