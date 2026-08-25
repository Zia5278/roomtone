"use client";

import { useMutation } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  MessageCircleMore,
  Mic2,
  Radio,
  RefreshCw,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

import { SessionGate } from "@/components/session-gate";
import { useStreamClients } from "@/components/stream-clients-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/user-avatar";
import { createRoom, type SessionResponse } from "@/lib/api";

function normalizeTitle(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function validateTitle(value: string) {
  const normalized = normalizeTitle(value);

  if (normalized.length < 3) {
    return "Enter at least 3 characters.";
  }

  if (normalized.length > 80) {
    return "Keep the title under 80 characters.";
  }

  return null;
}

function RestoredIdentity({ session }: { session: SessionResponse }) {
  const router = useRouter();
  const stream = useStreamClients();
  const [title, setTitle] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const bothReady = stream.video === "ready" && stream.chat === "ready";
  const hasError = stream.video === "error" || stream.chat === "error";

  const createRoomMutation = useMutation({
    mutationFn: createRoom,
    onSuccess: (room) => {
      toast.success("Your room is ready backstage.");
      router.push(`/rooms/${room.id}`);
    },
  });

  const services = [
    { label: "Live audio", icon: Mic2, status: stream.video },
    { label: "Room chat", icon: MessageCircleMore, status: stream.chat },
  ] as const;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const error = validateTitle(title);

    if (error) {
      setValidationError(error);
      return;
    }

    setValidationError(null);
    createRoomMutation.mutate(normalizeTitle(title));
  };

  const requestError =
    createRoomMutation.error instanceof Error ? createRoomMutation.error.message : null;
  const roomError = validationError ?? requestError;

  return (
    <Card
      className="w-full"
      data-testid="stream-connection"
      data-stream-user-id={session.user.id}
      data-video-status={stream.video}
      data-chat-status={stream.chat}
    >
      <CardHeader className="gap-2 px-6 pt-6">
        <Badge className="mb-3 w-fit" variant="secondary">
          <Check /> Identity restored
        </Badge>
        <CardTitle className="text-xl">Create your first room.</CardTitle>
        <CardDescription className="leading-6">
          Name the conversation now. You can prepare backstage before anyone hears
          you.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 px-6 pb-6">
        <div className="flex items-center gap-4 rounded-lg bg-secondary p-4">
          <UserAvatar user={session.user} className="size-12" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{session.user.display_name}</p>
            <p className="text-sm text-muted-foreground">
              {bothReady ? "Ready to host" : "Preparing your session"}
            </p>
          </div>
          {bothReady ? <Check className="size-4 text-[#23a559]" /> : null}
        </div>

        <div className="grid grid-cols-2 gap-3" aria-live="polite">
          {services.map((service) => {
            const Icon = service.icon;
            const StatusIcon =
              service.status === "ready"
                ? Check
                : service.status === "error"
                  ? X
                  : RefreshCw;

            return (
              <div
                key={service.label}
                className="flex items-center gap-3 rounded-lg bg-secondary p-3"
              >
                <Icon className="size-4 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{service.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {service.status === "ready"
                      ? "Connected"
                      : service.status === "error"
                        ? "Unavailable"
                        : "Connecting"}
                  </p>
                </div>
                <StatusIcon
                  className={
                    service.status === "connecting"
                      ? "size-4 animate-spin text-muted-foreground"
                      : service.status === "ready"
                        ? "size-4 text-[#23a559]"
                        : "size-4 text-destructive"
                  }
                />
              </div>
            );
          })}
        </div>

        <form className="grid gap-3 rounded-lg bg-secondary p-4" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor="room-title">Room title</Label>
            <Input
              id="room-title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                if (validationError) {
                  setValidationError(null);
                }
              }}
              placeholder="What are we talking about?"
              maxLength={100}
              disabled={!bothReady || createRoomMutation.isPending}
              aria-invalid={Boolean(roomError)}
              aria-describedby="room-title-help"
            />
            <p
              id="room-title-help"
              className={
                roomError ? "text-xs text-destructive" : "text-xs text-muted-foreground"
              }
              aria-live="polite"
            >
              {roomError ?? "You can share the room link before going live."}
            </p>
          </div>
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!bothReady || createRoomMutation.isPending}
          >
            {createRoomMutation.isPending ? (
              <RefreshCw data-icon="inline-start" className="animate-spin" />
            ) : (
              <Radio data-icon="inline-start" />
            )}
            {createRoomMutation.isPending ? "Creating room" : "Create room"}
            {!createRoomMutation.isPending ? (
              <ArrowRight data-icon="inline-end" />
            ) : null}
          </Button>
        </form>

        {hasError ? (
          <Button variant="secondary" onClick={stream.retry}>
            <RefreshCw data-icon="inline-start" />
            Retry realtime connection
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function IdentityPanel() {
  return (
    <SessionGate>
      {(session) => <RestoredIdentity session={session} />}
    </SessionGate>
  );
}
