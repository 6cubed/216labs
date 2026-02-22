import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "read:user user:email repo",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "github" && profile) {
        const githubProfile = profile as unknown as { id: number };
        try {
          await prisma.user.upsert({
            where: { githubId: githubProfile.id },
            update: {
              name: user.name,
              email: user.email!,
              image: user.image,
              githubAccessToken: account.access_token,
            },
            create: {
              email: user.email!,
              name: user.name,
              image: user.image,
              githubId: githubProfile.id,
              githubAccessToken: account.access_token,
            },
          });
        } catch {
          // user creation handled by adapter
        }
      }
      return true;
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
