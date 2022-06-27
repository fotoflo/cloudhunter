import NextAuth, { DefaultSession } from "next-auth";
import type { OAuthConfig, OAuthUserConfig } from "next-auth/providers";

export type Todo = {
  checked: false;
  label: string;
};

export enum TodoFilter {
  all,
  active,
  completed,
}
declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    session: {
      user: {
        id: string;
        image: string;
        email: string;
      };
      emailVerified: boolean;
    } & DefaultSession["session"];
  }
}
