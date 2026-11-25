import type { ExecutionContext } from "@cloudflare/workers-types";

import type { Logger } from "../../logger";
import type { Env, PublishJobSource } from "../../types";
import { toNostrOk, mapErrorToNostrMessage } from "../http/mappers";
import { runEnqueue, runIngressPipeline } from "../pipeline";

const WS_SOURCE: PublishJobSource = "external-client";

/**
 * A write-only socket has nothing to do until an EVENT arrives. Close before
 * the Workers runtime evicts the isolate and counts the invocation as an error.
 */
export const WS_IDLE_CLOSE_MS = 15_000;

const NOTICE_INVALID_JSON = "invalid JSON";
const NOTICE_INVALID_FORMAT = "invalid message format";
const NOTICE_UNSUPPORTED = "unsupported: only EVENT is supported";
const NOTICE_AUTH_NOT_REQUIRED = "auth not required for this relay";
const NOTICE_IDLE = "idle timeout: EVENT required";

interface RelaySocket {
  /** An EVENT arrived. Keep the socket open while the pipeline runs. */
  holdForEvent(): void;
  /** Send a NOTICE and close. Idempotent. */
  reject(notice: string): void;
  /** Close after an EVENT response. Idempotent. */
  close(): void;
}

function closeSocket(server: WebSocket): void {
  try {
    server.close();
  } catch {
    // Already closing or closed.
  }
}

function sendFrame(server: WebSocket, payload: string): void {
  try {
    server.send(payload);
  } catch {
    // Socket already closed.
  }
}

function sendNotice(server: WebSocket, message: string): void {
  sendFrame(server, JSON.stringify(["NOTICE", message]));
}

/**
 * Handle a single incoming WebSocket message (Nostr relay protocol).
 * Expects ["EVENT", event] and responds with ["OK", eventId, accepted, message].
 * Sends OK, schedules enqueue via waitUntil (so it runs to completion), then closes.
 * Without waitUntil, close() tears down the request and cancels fire-and-forget enqueue.
 * Any other message gets a NOTICE and the socket closes.
 */
async function handleEventMessage(
  server: WebSocket,
  env: Env,
  logger: Logger,
  ctx: ExecutionContext,
  event: MessageEvent,
  socket: RelaySocket,
): Promise<void> {
  let raw: unknown;
  try {
    raw = JSON.parse(event.data as string) as unknown;
  } catch {
    logger.warn("WS: Invalid JSON", {});
    socket.reject(NOTICE_INVALID_JSON);
    return;
  }

  if (!Array.isArray(raw) || raw.length < 2) {
    socket.reject(NOTICE_INVALID_FORMAT);
    return;
  }

  const [type, payload] = raw as [unknown, unknown];
  if (typeof type !== "string") {
    socket.reject(NOTICE_INVALID_FORMAT);
    return;
  }

  if (type === "AUTH") {
    socket.reject(NOTICE_AUTH_NOT_REQUIRED);
    return;
  }

  if (type !== "EVENT") {
    socket.reject(NOTICE_UNSUPPORTED);
    return;
  }

  // Cancel the idle close before the first await so a slow pipeline is not cut off.
  socket.holdForEvent();

  const result = await runIngressPipeline(env, payload, WS_SOURCE, logger, {
    deferEnqueue: true,
  });

  if (result.ok) {
    sendFrame(server, toNostrOk(result.eventId, true, ""));
    const enqueuePayload = result.enqueuePayload;
    if (enqueuePayload) {
      ctx.waitUntil(
        (async () => {
          try {
            await runEnqueue(env, logger, enqueuePayload);
          } catch (err) {
            logger.error("WS: enqueue failed", { error: err });
          }
        })(),
      );
    }
  } else {
    const eventId = (payload as Record<string, unknown>)["id"] ?? "";
    sendFrame(
      server,
      mapErrorToNostrMessage(
        typeof eventId === "string" ? eventId : "",
        result.error,
      ),
    );
  }
  socket.close();
}

export function handleWebSocketRelay(
  server: WebSocket,
  env: Env,
  logger: Logger,
  ctx: ExecutionContext,
): void {
  let closed = false;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;

  const clearIdleTimer = (): void => {
    if (idleTimer === undefined) return;
    clearTimeout(idleTimer);
    idleTimer = undefined;
  };

  const closeOnce = (notice?: string): void => {
    clearIdleTimer();
    if (closed) return;
    closed = true;
    if (notice !== undefined) sendNotice(server, notice);
    closeSocket(server);
  };

  const socket: RelaySocket = {
    holdForEvent: clearIdleTimer,
    reject: (notice: string) => closeOnce(notice),
    close: () => closeOnce(),
  };

  idleTimer = setTimeout(() => {
    closeOnce(NOTICE_IDLE);
  }, WS_IDLE_CLOSE_MS);

  server.addEventListener("message", (event: MessageEvent) => {
    void handleEventMessage(server, env, logger, ctx, event, socket);
  });

  server.addEventListener("close", () => {
    clearIdleTimer();
    closed = true;
    logger.info("WS: connection closed", {});
  });

  server.addEventListener("error", () => {
    logger.warn("WS: error", {});
  });
}
