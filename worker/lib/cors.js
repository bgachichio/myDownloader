// Who may call this Worker from a browser. Every response is wrapped here, so no route can forget it.
// A wildcard origin turned the proxy into a free relay for any website, billed to this account.
export const ALLOWED_ORIGINS = [
  'https://mydownloader.gachichio.org',
  'https://mydownloader-f6a9e.web.app',
  'https://mydownloader-f6a9e.firebaseapp.com',
  'http://localhost:5173', // vite dev
  'http://localhost:4173', // vite preview
];

export function originAllowed(request) {
  const origin = request.headers.get('Origin');
  return !origin || ALLOWED_ORIGINS.includes(origin); // no Origin: a plain navigation or a script, handled by the rate limit
}

export function withCors(response, request) {
  const origin = request.headers.get('Origin');
  const headers = new Headers(response.headers);
  for (const h of [...headers.keys()]) if (h.toLowerCase().startsWith('access-control-')) headers.delete(h);
  headers.append('Vary', 'Origin');
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Range');
    headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type, Accept-Ranges');
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
