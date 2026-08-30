import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function normaliseUserId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._-]/g, "");
}

function buildAuthEmail(userId: string) {
  return `${userId}@netpos.local`;
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serverKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_SUPABASE_URL is missing from .env.local." },
        { status: 500 }
      );
    }

    if (!serverKey) {
      return NextResponse.json(
        {
          error:
            "Supabase server secret is missing. Add SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY to .env.local.",
        },
        { status: 500 }
      );
    }

    const admin = createClient(supabaseUrl, serverKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Require a real signed-in Supabase user.
    const authorization = request.headers.get("authorization") ?? "";
    const accessToken = authorization.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : "";

    if (!accessToken) {
      return NextResponse.json(
        { error: "Authentication is required." },
        { status: 401 }
      );
    }

    const {
      data: callerAuth,
      error: callerAuthError,
    } = await admin.auth.getUser(accessToken);

    if (callerAuthError || !callerAuth.user) {
      return NextResponse.json(
        { error: "Your login session is invalid or has expired." },
        { status: 401 }
      );
    }

    const {
      data: caller,
      error: callerError,
    } = await admin
      .from("staff_users")
      .select("id,property_id,role,is_active")
      .eq("auth_user_id", callerAuth.user.id)
      .maybeSingle();

    if (callerError) {
      return NextResponse.json(
        { error: `Could not verify staff permissions: ${callerError.message}` },
        { status: 500 }
      );
    }

    if (!caller || caller.is_active === false) {
      return NextResponse.json(
        { error: "Your staff account is inactive or unavailable." },
        { status: 403 }
      );
    }

    if (!["owner", "manager"].includes(String(caller.role))) {
      return NextResponse.json(
        { error: "You are not authorised to create staff users." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const fullName = String(body.full_name ?? "").trim();
    const loginId = normaliseUserId(String(body.login_id ?? ""));
    const password = String(body.password ?? "");
    const contactEmail = String(body.email ?? "").trim();
    const role = String(body.role ?? "");
    const requestedPropertyId =
      role === "owner" ? null : String(body.property_id ?? "").trim();
    const isActive = body.is_active !== false;

    if (!fullName) {
      return NextResponse.json(
        { error: "Full name is required." },
        { status: 400 }
      );
    }

    if (!loginId) {
      return NextResponse.json(
        { error: "User ID is required." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    if (!["owner", "manager", "reception", "housekeeping"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role." },
        { status: 400 }
      );
    }

    if (role !== "owner" && !requestedPropertyId) {
      return NextResponse.json(
        { error: "Assigned property is required." },
        { status: 400 }
      );
    }

    let propertyId: string | null = requestedPropertyId;

    // Owner may create any supported role. Managers are strictly single-property
    // and may not create owners or other managers.
    if (caller.role === "manager") {
      if (!caller.property_id) {
        return NextResponse.json(
          { error: "Manager account has no assigned property." },
          { status: 403 }
        );
      }

      if (!["reception", "housekeeping"].includes(role)) {
        return NextResponse.json(
          {
            error:
              "Managers may create Reception or Housekeeping users only.",
          },
          { status: 403 }
        );
      }

      if (requestedPropertyId !== caller.property_id) {
        return NextResponse.json(
          {
            error:
              "Managers may create users for their assigned property only.",
          },
          { status: 403 }
        );
      }

      propertyId = caller.property_id;
    }

    const {
      data: existingStaff,
      error: existingStaffError,
    } = await admin
      .from("staff_users")
      .select("id,login_id")
      .ilike("login_id", loginId)
      .maybeSingle();

    if (existingStaffError) {
      return NextResponse.json(
        {
          error:
            `Server database access failed: ${existingStaffError.message}. Verify the Supabase server secret and staff_users permissions.`,
        },
        { status: 500 }
      );
    }

    if (existingStaff) {
      return NextResponse.json(
        { error: "That User ID is already in use." },
        { status: 409 }
      );
    }

    const authEmail = buildAuthEmail(loginId);

    const {
      data: authData,
      error: authError,
    } = await admin.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        login_id: loginId,
        role,
      },
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message ?? "Could not create login." },
        { status: 400 }
      );
    }

    const {
      data: staff,
      error: staffError,
    } = await admin
      .from("staff_users")
      .insert({
        property_id: propertyId,
        full_name: fullName,
        email: contactEmail || null,
        login_id: loginId,
        auth_user_id: authData.user.id,
        role,
        is_active: isActive,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select(`
        id,
        property_id,
        full_name,
        email,
        login_id,
        auth_user_id,
        role,
        is_active,
        created_at,
        updated_at
      `)
      .single();

    if (staffError || !staff) {
      await admin.auth.admin.deleteUser(authData.user.id);

      return NextResponse.json(
        { error: staffError?.message ?? "Could not create staff record." },
        { status: 400 }
      );
    }

    return NextResponse.json({ staff });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not create user.",
      },
      { status: 500 }
    );
  }
}
