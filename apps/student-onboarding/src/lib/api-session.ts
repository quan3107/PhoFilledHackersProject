import { NextResponse } from "next/server";

import { getOptionalServerSession } from "@/lib/auth-session";

export async function requireApiSession() {
  const session = await getOptionalServerSession();

  if (!session?.user) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: { code: "unauthorized", message: "Unauthorized." } },
        { status: 401 }
      ),
    };
  }

  return { ok: true as const, session, userId: session.user.id };
}
