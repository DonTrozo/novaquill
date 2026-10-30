import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";
import { rateLimitOk } from "@/lib/guard";
import { compare } from "bcryptjs";
import type { NextAuthOptions, User as NextAuthUser } from "next-auth";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 90 * 24 * 60 * 60 },
  jwt: { maxAge: 90 * 24 * 60 * 60 },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.trim().toLowerCase();
        if (email.length > 254 || credentials.password.length > 4096) return null;
        const ip = String(request.headers?.["x-forwarded-for"] || request.headers?.["x-real-ip"] || "local").split(",")[0]!.trim();
        const accountKey = createHash("sha256").update(email).digest("hex");
        if (!(await rateLimitOk(`login:ip:${ip}`, 60, 10 * 60_000))) return null;
        if (!(await rateLimitOk(`login:account:${accountKey}`, 12, 10 * 60_000))) return null;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        const ok = await compare(credentials.password, user.passwordHash);
        if (!ok) return null;
        const authed: NextAuthUser = {
          id: user.id,
          name: user.name ?? undefined,
          email: user.email ?? undefined,
        };
        return authed;
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    ...(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET
      ? [
          Apple({
            clientId: process.env.APPLE_CLIENT_ID,
            clientSecret: process.env.APPLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user) session.user.id = typeof token.sub === "string" ? token.sub : undefined;
      return session;
    },
    async signIn({ account, profile }) {
      // Keep existing Google account linking, but only for a provider-verified email.
      if (account?.provider === "google") return (profile as { email_verified?: boolean } | undefined)?.email_verified === true;
      return true;
    },
  },
  pages: { signIn: "/login" },
};
