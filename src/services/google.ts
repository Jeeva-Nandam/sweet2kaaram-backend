import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';
import { HttpError } from '../utils/http';

let client: OAuth2Client | null = null;

/** Verifies the ID token Google gave the browser. Never trust a token without this call. */
export async function verifyGoogleCredential(credential: string) {
  if (!env.googleClientId) throw new HttpError(500, 'Google login is not configured on the server (GOOGLE_CLIENT_ID)');
  client ??= new OAuth2Client(env.googleClientId);
  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: env.googleClientId });
    const p = ticket.getPayload();
    if (!p?.sub || !p.email) throw new Error('missing claims');
    if (!p.email_verified) throw new HttpError(401, 'Your Google email is not verified');
    return { googleId: p.sub, email: p.email.toLowerCase(), name: p.name || p.email.split('@')[0], picture: p.picture || '' };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(401, 'Google sign-in could not be verified. Please try again');
  }
}
