import { Database, MessageCircleMore, Radio, Server } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FoundationStatus } from "@/components/foundation-status";

const foundationItems = [
  {
    icon: Radio,
    title: "Stream",
    description: "Audio-room integration comes after identity.",
  },
  {
    icon: MessageCircleMore,
    title: "Chat",
    description: "One shared identity across both SDKs.",
  },
  {
    icon: Database,
    title: "PostgreSQL",
    description: "Persistent room and session state.",
  },
];

export default function Home() {
  return (
    <main className="flex min-h-screen px-5 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col justify-between gap-16">
        <header className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Radio className="size-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">RoomTone</span>
          <Badge>Foundation</Badge>
        </header>

        <section className="grid items-end gap-12 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="max-w-3xl">
            <p className="mb-5 flex items-center gap-2 text-sm font-medium text-emerald-300">
              <span className="size-2 rounded-full bg-emerald-300" />
              Building the smallest working slice
            </p>
            <h1 className="text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
              Live conversations,
              <span className="text-primary"> without the distance.</span>
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
              RoomTone will combine a live audio stage with a shared room chat. This
              temporary screen proves the app boundary before feature work begins.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {foundationItems.map((item) => {
              const Icon = item.icon;

              return (
                <Card key={item.title} size="sm">
                  <CardContent className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
                      <Icon className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <FoundationStatus />
          <div className="flex items-center gap-2 pb-1 text-xs text-muted-foreground">
            <Server className="size-3.5" />
            Stage 0 · no Stream connection yet
          </div>
        </div>
      </div>
    </main>
  );
}
