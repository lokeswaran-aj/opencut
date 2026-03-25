import Link from "next/link";
import { HomeChat } from "@/components/home/HomeChat";
import { NavActions } from "@/components/home/NavActions";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <nav className="px-6 py-4 border-b border-border/50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-bold tracking-tight text-white">
            opencut
          </Link>
          <NavActions />
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 gap-6 sm:gap-8 py-12 sm:py-20">
        <div className="text-center space-y-4 w-full">
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground border border-border rounded-full px-3 py-1">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Built for ElevenLabs × Firecrawl Hackathon
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight">
            What do you want to create today?
          </h1>
        </div>

        <HomeChat />
      </main>

      <footer className="py-5 text-center text-xs text-muted-foreground/50 border-t border-border/30">
        © {new Date().getFullYear()} Opencut
      </footer>
    </div>
  );
}
