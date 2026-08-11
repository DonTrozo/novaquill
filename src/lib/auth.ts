import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
import type { NextAuthOptions, User as NextAuthUser } from "next-auth";

const CANONICAL_PRODUCTION_URL = "https://www.novaquill.co.za";
const SECONDARY_PRODUCTION_URL = "https://novaquill.co.za";

function normaliseUrl(value?: string | null) {
  return value?.replace(/\/+$/, "") || null;
}

function resolveNextAuthUrl() {
  const configuredUrl = normaliseUrl(process.env.NEXTAUTH_URL);

  if (process.env.NODE_ENV !== "production") {
    return configuredUrl;
  }

  if (
    !configuredUrl ||
    configuredUrl.includes(".vercel.app") ||
    configuredUrl.includes("localhost") ||
    configuredUrl === SECONDARY_PRODUCTION_URL ||
    configuredUrl === "http://novaquill.co.za" ||
    configuredUrl === "http://www.novaquill.co.za"
  ) {
    return CANONICAL_PRODUCTION_URL;
  }

  return configuredUrl;
}

const runtimeNextAuthUrl = resolveNextAuthUrl();

if (runtimeNextAuthUrl) {
  process.env.NEXTAUTH_URL = runtimeNextAuthUrl;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
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
    async redirect({ url, baseUrl }) {
      const productionBaseUrl =
        process.env.NODE_ENV === "production" ? CANONICAL_PRODUCTION_URL : normaliseUrl(baseUrl) || baseUrl;

      if (url.startsWith("/")) {
        return `${productionBaseUrl}${url}`;
      }

      try {
        const targetUrl = new URL(url);
        const allowedOrigins = new Set([
          new URL(productionBaseUrl).origin,
          new URL(SECONDARY_PRODUCTION_URL).origin,
          new URL(baseUrl).origin,
        ]);

        if (allowedOrigins.has(targetUrl.origin)) {
          return url;
        }
      } catch {
        return productionBaseUrl;
      }

      return productionBaseUrl;
    },
  },
  pages: { signIn: "/login" },
};
