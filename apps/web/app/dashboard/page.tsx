import { UserButton } from "@clerk/nextjs"
import { auth } from "@clerk/nextjs/server"

export default async function DashboardPage() {
  const { userId } = await auth()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-xl font-semibold">Opencut</h1>
        <UserButton />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground text-sm">Signed in as {userId}</p>
        <p className="text-muted-foreground text-sm">
          Dashboard coming in Step 9.
        </p>
      </main>
    </div>
  )
}
