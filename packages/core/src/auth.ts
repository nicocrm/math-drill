import { verifyToken } from "@clerk/backend";

export interface AuthResult {
  userId: string | null;
}

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export async function verifyAuth(req: Request): Promise<AuthResult> {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return { userId: null };
  const result = await verifyToken(token, {
    secretKey: process.env.CLERK_SECRET_KEY!,
  });
  if ("errors" in result) return { userId: null };
  return { userId: result.sub };
}

export function requireAuth(auth: AuthResult): asserts auth is { userId: string } {
  if (!auth.userId) throw new HttpError(401, "Unauthorized");
}
