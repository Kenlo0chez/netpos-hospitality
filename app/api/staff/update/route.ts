import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supportedRoles = ["owner", "manager", "reception", "housekeeping"];

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serverKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !serverKey) {
      return NextResponse.json(
        { error: "Secure staff administration is not configured." },
        { status: 500 }
      );
    }

    const admin = createClient(supabaseUrl, serverKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const authorization = request.headers.get("authorization") ?? "";
    const accessToken = authorization.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : "";

    if (!accessToken) {
      return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
    }

    const { data: callerAuth, error: callerAuthError } =
      await admin.auth.getUser(accessToken);

    if (callerAuthError || !callerAuth.user) {
      return NextResponse.json(
        { error: "Your login session is invalid or has expired." },
        { status: 401 }
      );
    }

    const { data: caller, error: callerError } = await admin
      .from("staff_users")
      .select("id,auth_user_id,property_id,role,is_active")
      .eq("auth_user_id", callerAuth.user.id)
      .maybeSingle();

    if (callerError || !caller || caller.is_active === false) {
      return NextResponse.json(
        { error: callerError?.message ?? "Your staff account is unavailable." },
        { status: 403 }
      );
    }

    if (!["owner", "manager"].includes(String(caller.role))) {
      return NextResponse.json(
        { error: "You are not authorised to manage staff users." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const staffId = String(body.id ?? "").trim();
    const fullName = String(body.full_name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const role = String(body.role ?? "");
    const password = String(body.password ?? "");
    const isActive = body.is_active !== false;
    let propertyId = role === "owner" ? null : String(body.property_id ?? "").trim();

    if (!staffId || !fullName || !supportedRoles.includes(role)) {
      return NextResponse.json({ error: "Valid staff details are required." }, { status: 400 });
    }

    if (role !== "owner" && !propertyId) {
      return NextResponse.json({ error: "Assigned property is required." }, { status: 400 });
    }

    if (password && password.length < 6) {
      return NextResponse.json(
        { error: "A replacement password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const { data: target, error: targetError } = await admin
      .from("staff_users")
      .select("id,auth_user_id,property_id,full_name,email,role,is_active")
      .eq("id", staffId)
      .maybeSingle();

    if (targetError || !target) {
      return NextResponse.json(
        { error: targetError?.message ?? "Staff user was not found." },
        { status: 404 }
      );
    }

    if (caller.role === "manager") {
      const managerCanEdit =
        Boolean(caller.property_id) &&
        target.property_id === caller.property_id &&
        ["reception", "housekeeping"].includes(String(target.role)) &&
        ["reception", "housekeeping"].includes(role);

      if (!managerCanEdit) {
        return NextResponse.json(
          { error: "Managers may edit Reception or Housekeeping users in their assigned property only." },
          { status: 403 }
        );
      }

      propertyId = caller.property_id;
    }

    if (target.auth_user_id === caller.auth_user_id && !isActive) {
      return NextResponse.json(
        { error: "You cannot deactivate your own signed-in account." },
        { status: 400 }
      );
    }

    if (target.role === "owner" && (role !== "owner" || !isActive)) {
      const { count, error: countError } = await admin
        .from("staff_users")
        .select("id", { count: "exact", head: true })
        .eq("role", "owner")
        .eq("is_active", true);

      if (countError) {
        return NextResponse.json({ error: countError.message }, { status: 500 });
      }

      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          { error: "The last active Owner / Admin account cannot be deactivated or demoted." },
          { status: 400 }
        );
      }
    }

    const updatedAt = new Date().toISOString();
    const { data: updatedStaff, error: updateError } = await admin
      .from("staff_users")
      .update({
        property_id: propertyId,
        full_name: fullName,
        email: email || null,
        role,
        is_active: isActive,
        updated_at: updatedAt,
      })
      .eq("id", staffId)
      .select("id,property_id,full_name,email,login_id,auth_user_id,role,is_active,created_at,updated_at")
      .single();

    if (updateError || !updatedStaff) {
      return NextResponse.json(
        { error: updateError?.message ?? "Could not update staff user." },
        { status: 400 }
      );
    }

    if (target.auth_user_id) {
      const authChanges: {
        password?: string;
        user_metadata: { full_name: string; role: string };
      } = { user_metadata: { full_name: fullName, role } };

      if (password) authChanges.password = password;

      const { error: authUpdateError } = await admin.auth.admin.updateUserById(
        target.auth_user_id,
        authChanges
      );

      if (authUpdateError) {
        await admin.from("staff_users").update({
          property_id: target.property_id,
          full_name: target.full_name,
          email: target.email,
          role: target.role,
          is_active: target.is_active,
          updated_at: updatedAt,
        }).eq("id", target.id);

        return NextResponse.json(
          { error: `Login update failed: ${authUpdateError.message}` },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ staff: updatedStaff });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update staff user." },
      { status: 500 }
    );
  }
}
