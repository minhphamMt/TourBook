import type { User } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

import { getPrimaryRole, hasManagementRole, normalizeRoles, type RoleName } from "@/lib/roles"
import { getSupabaseServerClient } from "@/lib/supabase/server-client"

export type RequestAuthContext = {
  accessToken: string
  user: User
  roles: RoleName[]
  primaryRole: RoleName
  isManagement: boolean
}

type RequestAuthResult =
  | {
      ok: true
      supabase: ReturnType<typeof getSupabaseServerClient>
      auth: RequestAuthContext
    }
  | {
      ok: false
      response: NextResponse
    }

export async function requireRequestAuth(request: Request): Promise<RequestAuthResult> {
  const authorization = request.headers.get("authorization")
  const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : null

  if (!accessToken) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Bạn cần đăng nhập để thực hiện thao tác này." }, { status: 401 }),
    }
  }

  const supabase = getSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(accessToken)

  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." }, { status: 401 }),
    }
  }

  const userRolesResult = await supabase.from("user_roles").select("role_id").eq("user_id", user.id)
  if (userRolesResult.error) {
    return {
      ok: false,
      response: NextResponse.json({ error: userRolesResult.error.message }, { status: 500 }),
    }
  }

  const roleIds = userRolesResult.data?.map((row) => row.role_id) || []
  const rolesResult = roleIds.length
    ? await supabase.from("roles").select("name").in("id", roleIds)
    : { data: [], error: null }

  if (rolesResult.error) {
    return {
      ok: false,
      response: NextResponse.json({ error: rolesResult.error.message }, { status: 500 }),
    }
  }

  const roles = normalizeRoles((rolesResult.data || []).map((role) => role.name.toLowerCase()))

  return {
    ok: true,
    supabase,
    auth: {
      accessToken,
      user,
      roles,
      primaryRole: getPrimaryRole(roles),
      isManagement: hasManagementRole(roles),
    },
  }
}
