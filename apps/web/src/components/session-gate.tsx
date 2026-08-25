"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Headphones, RefreshCw, UserRound } from "lucide-react";
import { FormEvent, type ReactNode, useState } from "react";
import { toast } from "sonner";

import {
  StreamClientsProvider,
} from "@/components/stream-clients-provider";
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
import {
  ApiError,
  createSession,
  getCurrentSession,
  type SessionResponse,
} from "@/lib/api";

export const sessionQueryKey = ["current-session"] as const;

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function validateName(value: string) {
  const normalized = normalizeName(value);

  if (normalized.length < 2) {
    return "Enter at least 2 characters.";
  }

  if (normalized.length > 40) {
    return "Keep your name under 40 characters.";
  }

  return null;
}

function NamePicker() {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const createSessionMutation = useMutation({
    mutationFn: createSession,
    onSuccess: (session) => {
      queryClient.setQueryData<SessionResponse>(sessionQueryKey, session);
      toast.success(`Welcome to RoomTone, ${session.user.display_name}.`);
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const error = validateName(displayName);

    if (error) {
      setValidationError(error);
      return;
    }

    setValidationError(null);
    createSessionMutation.mutate(normalizeName(displayName));
  };

  const requestError =
    createSessionMutation.error instanceof Error
      ? createSessionMutation.error.message
      : null;
  const error = validationError ?? requestError;

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="gap-2 px-6 pt-6">
        <span className="mb-2 grid size-11 place-items-center rounded-lg bg-secondary text-primary">
          <UserRound className="size-5" />
        </span>
        <CardTitle className="text-xl">What should we call you?</CardTitle>
        <CardDescription className="leading-6">
          Pick the name people will see in the room and chat. No account needed.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <form className="grid gap-5" onSubmit={submit} noValidate>
          <div className="grid gap-2">
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              name="displayName"
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
                if (validationError) {
                  setValidationError(null);
                }
              }}
              placeholder="e.g. Zia Haq"
              autoComplete="name"
              autoFocus
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "display-name-error" : "display-name-help"}
              disabled={createSessionMutation.isPending}
            />
            <p
              id={error ? "display-name-error" : "display-name-help"}
              className={
                error ? "text-xs text-destructive" : "text-xs text-muted-foreground"
              }
              aria-live="polite"
            >
              {error ?? "Use the name you want hosts and guests to recognize."}
            </p>
          </div>
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={createSessionMutation.isPending}
          >
            {createSessionMutation.isPending ? (
              <RefreshCw data-icon="inline-start" className="animate-spin" />
            ) : (
              <Headphones data-icon="inline-start" />
            )}
            {createSessionMutation.isPending ? "Saving your name" : "Enter RoomTone"}
            {!createSessionMutation.isPending ? (
              <ArrowRight data-icon="inline-end" />
            ) : null}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function SessionGate({
  children,
}: {
  children: (session: SessionResponse) => ReactNode;
}) {
  const session = useQuery({
    queryKey: sessionQueryKey,
    queryFn: getCurrentSession,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 401) {
        return false;
      }

      return failureCount < 1;
    },
  });

  if (session.isPending) {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardContent className="flex min-h-72 items-center justify-center gap-3 text-muted-foreground">
          <RefreshCw className="size-4 animate-spin" />
          Restoring your session…
        </CardContent>
      </Card>
    );
  }

  if (session.isSuccess) {
    return (
      <StreamClientsProvider user={session.data.user}>
        {children(session.data)}
      </StreamClientsProvider>
    );
  }

  if (session.error instanceof ApiError && session.error.status === 401) {
    return <NamePicker />;
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="gap-2 px-6 pt-6">
        <CardTitle className="text-xl">RoomTone could not connect.</CardTitle>
        <CardDescription className="leading-6">
          Check that the API and PostgreSQL are running, then try again.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <Button onClick={() => session.refetch()} disabled={session.isFetching}>
          <RefreshCw
            data-icon="inline-start"
            className={session.isFetching ? "animate-spin" : undefined}
          />
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}
