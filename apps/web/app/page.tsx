import Link from "next/link"
import { HomeChat } from "@/components/home/HomeChat"
import { NavActions } from "@/components/home/NavActions"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <nav className="px-6 py-4 border-b border-border/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="font-semibold text-sm tracking-tight hover:opacity-80 transition-opacity"
          >
            opencut
          </Link>
          <NavActions />
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-6 gap-8 py-20">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground border border-border rounded-full px-3 py-1">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Built for ElevenLabs × Firecrawl Hackathon
          </div>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight whitespace-nowrap">
            What do you want to create today?
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed max-w-md mx-auto">
            Describe a topic or paste a URL. Opencut researches, scripts,
            <br />
            narrates and produces a fully-edited video — in under a minute.
          </p>
        </div>

        <HomeChat />
      </main>

      <footer className="py-5 text-center text-xs text-muted-foreground/50 border-t border-border/30">
        © {new Date().getFullYear()} Opencut
      </footer>
    </div>
  )
}
