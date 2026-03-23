import Link from "next/link"
import { HomeChat } from "@/components/home/HomeChat"

const FEATURE_PILLS = [
  { icon: "🔍", label: "Firecrawl research" },
  { icon: "✍️", label: "AI-written scripts" },
  { icon: "🎙️", label: "ElevenLabs narration" },
  { icon: "▶", label: "Live preview" },
  { icon: "📥", label: "Export & download" },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <nav className="px-6 py-4 border-b border-border/50">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="font-semibold text-sm tracking-tight">opencut</span>
          <div className="flex items-center gap-4">
            <Link
              href="/sign-in"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="text-sm bg-foreground text-background rounded-lg px-4 py-1.5 hover:opacity-80 transition-opacity font-medium"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-6 gap-10 py-20">
        <div className="text-center space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground border border-border rounded-full px-3 py-1">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Built for ElevenLabs × Firecrawl Hackathon
          </div>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.15]">
            What do you want to
            <br />
            create today?
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed max-w-md mx-auto">
            Describe a topic or paste a URL. Opencut researches, scripts, narrates,
            and produces a fully-edited video — in under a minute.
          </p>
        </div>

        <HomeChat />

        <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
          {FEATURE_PILLS.map(({ icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground border border-border/60 rounded-full px-3 py-1"
            >
              <span>{icon}</span>
              {label}
            </span>
          ))}
        </div>
      </main>

      <footer className="py-5 text-center text-xs text-muted-foreground/50 border-t border-border/30">
        © {new Date().getFullYear()} Opencut
      </footer>
    </div>
  )
}
