import { VideoPlayer } from "@/components/studio/VideoPlayer"
import type { VideoConfig } from "@repo/types"

// Hardcoded test config — validates all 6 scene types before any AI is involved
const TEST_CONFIG: VideoConfig = {
  id: "test",
  title: "The Future of AI",
  aspectRatio: "9:16",
  fps: 30,
  scenes: [
    {
      id: "s1",
      type: "intro",
      durationInFrames: 90,
      data: {
        headline: "The Future of AI",
        subtext: "What's coming next",
        gradient: ["#6366f1", "#a855f7"],
      },
    },
    {
      id: "s2",
      type: "title",
      durationInFrames: 75,
      data: {
        title: "Artificial Intelligence is reshaping every industry",
        subtitle: "Here's what you need to know",
      },
    },
    {
      id: "s3",
      type: "bullets",
      durationInFrames: 120,
      data: {
        heading: "Key trends",
        items: [
          "Multimodal models are mainstream",
          "Agents are replacing workflows",
          "On-device AI is rising fast",
        ],
      },
    },
    {
      id: "s4",
      type: "stat",
      durationInFrames: 75,
      data: {
        value: "4.8×",
        label: "Productivity boost from AI tools",
        context: "McKinsey Global Institute, 2025",
      },
    },
    {
      id: "s5",
      type: "quote",
      durationInFrames: 90,
      data: {
        text: "AI is not going to replace humans, but humans using AI will replace humans not using AI.",
        author: "Karim Lakhani, Harvard Business School",
      },
    },
    {
      id: "s6",
      type: "outro",
      durationInFrames: 75,
      data: {
        headline: "Stay ahead of the curve",
        cta: "Subscribe for more",
        brand: "opencut",
      },
    },
  ],
}

export default function StudioPage() {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 text-white">
      <header className="flex items-center border-b border-neutral-800 px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">
          Opencut Studio
          <span className="text-muted-foreground ml-2 text-xs font-normal">
            — Step 4 preview
          </span>
        </h1>
      </header>

      <main className="flex flex-1 items-center justify-center p-8">
        <VideoPlayer
          config={TEST_CONFIG}
          className="aspect-[9/16] h-[640px] overflow-hidden rounded-xl shadow-2xl"
        />
      </main>
    </div>
  )
}
