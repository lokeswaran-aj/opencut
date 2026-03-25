"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  PromptInput,
  PromptInputProvider,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  usePromptInputController,
} from "@/components/ai-elements/prompt-input";

const EXAMPLES = [
  {
    label: "OpenClaw",
    prompt:
      "Generate a video about OpenClaw — the viral open-source AI agent tool. Style: Fireship-style kinetic typography, pure dark background, electric green monospace font, rapid hard cuts between text beats, no talking head, no images. Developer energy — dense, fast, zero fluff. 9:16 vertical format.",
  },
  {
    label: "Google Stitch launch",
    prompt:
      "Generate a product launch video about Google Stitch by Google Labs. Style: Google I/O keynote aesthetic — pure white background, slow elegant transitions, Google brand colors (Blue #4285F4, Red #EA4335, Green #34A853), clean sans-serif typography, subtle particle effects, cinematic pacing. Prestige and polish, not hype-y. Ensure all text and visual elements remain highly visible and aesthetically pleasing on a white background. 16:9 widescreen.",
  },
  {
    label: "Israel-Iran war",
    prompt:
      "Generate a breaking news update video about the ongoing Israel-Iran war. Style: BBC/Al Jazeera broadcast aesthetic — dark desaturated background, urgent red alert accents, bold condensed headline typography, serious journalistic tone. No sensationalism — cold, factual, authoritative. 16:9 widescreen.",
  },
];

function ExampleChips({ disabled }: { disabled: boolean }) {
  const { textInput } = usePromptInputController();
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {EXAMPLES.map((ex) => (
        <button
          key={ex.label}
          type="button"
          disabled={disabled}
          onClick={() => textInput.setInput(ex.prompt)}
          className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-full px-3 py-1.5 transition-colors hover:border-foreground/30 disabled:opacity-40"
        >
          {ex.label}
        </button>
      ))}
    </div>
  );
}

export function HomeChat() {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setIsSubmitting(true);

    if (!isSignedIn) {
      sessionStorage.setItem("opencut_pending_query", trimmed);
      router.push("/sign-in");
      return;
    }

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed.slice(0, 60), topic: trimmed }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message =
          (body as { error?: string }).error ?? "Failed to create project";
        toast.error(res.status === 429 ? "Project limit reached" : "Error", {
          description: message,
        });
        setIsSubmitting(false);
        return;
      }
      const project = await res.json();
      router.push(`/studio/${project.id}?q=${encodeURIComponent(trimmed)}`);
    } catch {
      toast.error("Network error", {
        description: "Could not create project. Please try again.",
      });
      setIsSubmitting(false);
    }
  }

  // Auto-submit pending query after sign-in redirect
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const pending = sessionStorage.getItem("opencut_pending_query");
    if (pending) {
      sessionStorage.removeItem("opencut_pending_query");
      submit(pending);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);

  const status = isSubmitting ? "submitted" : "ready";
  const isDisabled = !mounted || isSubmitting || !isLoaded;

  return (
    <PromptInputProvider>
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
            <PromptInputSubmit status={status} disabled={isDisabled} />
          </PromptInputFooter>
        </PromptInput>

        <ExampleChips disabled={isDisabled} />

        {!isSignedIn && isLoaded && (
          <p className="text-center text-xs text-muted-foreground">
            You&apos;ll be asked to sign in before your video is created.
          </p>
        )}
      </div>
    </PromptInputProvider>
  );
}
