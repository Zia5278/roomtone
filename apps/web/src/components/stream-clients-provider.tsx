"use client";

import { StreamVideoClient } from "@stream-io/video-react-sdk";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { StreamChat } from "stream-chat";

import {
  createStreamToken,
  type StreamTokenResponse,
  type User,
} from "@/lib/api";

type ServiceStatus = "connecting" | "ready" | "error";

type StreamClientsState = {
  video: ServiceStatus;
  chat: ServiceStatus;
  videoClient: StreamVideoClient | null;
  chatClient: StreamChat | null;
  retry: () => void;
};

const StreamClientsContext = createContext<StreamClientsState | null>(null);
const TOKEN_REFRESH_BUFFER_MS = 60_000;

function createSharedTokenProvider(initial: StreamTokenResponse) {
  let current = {
    token: initial.token,
    expiresAt: Date.now() + initial.expires_in * 1_000,
  };
  let pendingRefresh: Promise<string> | null = null;

  return async () => {
    if (Date.now() < current.expiresAt - TOKEN_REFRESH_BUFFER_MS) {
      return current.token;
    }

    pendingRefresh ??= createStreamToken()
      .then((credentials) => {
        if (credentials.api_key !== initial.api_key) {
          throw new Error("The Stream application changed during this session.");
        }

        current = {
          token: credentials.token,
          expiresAt: Date.now() + credentials.expires_in * 1_000,
        };
        return current.token;
      })
      .finally(() => {
        pendingRefresh = null;
      });

    return pendingRefresh;
  };
}

export function StreamClientsProvider({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const [attempt, setAttempt] = useState(0);
  const [connection, setConnection] = useState<
    Omit<StreamClientsState, "retry">
  >({
    video: "connecting",
    chat: "connecting",
    videoClient: null,
    chatClient: null,
  });

  useEffect(() => {
    let active = true;
    let videoClient: StreamVideoClient | null = null;
    let chatClient: StreamChat | null = null;
    let connectionPromise: Promise<
      [PromiseSettledResult<unknown>, PromiseSettledResult<unknown>]
    > | null = null;
    let disconnected = false;

    const disconnect = async () => {
      if (disconnected) {
        return;
      }

      disconnected = true;
      await Promise.allSettled([
        videoClient?.disconnectUser(),
        chatClient?.disconnectUser(),
      ]);
    };

    const connect = async () => {
      setConnection({
        video: "connecting",
        chat: "connecting",
        videoClient: null,
        chatClient: null,
      });

      try {
        const credentials = await createStreamToken();
        if (!active) {
          return;
        }

        if (credentials.user.id !== user.id) {
          throw new Error("The RoomTone and Stream identities do not match.");
        }

        const tokenProvider = createSharedTokenProvider(credentials);
        videoClient = new StreamVideoClient({ apiKey: credentials.api_key });
        chatClient = new StreamChat(credentials.api_key);

        connectionPromise = Promise.allSettled([
          videoClient.connectUser(
            {
              id: user.id,
              name: user.display_name,
              custom: { avatar_color: user.avatar_color },
            },
            tokenProvider,
          ),
          chatClient.connectUser(
            {
              id: user.id,
              name: user.display_name,
            },
            tokenProvider,
          ),
        ]);

        const [videoResult, chatResult] = await connectionPromise;
        if (!active) {
          await disconnect();
          return;
        }

        const videoReady =
          videoResult.status === "fulfilled" &&
          videoClient.state.connectedUser?.id === user.id;
        const chatReady =
          chatResult.status === "fulfilled" && chatClient.userID === user.id;
        const bothReady = videoReady && chatReady;

        setConnection({
          video: bothReady ? "ready" : "error",
          chat: bothReady ? "ready" : "error",
          videoClient: bothReady ? videoClient : null,
          chatClient: bothReady ? chatClient : null,
        });

        if (!bothReady) {
          await disconnect();
        }
      } catch {
        if (active) {
          setConnection({
            video: "error",
            chat: "error",
            videoClient: null,
            chatClient: null,
          });
        }
        await disconnect();
      }
    };

    void connect();

    return () => {
      active = false;
      if (connectionPromise) {
        void connectionPromise.then(disconnect);
      } else {
        void disconnect();
      }
    };
  }, [attempt, user.avatar_color, user.display_name, user.id]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);
  const value = useMemo(
    () => ({ ...connection, retry }),
    [connection, retry],
  );

  return (
    <StreamClientsContext.Provider value={value}>
      {children}
    </StreamClientsContext.Provider>
  );
}

export function useStreamClients() {
  const context = useContext(StreamClientsContext);
  if (!context) {
    throw new Error("useStreamClients must be used inside StreamClientsProvider.");
  }

  return context;
}
