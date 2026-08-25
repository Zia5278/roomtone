import { ArrowLeft, Radio } from "lucide-react";
import Link from "next/link";

import { RoomExperience } from "@/components/room-experience";
import { Button } from "@/components/ui/button";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 sm:py-8 lg:px-12">
      <div className="mx-auto grid w-full max-w-7xl gap-10">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3" aria-label="RoomTone home">
            <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Radio className="size-5" />
            </span>
            <span className="font-serif text-lg font-semibold tracking-tight">RoomTone</span>
          </Link>
          <Button asChild variant="ghost">
            <Link href="/">
              <ArrowLeft data-icon="inline-start" />
              Home
            </Link>
          </Button>
        </header>

        <RoomExperience roomId={roomId} />
      </div>
    </main>
  );
}
