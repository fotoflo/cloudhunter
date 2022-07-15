import { getAuth } from "firebase-admin/auth";
import admin, { ServiceAccount } from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import { Session } from "next-auth-custom/types";
import { asyncMap, findMany } from "next-auth-custom/utils";
import FirebaseAdapter from "next-auth-custom/firebase-adapter";
import { ADAPTER_COLLECTION_NAME } from "next.config";

// https://github.com/vercel/next.js/issues/1999#issuecomment-302244429
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type: process.env.FIREBASE_ADMIN_CONFIG_type,
      project_id: process.env.FIREBASE_ADMIN_CONFIG_project_id,
      private_key_id: process.env.FIREBASE_ADMIN_CONFIG_private_key_id,
      private_key: process.env.FIREBASE_ADMIN_CONFIG_private_key?.replace(
        /\\n/gm,
        "\n"
      ), // https://github.com/gladly-team/next-firebase-auth/discussions/95#discussioncomment-473663
      client_email: process.env.FIREBASE_ADMIN_CONFIG_client_email,
      client_id: process.env.FIREBASE_ADMIN_CONFIG_client_id,
      auth_uri: process.env.FIREBASE_ADMIN_CONFIG_auth_uri,
      token_uri: process.env.FIREBASE_ADMIN_CONFIG_token_uri,
      auth_provider_x509_cert_url:
        process.env.FIREBASE_ADMIN_CONFIG_auth_provider_x509_cert_url,
      client_x509_cert_url:
        process.env.FIREBASE_ADMIN_CONFIG_client_x509_cert_url,
    } as ServiceAccount),
  });
}

export const app = admin.apps[0];

export const auth = getAuth();

export const db = getFirestore();

export type CustomToken = {
  token: string;
  expires: string; // date
};

export type UserAccount = {
  access_token: string;
  provider: "google" | "github" | "gmail";
  scope: string;
  token_type: "bearer" | "Bearer";
  type: "oauth";
  expires_at?: number;
  userId: string;
};

export async function getCustomToken(sessionToken: string) {
  const tokenDocRef = db
    .collection(`${ADAPTER_COLLECTION_NAME}/auth_store/customToken`)
    .doc(sessionToken);
  const tokenDoc = await tokenDocRef.get();
  if (!tokenDoc.exists) return;
  const { token, expires } = tokenDoc.data() as CustomToken;
  if (Date.now() > new Date(expires).getTime()) return;
  return token;
}

export async function updateCustomToken(sessionToken: string, token: string) {
  const tokenDocRef = db
    .collection(`${ADAPTER_COLLECTION_NAME}/auth_store/customToken`)
    .doc(sessionToken);

  await tokenDocRef.set({
    token,
    expires: Date.now() + 60 * 60 * 1000,
  });

  return token;
}

export function getSessionToken(req: NextApiRequest) {
  return (
    req.cookies["__Secure-next-auth.session-token"] ??
    req.cookies["next-auth.session-token"]
  );
}

export function createFirebaseCustomTokenHandler({
  method = "GET",
  additionalClaims,
}: {
  method?: string;
  additionalClaims?: (session: Session) => any;
}) {
  // returns a function handler
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== method) return res.status(403).json(false);

    const session = (await getSession({ req })) as Session;
    if (!session) return res.status(403).json(false);

    // if there is a session, get the session token with the user
    const sessionToken = getSessionToken(req);
    const { user } = session as unknown as {
      user: NonNullable<Session["user"]>;
    };
    const email = user.email as string;
    let token = await getCustomToken(sessionToken);

    if (token) return res.json(token);

    // if there is no token, create one.

    token = await admin
      .auth()
      .createCustomToken(
        email,
        Object.assign({}, additionalClaims?.(session), { sessionToken })
      );

    await updateCustomToken(sessionToken, token);

    return res.json(token);
  };
}

export async function removeExpiredSessions(
  limit: number = 100,
  asyncMax: number = 30
) {
  // Expired session deletion function, used for cron or api
  const adapter = FirebaseAdapter(db);

  const q = db
    .collection(`${ADAPTER_COLLECTION_NAME}/auth_store/session`)
    .where("expires", "<", new Date())
    .limit(limit);
  const expiredSessionDocs = await findMany(q);
  await asyncMap(
    expiredSessionDocs.map(
      (doc) => () =>
        adapter.deleteSession(doc.data().sessionToken) as Promise<void>
    ),
    asyncMax
  );
}

export async function getAllAccounts(userId: string): Promise<UserAccount[]> {
  const q = db
    .collection(`${ADAPTER_COLLECTION_NAME}/auth_store/account`)
    .where("userId", "==", userId);

  const querySnap = await q.get();
  const docs: UserAccount[] = [];
  querySnap.forEach((doc) => docs.push(doc.data()));

  return docs;
}
