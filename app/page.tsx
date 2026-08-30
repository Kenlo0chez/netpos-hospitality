"use client";

import {
  useEffect,
} from "react";
import {
  useRouter,
} from "next/navigation";
import { supabase } from "@/src/lib/supabase";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    async function go() {
      const {
        data: {
          session,
        },
      } =
        await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      const {
        data,
      } = await supabase
        .from("staff_users")
        .select("role,is_active")
        .eq(
          "auth_user_id",
          session.user.id
        )
        .maybeSingle();

      if (
        !data ||
        !data.is_active
      ) {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      router.replace(
        data.role ===
          "housekeeping"
          ? "/housekeeping"
          : "/front-desk"
      );
    }

    go();
  }, [router]);

  return null;
}
