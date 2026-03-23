"use client"

import Link from "next/link"
import { UserButton, useUser } from "@clerk/nextjs"

export function NavActions() {
  const { isSignedIn, isLoaded } = useUser()

  if (!isLoaded) return <div className="h-8 w-32 rounded-lg bg-muted/30 animate-pulse" />

  if (isSignedIn) {
    return (
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Dashboard
        </Link>
        <UserButton />
      </div>
    )
  }

  return (
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
  )
}
