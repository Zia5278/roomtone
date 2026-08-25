"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CallingState,
  hasAudio,
  ParticipantsAudio,
  StreamCall,
  StreamVideo,
  type Call,
  type StreamVideoParticipant,
  useCallStateHooks,
} from "@stream-io/video-react-sdk";
import {
  ArrowLeft,
  Check,
  Copy,
  Headphones,
  LogOut,
  MessageCircleMore,
  Mic,
  MicOff,
  Radio,
  RefreshCw,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { SessionGate } from "@/components/session-gate";
import { useStreamClients } from "@/components/stream-clients-provider";
import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/user-avatar";
import {
  ApiError,
  getRoom,
  goLive,
  type Room,
  type SessionResponse,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const avatarColors = [
  "bg-primary",
  "bg-[#5865f2]",
  "bg-[#23a559]",
  "bg-[#9b59b6]",
  "bg-[#f0b232]",
] as const;

const knownAvatarColors: Record<SessionResponse["user"]["avatar_color"], string> = {
  coral: "bg-primary",
  blue: "bg-[#5865f2]",
  green: "bg-[#23a559]",
  purple: "bg-[#9b59b6]",
  gold: "bg-[#f0b232]",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function avatarColor(userId: string) {
  const total = Array.from(userId).reduce(
    (current, character) => current + character.charCodeAt(0),
    0,
  );
  return avatarColors[total % avatarColors.length];
}

async function safelyLeaveCall(call: Call) {
  if (
    call.state.callingState === CallingState.UNKNOWN ||
    call.state.callingState === CallingState.LEFT
  ) {
    return;
  }

  await call.leave().catch(() => undefined);
}

function ParticipantTile({
  participant,
  hostId,
  knownAvatarColor,
}: {
  participant: StreamVideoParticipant;
  hostId: string;
  knownAvatarColor?: SessionResponse["user"]["avatar_color"];
}) {
  const name = participant.name || "RoomTone guest";
  const isHost = participant.userId === hostId;
  const isAudioPublished = hasAudio(participant);

  return (
    <div
      className="grid min-h-44 place-items-center gap-6 rounded-xl bg-secondary p-6 text-center"
      data-testid="participant-tile"
      data-user-id={participant.userId}
      data-speaking={participant.isSpeaking}
      data-audio-published={isAudioPublished}
    >
      <Avatar
        className={cn(
          "size-20",
          participant.isSpeaking && "ring-2 ring-speaking after:border-transparent",
        )}
        aria-label={
          participant.isSpeaking
            ? `${name}, speaking`
            : !isHost && !isAudioPublished
              ? `${name}, muted`
              : `${name}, present`
        }
      >
        <AvatarFallback
          className={cn(
            "text-xl font-semibold text-white",
            knownAvatarColor
              ? knownAvatarColors[knownAvatarColor]
              : avatarColor(participant.userId),
          )}
        >
          {getInitials(name)}
        </AvatarFallback>
        {!participant.isSpeaking && !isHost && !isAudioPublished ? (
          <AvatarBadge
            className="size-5 bg-destructive text-white [&>svg]:size-3"
            aria-label="Muted"
          >
            <MicOff />
          </AvatarBadge>
        ) : null}
        {!participant.isSpeaking && (isHost || isAudioPublished) ? (
          <AvatarBadge
            className="size-3 bg-muted-foreground"
            aria-label="Present, not speaking"
          />
        ) : null}
      </Avatar>
      <div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <p className="font-semibold">{name}</p>
          {isHost ? <Badge variant="secondary">Host</Badge> : null}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {participant.isLocalParticipant ? "You" : "In the room"}
        </p>
      </div>
    </div>
  );
}

function CallRoom({ room, session, call }: { room: Room; session: SessionResponse; call: Call }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    useCallCallingState,
    useIsCallLive,
    useMicrophoneState,
    useParticipants,
  } = useCallStateHooks();
  const callingState = useCallCallingState();
  const isLive = useIsCallLive();
  const participants = useParticipants();
  const visibleParticipants = useMemo(() => {
    const participantsByUser = new Map<string, StreamVideoParticipant>();

    for (const participant of participants) {
      const existing = participantsByUser.get(participant.userId);
      if (!existing || participant.isLocalParticipant || !existing.isLocalParticipant) {
        participantsByUser.set(participant.userId, participant);
      }
    }

    return Array.from(participantsByUser.values());
  }, [participants]);
  const { microphone, isMute, isTogglePending } = useMicrophoneState();
  const isJoined = callingState === CallingState.JOINED;

  const liveMutation = useMutation({
    mutationFn: async () => {
      const updatedRoom = await goLive(room.id);
      await call.get();
      return updatedRoom;
    },
    onSuccess: (updatedRoom) => {
      queryClient.setQueryData(["room", room.id], updatedRoom);
      toast.success("You are live. Guests can join now.");
    },
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      await call.microphone.disable();
      await call.join({ create: false });
    },
    onSuccess: () => toast.success("Joined as a listener. Your mic is off."),
  });

  const micMutation = useMutation({
    mutationFn: async () => {
      if (isMute) {
        await microphone.enable();
      } else {
        await microphone.disable();
      }
    },
    onError: () => {
      toast.error("RoomTone could not access your microphone. Check browser permission.");
    },
  });

  const leave = async () => {
    await safelyLeaveCall(call);
    router.push("/");
  };

  const copyRoomLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Room link copied.");
    } catch {
      toast.error("Could not copy the link. Copy it from the address bar instead.");
    }
  };

  const liveError = liveMutation.error instanceof Error ? liveMutation.error.message : null;
  const joinError = joinMutation.error instanceof Error ? joinMutation.error.message : null;

  return (
    <div
      className="grid gap-6"
      data-testid="room-experience"
      data-room-status={isLive ? "live" : "backstage"}
      data-call-state={callingState}
      data-is-host={room.is_host}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant={isLive ? "default" : "secondary"}>
              <Radio /> {isLive ? "Live" : "Backstage"}
            </Badge>
            <span className="text-xs text-muted-foreground">Hosted by {room.host.display_name}</span>
          </div>
          <h1 className="font-serif text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            {room.title}
          </h1>
        </div>
        <Button variant="secondary" onClick={copyRoomLink}>
          <Copy data-icon="inline-start" />
          Copy room link
        </Button>
      </div>

      <Tabs defaultValue="stage" className="gap-6">
        <TabsList className="grid h-10 w-full grid-cols-2 lg:hidden">
          <TabsTrigger value="stage">
            <Headphones />
            Stage
          </TabsTrigger>
          <TabsTrigger value="chat">
            <MessageCircleMore />
            Chat
          </TabsTrigger>
        </TabsList>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <TabsContent
            value="stage"
            forceMount
            className="min-w-0 data-[state=inactive]:hidden lg:data-[state=inactive]:flex"
          >
            <Card className="min-h-[34rem] flex-1">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <Headphones className="size-4 text-primary" />
                    Audio room
                  </span>
                  <span className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                    <UsersRound className="size-4" />
                    <span data-testid="participant-count">{visibleParticipants.length}</span>
                  </span>
                </CardTitle>
                <CardDescription>
                  {isLive
                    ? "The conversation is live."
                    : room.is_host
                      ? "Only you can enter backstage before the room goes live."
                      : "The host is preparing the room."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-6">
                {!isLive && !room.is_host ? (
                  <div className="grid flex-1 place-items-center rounded-xl bg-secondary p-8 text-center">
                    <div className="max-w-sm">
                      <span className="mx-auto grid size-14 place-items-center rounded-full bg-card text-primary">
                        <Headphones className="size-6" />
                      </span>
                      <h2 className="mt-5 text-xl font-semibold">The host is backstage.</h2>
                      <p className="mt-2 leading-6 text-muted-foreground">
                        Keep this page open. The join button will appear as soon as the room goes live.
                      </p>
                    </div>
                  </div>
                ) : null}

                {isLive && !room.is_host && !isJoined ? (
                  <div className="grid flex-1 place-items-center rounded-xl bg-secondary p-8 text-center">
                    <div className="max-w-sm">
                      <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary text-primary-foreground">
                        <Radio className="size-6" />
                      </span>
                      <h2 className="mt-5 text-xl font-semibold">The room is live.</h2>
                      <p className="mt-2 leading-6 text-muted-foreground">
                        Join as a listener. Your microphone starts off and stays unavailable until the host invites you
                        to speak.
                      </p>
                      <Button
                        className="mt-6"
                        size="lg"
                        onClick={() => joinMutation.mutate()}
                        disabled={joinMutation.isPending}
                        data-testid="join-room"
                      >
                        {joinMutation.isPending ? (
                          <RefreshCw data-icon="inline-start" className="animate-spin" />
                        ) : (
                          <Headphones data-icon="inline-start" />
                        )}
                        {joinMutation.isPending ? "Joining" : "Join as listener"}
                      </Button>
                      {joinError ? (
                        <p className="mt-3 text-sm text-destructive" role="alert">
                          {joinError}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {isJoined ? (
                  <>
                    <ParticipantsAudio participants={visibleParticipants} />
                    <div className="grid flex-1 gap-6 sm:grid-cols-2">
                      {visibleParticipants.map((participant) => (
                        <ParticipantTile
                          key={participant.sessionId}
                          participant={participant}
                          hostId={room.host.id}
                          knownAvatarColor={
                            participant.userId === room.host.id
                              ? room.host.avatar_color
                              : participant.userId === session.user.id
                                ? session.user.avatar_color
                                : undefined
                          }
                        />
                      ))}
                    </div>
                  </>
                ) : null}

                {room.is_host && !isJoined ? (
                  <div className="flex flex-1 items-center justify-center text-muted-foreground">
                    <RefreshCw className="mr-2 size-4 animate-spin" />
                    Entering backstage…
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-center gap-4 rounded-xl bg-secondary p-4">
                  {room.is_host && isJoined ? (
                    <Button
                      variant="secondary"
                      onClick={() => micMutation.mutate()}
                      disabled={micMutation.isPending || isTogglePending}
                      data-testid="microphone-toggle"
                    >
                      {isMute ? (
                        <MicOff data-icon="inline-start" />
                      ) : (
                        <Mic data-icon="inline-start" />
                      )}
                      {isMute ? "Mic off" : "Mic on"}
                    </Button>
                  ) : null}

                  {room.is_host && !isLive ? (
                    <Button
                      onClick={() => liveMutation.mutate()}
                      disabled={!isJoined || liveMutation.isPending}
                      data-testid="go-live"
                    >
                      {liveMutation.isPending ? (
                        <RefreshCw data-icon="inline-start" className="animate-spin" />
                      ) : (
                        <Radio data-icon="inline-start" />
                      )}
                      {liveMutation.isPending ? "Starting room" : "Go live"}
                    </Button>
                  ) : null}

                  <div
                    className={cn(
                      room.is_host && "ml-2 border-l border-border pl-4",
                    )}
                  >
                    <Button variant="destructive" onClick={leave}>
                      <LogOut data-icon="inline-start" />
                      Leave room
                    </Button>
                  </div>
                </div>

                {liveError ? (
                  <p className="text-center text-sm text-destructive" role="alert">
                    {liveError}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent
            value="chat"
            forceMount
            className="grid content-start gap-6 data-[state=inactive]:hidden lg:data-[state=inactive]:grid"
          >
            <Card>
              <CardHeader>
                <CardTitle>Room details</CardTitle>
                <CardDescription>Everyone sees the same host and room link.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="flex items-center gap-3 rounded-lg bg-secondary p-3">
                  <UserAvatar user={room.host} className="size-10" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{room.host.display_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {room.is_host ? "Host · You" : "Host"}
                    </p>
                  </div>
                  {room.is_host ? <Check className="ml-auto size-4 text-muted-foreground" /> : null}
                </div>
                {!room.is_host ? (
                  <div className="flex items-center gap-3 rounded-lg bg-secondary p-3">
                    <UserAvatar user={session.user} className="size-10" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{session.user.display_name}</p>
                      <p className="text-xs text-muted-foreground">You are visiting</p>
                    </div>
                    <Check className="ml-auto size-4 text-muted-foreground" />
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircleMore className="size-4 text-primary" />
                  Room chat
                </CardTitle>
                <CardDescription>
                  The live chat panel is the next stage after the audio-room loop is
                  verified.
                </CardDescription>
              </CardHeader>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function ConnectedRoom({ room, session }: { room: Room; session: SessionResponse }) {
  const stream = useStreamClients();
  const [call, setCall] = useState<Call | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const callRef = useRef<Call | null>(null);
  const setupPromiseRef = useRef<Promise<Call> | null>(null);
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!stream.videoClient) {
      return;
    }

    if (cleanupTimerRef.current) {
      clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }

    const nextCall =
      callRef.current ?? stream.videoClient.call("audio_room", room.id);
    callRef.current = nextCall;
    let active = true;

    setupPromiseRef.current ??= (async () => {
        if (room.is_host) {
          await nextCall.join({ create: false });
        } else {
          await nextCall.get();
        }
        return nextCall;
      })();

    const prepare = async () => {
      try {
        const preparedCall = await setupPromiseRef.current;
        if (!active) {
          return;
        }

        setCall(preparedCall);
      } catch (error) {
        if (active) {
          setSetupError(
            error instanceof Error ? error.message : "The audio room could not connect.",
          );
        }
      }
    };

    void prepare();

    return () => {
      active = false;
      cleanupTimerRef.current = setTimeout(() => {
        const setupPromise = setupPromiseRef.current;
        callRef.current = null;
        setupPromiseRef.current = null;
        cleanupTimerRef.current = null;

        void (setupPromise ?? Promise.resolve(nextCall))
          .then(safelyLeaveCall)
          .catch(() => undefined);
      }, 0);
    };
  }, [room.id, room.is_host, stream.videoClient]);

  if (setupError) {
    return (
      <Card className="mx-auto w-full max-w-lg">
        <CardHeader>
          <CardTitle>The audio room could not connect.</CardTitle>
          <CardDescription>{setupError}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="secondary">
            <Link href="/">
              <ArrowLeft data-icon="inline-start" />
              Back to RoomTone
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!call || !stream.videoClient) {
    return (
      <Card className="mx-auto w-full max-w-lg">
        <CardContent className="flex min-h-72 items-center justify-center gap-3 text-muted-foreground">
          <RefreshCw className="size-4 animate-spin" />
          {room.is_host ? "Entering backstage…" : "Checking the room status…"}
        </CardContent>
      </Card>
    );
  }

  return (
    <StreamVideo client={stream.videoClient}>
      <StreamCall call={call}>
        <CallRoom room={room} session={session} call={call} />
      </StreamCall>
    </StreamVideo>
  );
}

function RoomData({ roomId, session }: { roomId: string; session: SessionResponse }) {
  const stream = useStreamClients();
  const room = useQuery({
    queryKey: ["room", roomId],
    queryFn: () => getRoom(roomId),
  });

  if (room.isPending || stream.video === "connecting" || stream.chat === "connecting") {
    return (
      <Card className="mx-auto w-full max-w-lg">
        <CardContent className="flex min-h-72 items-center justify-center gap-3 text-muted-foreground">
          <RefreshCw className="size-4 animate-spin" />
          Preparing the room…
        </CardContent>
      </Card>
    );
  }

  if (room.isError) {
    const missing = room.error instanceof ApiError && room.error.status === 404;
    return (
      <Card className="mx-auto w-full max-w-lg">
        <CardHeader>
          <CardTitle>{missing ? "This room does not exist." : "RoomTone could not load the room."}</CardTitle>
          <CardDescription>
            {missing
              ? "Check the shared link or ask the host for a new one."
              : room.error instanceof Error
                ? room.error.message
                : "Try again in a moment."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button asChild variant="secondary">
            <Link href="/">
              <ArrowLeft data-icon="inline-start" />
              Home
            </Link>
          </Button>
          {!missing ? (
            <Button onClick={() => room.refetch()}>
              <RefreshCw data-icon="inline-start" />
              Try again
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  if (stream.video === "error" || stream.chat === "error") {
    return (
      <Card className="mx-auto w-full max-w-lg">
        <CardHeader>
          <CardTitle>Realtime services are unavailable.</CardTitle>
          <CardDescription>
            Your session and room are safe. Reconnect audio and chat to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={stream.retry}>
            <RefreshCw data-icon="inline-start" />
            Reconnect
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <ConnectedRoom room={room.data} session={session} />;
}

export function RoomExperience({ roomId }: { roomId: string }) {
  return (
    <SessionGate>
      {(session) => <RoomData roomId={roomId} session={session} />}
    </SessionGate>
  );
}
