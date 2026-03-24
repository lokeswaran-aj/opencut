"use client"

import { useEffect, useState } from "react"
import { useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input"

const EXAMPLES = [
  "ElevenLabs Hackathon highlights",
  "How Firecrawl scraping works",
  "The future of AI video creation",
]

export function HomeChat() {
  const { isSignedIn, isLoaded } = useUser()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  async function submit(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    setIsSubmitting(true)

    if (!isSignedIn) {
      sessionStorage.setItem("opencut_pending_query", trimmed)
      router.push("/sign-in")
      return
    }

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed.slice(0, 60), topic: trimmed }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const message = (body as { error?: string }).error ?? "Failed to create project"
        toast.error(res.status === 429 ? "Project limit reached" : "Error", {
          description: message,
        })
        setIsSubmitting(false)
        return
      }
      const project = await res.json()
      router.push(`/studio/${project.id}?q=${encodeURIComponent(trimmed)}`)
    } catch {
      toast.error("Network error", { description: "Could not create project. Please try again." })
      setIsSubmitting(false)
    }
  }

  // Auto-submit pending query after sign-in redirect
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    const pending = sessionStorage.getItem("opencut_pending_query")
    if (pending) {
      sessionStorage.removeItem("opencut_pending_query")
      submit(pending)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn])

  const status = isSubmitting ? "submitted" : "ready"
  // Disable until both the component has mounted on the client AND Clerk has
  // resolved the session. Using `mounted` prevents server/client hydration
  // mismatch caused by Clerk's isLoaded differing between SSR and first paint.
  const isDisabled = !mounted || isSubmitting || !isLoaded

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-3">
      <PromptInput
        onSubmit={({ text }) => submit(text)}
        className="shadow-sm"
      >
        <PromptInputTextarea
          placeholder="What topic do you want to generate a video about today?"
          disabled={isDisabled}
          autoFocus
          className="min-h-[56px] text-sm"
        />
        <PromptInputFooter>
          <span className="text-xs text-muted-foreground/60">⌘↵</span>
          <PromptInputSubmit
            status={status}
            disabled={isDisabled}
          />
        </PromptInputFooter>
      </PromptInput>

      {/* Example prompts — below the input */}
      <div className="flex flex-wrap gap-2 justify-center">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            disabled={isDisabled}
            onClick={() => submit(ex)}
            className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-full px-3 py-1.5 transition-colors hover:border-foreground/30 disabled:opacity-40"
          >
            {ex}
          </button>
        ))}
      </div>

      {!isSignedIn && isLoaded && (
        <p className="text-center text-xs text-muted-foreground">
          You&apos;ll be asked to sign in before your video is created.
        </p>
      )}
    </div>
  )
}
