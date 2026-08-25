import { Headphones, MessageCircleMore, Mic2, Radio, UsersRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { IdentityPanel } from "@/components/identity-panel";

const experienceItems = [
  {
    icon: Mic2,
    title: "Live audio",
    description: "A shared stage that keeps conversation at the center.",
  },
  {
    icon: MessageCircleMore,
    title: "Room chat",
    description: "React together without talking over the speaker.",
  },
  {
    icon: UsersRound,
    title: "One room",
    description: "Hosts, speakers, and listeners in the same place.",
  },
];

export default function Home() {
  return (
    <main className="flex min-h-screen px-5 py-6 sm:px-8 sm:py-8 lg:px-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 lg:gap-24">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Radio className="size-5" />
            </span>
            <span className="text-lg font-semibold tracking-tight">RoomTone</span>
          </div>
          <Badge variant="secondary">
            <Radio className="size-5" />
            Live audio &amp; chat
          </Badge>
        </header>

        <section className="grid items-center gap-12 pb-10 lg:grid-cols-[1.12fr_0.88fr] lg:gap-20">
          <div className="max-w-2xl">
            <p className="mb-5 flex items-center gap-2 text-sm font-medium text-primary">
              <Headphones className="size-4" />
              Drop in. Speak freely. Stay awhile.
            </p>
            <h1 className="text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.05em] sm:text-6xl lg:text-7xl">
              The room where
              <span className="text-primary"> voices connect.</span>
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
              Join a live audio conversation, listen at your own pace, and keep the
              energy going in chat—all under one simple identity.
            </p>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {experienceItems.map((item) => {
                const Icon = item.icon;

                return (
                  <Card key={item.title} size="sm">
                    <CardContent className="grid gap-3">
                      <span className="grid size-9 place-items-center rounded-lg bg-secondary text-primary">
                        <Icon className="size-4" />
                      </span>
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <div className="mx-auto w-full max-w-md lg:mx-0">
            <IdentityPanel />
            <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">
              RoomTone uses a temporary browser session. No password or email needed.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
