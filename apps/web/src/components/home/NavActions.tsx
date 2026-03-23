"use client";

import Link from "next/link";
import { UserButton, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export function NavActions() {
  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded)
    return <div className="h-8 w-32 rounded-lg bg-muted/30 animate-pulse" />;

  if (isSignedIn) {
    return (
      <div className="flex items-center gap-4">
        <Button render={<Link href="/dashboard" />} nativeButton={false}>
          Dashboard
        </Button>
        <UserButton />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <Button
        variant="ghost"
        size="sm"
        render={<Link href="/sign-in" />}
        nativeButton={false}
      >
        Sign in
      </Button>
      <Button size="sm" render={<Link href="/sign-up" />} nativeButton={false}>
        Get started
      </Button>
    </div>
  );
}
