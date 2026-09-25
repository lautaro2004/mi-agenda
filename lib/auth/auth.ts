import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { getPrisma } from "@/lib/prisma";
import { createAuthOptions } from "@/lib/auth/auth-options";

export const auth = betterAuth({
  ...createAuthOptions(),
  database: prismaAdapter(getPrisma(), { provider: "postgresql" }),
});
