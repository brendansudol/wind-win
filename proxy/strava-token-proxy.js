/**
 * Strava token proxy — Cloudflare Worker.
 *
 * Strava's OAuth has no PKCE, so the code→token exchange needs the client
 * secret. This worker holds it so the mobile app never ships it.
 *
 * Deploy:  npx wrangler deploy proxy/strava-token-proxy.js
 * Secrets: npx wrangler secret put STRAVA_CLIENT_ID
 *          npx wrangler secret put STRAVA_CLIENT_SECRET
 * Then set EXPO_PUBLIC_STRAVA_TOKEN_PROXY_URL to the worker URL in .env.
 */
export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));

    let params;
    if (url.pathname === '/exchange' && body.code) {
      params = { grant_type: 'authorization_code', code: body.code };
    } else if (url.pathname === '/refresh' && body.refresh_token) {
      params = { grant_type: 'refresh_token', refresh_token: body.refresh_token };
    } else {
      return new Response('Bad request', { status: 400 });
    }

    const upstream = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.STRAVA_CLIENT_ID,
        client_secret: env.STRAVA_CLIENT_SECRET,
        ...params,
      }).toString(),
    });

    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
