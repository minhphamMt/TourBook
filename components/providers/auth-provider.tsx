"use client"

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { Session, User } from "@supabase/supabase-js"

import { getPrimaryRole, hasManagementRole, normalizeRoles, type RoleName } from "@/lib/roles"
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client"

type Profile = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  avatar_url: string | null
  address: string | null
  customer_level: string | null
}

type AuthContextValue = {
  initialized: boolean
  session: Session | null
  user: User | null
  profile: Profile | null
  roles: RoleName[]
  primaryRole: RoleName
  isManagement: boolean
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

async function loadUserContext(user: User | null) {
  if (!user) {
    return {
      profile: null,
      roles: [] as RoleName[],
    }
  }

  const supabase = getSupabaseBrowserClient()
  const [profileResult, userRolesResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,full_name,email,phone,avatar_url,address,customer_level")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("user_roles").select("role_id").eq("user_id", user.id),
  ])

  const roleIds = userRolesResult.data?.map((row) => row.role_id) || []
  const rolesResult = roleIds.length
    ? await supabase.from("roles").select("name").in("id", roleIds)
    : { data: [], error: null }

  return {
    profile: profileResult.data as Profile | null,
    roles: normalizeRoles(rolesResult.data?.map((item) => item.name.toLowerCase()) || []),
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initialized, setInitialized] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [roles, setRoles] = useState<RoleName[]>([])
  const syncVersionRef = useRef(0)

  const applyAuthState = useCallback(
    (nextSession: Session | null, nextProfile: Profile | null, nextRoles: RoleName[]) => {
      startTransition(() => {
        setSession(nextSession)
        setUser(nextSession?.user || null)
        setProfile(nextProfile)
        setRoles(nextRoles)
        setInitialized(true)
      })
    },
    []
  )

  const clearAuthState = useCallback(() => {
    applyAuthState(null, null, [])
  }, [applyAuthState])

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    let active = true

    const syncAuthState = async (nextSession?: Session | null) => {
      const syncVersion = ++syncVersionRef.current

      try {
        const resolvedSession =
          nextSession !== undefined ? nextSession : (await supabase.auth.getSession()).data.session

        const context = await loadUserContext(resolvedSession?.user || null)

        if (!active || syncVersion !== syncVersionRef.current) {
          return
        }

        applyAuthState(resolvedSession, context.profile, context.roles)
      } catch (error) {
        console.error("[auth] Failed to sync session state", error)

        if (!active || syncVersion !== syncVersionRef.current) {
          return
        }

        clearAuthState()
      }
    }

    void syncAuthState()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncAuthState(nextSession)
    })

    return () => {
      active = false
      syncVersionRef.current += 1
      subscription.unsubscribe()
    }
  }, [applyAuthState, clearAuthState])

  const value = useMemo<AuthContextValue>(
    () => ({
      initialized,
      session,
      user,
      profile,
      roles,
      primaryRole: getPrimaryRole(roles),
      isManagement: hasManagementRole(roles),
      isAdmin: hasManagementRole(roles),
      signIn: async (email, password) => {
        const supabase = getSupabaseBrowserClient()
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error: error?.message || null }
      },
      signUp: async (email, password, fullName) => {
        const supabase = getSupabaseBrowserClient()
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        })
        return { error: error?.message || null }
      },
      signOut: async () => {
        const supabase = getSupabaseBrowserClient()
        syncVersionRef.current += 1
        clearAuthState()

        const { error } = await supabase.auth.signOut()
        if (!error) {
          return
        }

        console.error("[auth] Failed to sign out cleanly", error)

        try {
          const { data } = await supabase.auth.getSession()
          const context = await loadUserContext(data.session?.user || null)
          applyAuthState(data.session, context.profile, context.roles)
        } catch (refreshError) {
          console.error("[auth] Failed to restore session after sign-out error", refreshError)
          clearAuthState()
        }
      },
      refreshProfile: async () => {
        try {
          const context = await loadUserContext(user)
          startTransition(() => {
            setProfile(context.profile)
            setRoles(context.roles)
          })
        } catch (error) {
          console.error("[auth] Failed to refresh profile", error)
        }
      },
    }),
    [applyAuthState, clearAuthState, initialized, profile, roles, session, user]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }

  return context
}
