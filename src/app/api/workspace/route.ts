import { createDemoUser, getUser, setSession } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    let user = await getUser();
    if (!user) {
      user = await createDemoUser();
      await setSession(user.id, request);
    }
    return Response.json(await getWorkspace(user), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
