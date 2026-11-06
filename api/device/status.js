import { verifyRequestIdentity } from '../notes/read.js';

// No verified device attestation or approval registry is configured in this project.
// Never infer approval from login, browser installation, a submitted device ID or a click.
export async function confirmedDevice(request, { verifyIdentity = verifyRequestIdentity } = {}) {
  const identity = await verifyIdentity(request);
  if (!identity) return { authenticated: false, approved: false };
  return { authenticated: true, approved: false };
}

export default async function handler(request, response, { checkDevice = confirmedDevice } = {}) {
  response.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST');
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  const status = await checkDevice(request);
  if (!status.authenticated) return response.status(401).json({ approved: false, status: 'login_required' });
  if (request.method === 'POST') {
    // A request is not an approval. Without a trusted server-side device
    // enrollment/attestation service, accepting it would create an auth bypass.
    return response.status(503).json({ approved: false, status: 'approval_service_unavailable' });
  }
  return response.status(200).json({ approved: false, status: 'unverified' });
}
