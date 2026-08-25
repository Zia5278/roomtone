"use client";

import { useQuery } from "@tanstack/react-query";
import { CircleCheck, RefreshCw, ServerOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getReadiness } from "@/lib/api";

export function FoundationStatus() {
  const health = useQuery({
    queryKey: ["api-readiness"],
    queryFn: getReadiness,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Foundation check</CardTitle>
        <CardDescription>
          The browser calls FastAPI through a same-origin Next.js proxy.
        </CardDescription>
        <CardAction>
          <Badge aria-live="polite">
            {health.isPending ? (
              <>
                <RefreshCw className="animate-spin" />
                Checking
              </>
            ) : health.isSuccess ? (
              <>
                <CircleCheck />
                Ready
              </>
            ) : (
              <>
                <ServerOff />
                Not ready
              </>
            )}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {health.isSuccess
            ? "FastAPI answered and PostgreSQL accepted a query."
            : health.isError
              ? "Start FastAPI and PostgreSQL, then try again."
              : "Waiting for the API response…"}
        </p>
        {health.isError ? (
          <Button
            size="sm"
            onClick={() => health.refetch()}
            disabled={health.isFetching}
          >
            <RefreshCw
              data-icon="inline-start"
              className={health.isFetching ? "animate-spin" : undefined}
            />
            Retry
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
