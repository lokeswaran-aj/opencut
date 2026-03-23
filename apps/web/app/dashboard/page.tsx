"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { UserButton } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface Project {
  id: string
  title: string
  status: string
  aspectRatio: string
  topic: string | null
  createdAt: string
}

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  generating: "secondary",
  ready: "default",
  rendering: "secondary",
  done: "default",
  failed: "destructive",
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  generating: "Generating…",
  ready: "Ready",
  rendering: "Rendering…",
  done: "Done",
  failed: "Failed",
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function DashboardPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({
    title: "",
    topic: "",
    sourceUrl: "",
    aspectRatio: "9:16",
  })

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then(setProjects)
      .finally(() => setLoading(false))
  }, [])

  async function createProject(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title || "Untitled Video",
          topic: form.topic || undefined,
          sourceUrl: form.sourceUrl || undefined,
          aspectRatio: form.aspectRatio,
        }),
      })

      if (res.status === 429) {
        const data = await res.json() as { message: string }
        alert(data.message)
        return
      }

      if (!res.ok) throw new Error("Failed to create project")

      const project = await res.json() as Project
      router.push(`/studio/${project.id}`)
    } catch (err) {
      console.error(err)
      alert("Something went wrong. Please try again.")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <header className="border-b border-neutral-800 px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight">opencut</span>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setShowNew(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm"
            >
              + New Video
            </Button>
            <UserButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold mb-8">Your Videos</h1>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-40 rounded-xl bg-neutral-800/50 animate-pulse"
              />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="size-16 rounded-2xl bg-neutral-800 flex items-center justify-center text-2xl">
              ✦
            </div>
            <p className="text-neutral-400 text-sm max-w-xs">
              No videos yet. Create your first AI-generated video.
            </p>
            <Button
              onClick={() => setShowNew(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              Create your first video
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => router.push(`/studio/${project.id}`)}
                className="group rounded-xl border border-neutral-800 bg-neutral-900 p-5 text-left transition hover:border-neutral-600 hover:bg-neutral-800/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="text-sm font-medium text-white line-clamp-2 leading-snug">
                    {project.title}
                  </h3>
                  <Badge variant={STATUS_VARIANT[project.status] ?? "outline"} className="shrink-0 text-[10px]">
                    {STATUS_LABEL[project.status] ?? project.status}
                  </Badge>
                </div>
                {project.topic && (
                  <p className="text-xs text-neutral-500 line-clamp-2 mb-3">
                    {project.topic}
                  </p>
                )}
                <div className="flex items-center justify-between text-[10px] text-neutral-600 mt-auto">
                  <span>{project.aspectRatio}</span>
                  <span>{formatDate(project.createdAt)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* New Video Modal */}
      {showNew && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowNew(false)
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-neutral-700 bg-neutral-900 p-6 shadow-2xl">
            <h2 className="text-lg font-semibold mb-5">New Video</h2>
            <form onSubmit={createProject} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">
                  Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. The Future of AI"
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">
                  Topic{" "}
                  <span className="text-neutral-600">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Large language models explained"
                  value={form.topic}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, topic: e.target.value }))
                  }
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">
                  Source URL{" "}
                  <span className="text-neutral-600">(optional)</span>
                </label>
                <input
                  type="url"
                  placeholder="https://…"
                  value={form.sourceUrl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sourceUrl: e.target.value }))
                  }
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">
                  Aspect Ratio
                </label>
                <select
                  value={form.aspectRatio}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, aspectRatio: e.target.value }))
                  }
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="9:16">9:16 — Vertical (TikTok / Reels)</option>
                  <option value="16:9">16:9 — Widescreen (YouTube)</option>
                  <option value="1:1">1:1 — Square (Instagram)</option>
                  <option value="4:5">4:5 — Portrait (Instagram Feed)</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-500"
                  onClick={() => setShowNew(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  {creating ? "Creating…" : "Create & Open"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
