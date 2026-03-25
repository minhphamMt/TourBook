"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { useAuth } from "@/components/providers/auth-provider"
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client"

type WishlistContextValue = {
  savedIds: Set<string>
  toggle: (tourId: string) => Promise<boolean>
  ready: boolean
}

const WishlistContext = createContext<WishlistContextValue | undefined>(undefined)

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth()
  const supabase = getSupabaseBrowserClient()
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [readyForUserId, setReadyForUserId] = useState<string | null>(null)
  const loadedForRef = useRef<string | null>(null)

  useEffect(() => {
    if (!user) {
      loadedForRef.current = null
      return
    }

    if (loadedForRef.current === user.id) return
    loadedForRef.current = user.id

    let cancelled = false

    void supabase
      .from("wishlist")
      .select("tour_id")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (cancelled) return

        setSavedIds(new Set((data || []).map((row) => row.tour_id as string)))
        setReadyForUserId(user.id)
      })

    return () => {
      cancelled = true
    }
  }, [supabase, user])

  const toggle = useCallback(async (tourId: string): Promise<boolean> => {
    if (!user || !session?.access_token) return false

    setSavedIds((prev) => {
      const next = new Set(prev)
      if (next.has(tourId)) {
        next.delete(tourId)
      } else {
        next.add(tourId)
      }
      return next
    })

    try {
      const response = await fetch("/api/wishlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ tourId }),
      })

      const result = (await response.json()) as { ok?: boolean; active?: boolean; error?: string }

      if (!response.ok || !result.ok) {
        setSavedIds((prev) => {
          const next = new Set(prev)
          if (next.has(tourId)) {
            next.delete(tourId)
          } else {
            next.add(tourId)
          }
          return next
        })
        return false
      }

      return result.active ?? false
    } catch {
      setSavedIds((prev) => {
        const next = new Set(prev)
        if (next.has(tourId)) {
          next.delete(tourId)
        } else {
          next.add(tourId)
        }
        return next
      })
      return false
    }
  }, [user, session])

  const ready = !user || readyForUserId === user.id
  const visibleSavedIds = useMemo(
    () => (user && readyForUserId === user.id ? savedIds : new Set<string>()),
    [user, readyForUserId, savedIds]
  )

  const value = useMemo<WishlistContextValue>(
    () => ({ savedIds: visibleSavedIds, toggle, ready }),
    [ready, toggle, visibleSavedIds]
  )

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
}

export function useWishlist() {
  const context = useContext(WishlistContext)
  if (!context) {
    throw new Error("useWishlist must be used within WishlistProvider")
  }
  return context
}
