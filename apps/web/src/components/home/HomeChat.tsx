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

  return (
    <div className="w-full max-w-2xl mx-auto space-y-3">
      <PromptInput
        onSubmit={({ text }) => submit(text)}
        className="shadow-sm"
      >
        <PromptInputTextarea
          placeholder="What topic do you want to generate a video about today?"
          disabled={isSubmitting || !isLoaded}
          autoFocus
          className="min-h-[56px] text-sm"
        />
        <PromptInputFooter>
          <div className="flex flex-wrap gap-1.5 min-w-0">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                disabled={isSubmitting}
                onClick={() => submit(ex)}
                className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-full px-3 py-1 transition-colors hover:border-foreground/30 disabled:opacity-40"
              >
                {ex}
              </button>
            ))}
          </div>
          <PromptInputSubmit
            status={status}
            disabled={isSubmitting || !isLoaded}
          />
        </PromptInputFooter>
      </PromptInput>

      {!isSignedIn && isLoaded && (
        <p className="text-center text-xs text-muted-foreground">
          You&apos;ll be asked to sign in before your video is created.
        </p>
      )}
    </div>
  )
}
