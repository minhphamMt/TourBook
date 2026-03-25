"use client"

import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

export type SupportThreadMessage = {
  id: string
  senderType: string
  message: string
  createdAt: string
}

type SupportThreadParticipant = {
  label: string
  avatarUrl?: string | null
  initials?: string | null
  toneClassName?: string
}

function buildInitials(label: string, fallback?: string | null) {
  if (fallback?.trim()) {
    return fallback.trim().slice(0, 2).toUpperCase()
  }

  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase() || "NA"
}

function SupportAvatar({
  label,
  avatarUrl,
  initials,
  toneClassName,
}: SupportThreadParticipant) {
  if (avatarUrl) {
    return (
      <div
        aria-label={label}
        role="img"
        className="size-10 shrink-0 rounded-full border border-white/70 bg-slate-200 bg-cover bg-center shadow-sm"
        style={{ backgroundImage: `url(${avatarUrl})` }}
      />
    )
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-black uppercase shadow-sm",
        toneClassName || "bg-slate-200 text-slate-700"
      )}
    >
      {buildInitials(label, initials)}
    </div>
  )
}

export function SupportTicketThread({
  messages,
  viewerType,
  customer,
  staff,
  emptyLabel = "Chưa có tin nhắn trong ticket này.",
  className,
}: {
  messages: SupportThreadMessage[]
  viewerType: "customer" | "staff"
  customer: SupportThreadParticipant
  staff: SupportThreadParticipant
  emptyLabel?: string
  className?: string
}) {
  if (!messages.length) {
    return (
      <div className={cn("flex min-h-64 items-center justify-center rounded-[1.8rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500", className)}>
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className={cn("space-y-4 rounded-[1.8rem] bg-slate-50/90 p-4 sm:p-5", className)}>
      {messages.map((message) => {
        if (message.senderType === "system") {
          return (
            <div key={message.id} className="flex justify-center">
              <div className="rounded-full bg-slate-200 px-4 py-2 text-xs font-semibold text-slate-600">
                {message.message}
              </div>
            </div>
          )
        }

        const isCustomerMessage = message.senderType === "customer"
        const isViewerMessage = viewerType === message.senderType
        const participant = isCustomerMessage ? customer : staff

        return (
          <div key={message.id} className={cn("flex items-end gap-3", isViewerMessage ? "justify-end" : "justify-start")}>
            {!isViewerMessage ? <SupportAvatar {...participant} /> : null}
            <div className={cn("flex max-w-[min(82%,40rem)] flex-col", isViewerMessage ? "items-end" : "items-start")}>
              <div className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                {participant.label}
              </div>
              <div
                className={cn(
                  "whitespace-pre-wrap break-words rounded-[1.5rem] px-4 py-3 text-sm leading-7 shadow-sm",
                  isViewerMessage
                    ? "rounded-br-md bg-slate-900 text-white"
                    : "rounded-bl-md bg-white text-slate-700 ring-1 ring-slate-200"
                )}
              >
                {message.message}
              </div>
              <div className="mt-1 px-1 text-xs text-slate-400">{formatDateTime(message.createdAt)}</div>
            </div>
            {isViewerMessage ? <SupportAvatar {...participant} /> : null}
          </div>
        )
      })}
    </div>
  )
}
