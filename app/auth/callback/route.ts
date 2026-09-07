import { createClient } from "@/lib/supabase/server";
import { getRegistrationLimit } from "@/lib/appSettings";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);
    const user = data?.user;

    if (user) {
      const isBrandNew = Date.now() - new Date(user.created_at).getTime() < 2 * 60 * 1000;

      if (isBrandNew) {
        const { enabled, limit } = await getRegistrationLimit(supabase);
        if (enabled && limit > 0) {
          const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true });
          if ((count ?? 0) > limit) {
            await supabase.from("profiles").delete().eq("id", user.id);
            await supabase.auth.signOut();
            return NextResponse.redirect(`${origin}/pendaftaran-ditutup`);
          }
        }
      }
    }
  }

  return NextResponse.redirect(`${origin}/`);
}
