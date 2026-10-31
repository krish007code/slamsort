import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
export interface VerifiedIdentity { uid: string; aud: string; iss: string }
/** Auth audience is the Firebase project, independent of Vertex billing/ADC. */
export function createTokenVerifier(projectId: string) {
  const name = `slamsort-auth-${projectId}`;
  return async (token: string): Promise<VerifiedIdentity> => {
    const app = getApps().find(app => app.name === name) ?? initializeApp({ projectId }, name);
    // Signature, expiry, audience and issuer are verified by Admin SDK. No user lookup
    // or revoked-token RPC: that would require cross-project user-management IAM.
    const decoded = await getAuth(app).verifyIdToken(token);
    if (decoded.aud !== projectId || decoded.iss !== `https://securetoken.google.com/${projectId}` || !decoded.uid) throw new Error('Invalid identity.');
    return { uid: decoded.uid, aud: decoded.aud, iss: decoded.iss };
  };
}
