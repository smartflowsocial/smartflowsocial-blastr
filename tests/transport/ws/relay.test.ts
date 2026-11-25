import type { ExecutionContext } from "@cloudflare/workers-types";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { BlastrError } from "../../../src/errors";
import { ConsoleLogger } from "../../../src/logger";
import * as pipeline from "../../../src/transport/pipeline";
import {
  handleWebSocketRelay,
  WS_IDLE_CLOSE_MS,
} from "../../../src/transport/ws/relay";
import type { Env } from "../../../src/types";

vi.mock("../../../src/transport/pipeline");

function createMockServerWebSocket(): {
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  getMessageListener: () => ((event: MessageEvent) => void) | undefined;
  getCloseListener: () => (() => void) | undefined;
  getErrorListener: () => (() => void) | undefined;
} {
  const send = vi.fn();
  const close = vi.fn();
  let messageListener: ((event: MessageEvent) => void) | undefined;
  let closeListener: (() => void) | undefined;
  let errorListener: (() => void) | undefined;
  const addEventListener = vi.fn(
    (event: string, listener: (e?: MessageEvent) => void) => {
      if (event === "message") messageListener = listener;
      if (event === "close") closeListener = listener;
      if (event === "error") errorListener = listener;
    },
  );
  return {
    send,
    close,
    addEventListener,
    getMessageListener: () => messageListener,
    getCloseListener: () => closeListener,
    getErrorListener: () => errorListener,
  };
}

/** Allow async message handler to run. */
async function flushAsync(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

function mockEnv(): Env {
  const base: Record<string, unknown> = {
    PUBLISHED_NOTES: { get: vi.fn(), put: vi.fn() },
    BLASTR_RATE_LIMIT: { get: vi.fn(), put: vi.fn() },
    DB: {},
    BLASTR_PUBLISH_QUEUE: { send: vi.fn().mockResolvedValue(undefined) },
  };
  return base as unknown as Env;
}

describe("handleWebSocketRelay message handling", () => {
  const logger = new ConsoleLogger();
  let mockServer: ReturnType<typeof createMockServerWebSocket>;
  let env: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    mockServer = createMockServerWebSocket();
    env = mockEnv();
    handleWebSocketRelay(mockServer as unknown as WebSocket, env, logger, {
      waitUntil: vi.fn(),
    } as unknown as ExecutionContext);
  });

  async function sendClientMessage(data: string): Promise<void> {
    const listener = mockServer.getMessageListener();
    if (!listener) throw new Error("expected message listener");
    listener({ data } as MessageEvent); // eslint-disable-line @typescript-eslint/consistent-type-assertions -- minimal mock
    await flushAsync();
  }

  function getSentMessages(): string[] {
    return vi.mocked(mockServer.send).mock.calls.map((c) => c[0] as string);
  }

  function expectClosed(): void {
    expect(mockServer.close).toHaveBeenCalledTimes(1);
  }

  function parseNotice(sent: string): string | null {
    try {
      const raw: unknown = JSON.parse(sent);
      const arr: unknown[] = Array.isArray(raw) ? raw : [];
      if (arr[0] === "NOTICE" && typeof arr[1] === "string") {
        return arr[1];
      }
    } catch {
      // ignore
    }
    return null;
  }

  const NOTICE_INVALID_JSON = "invalid JSON";
  const NOTICE_INVALID_FORMAT = "invalid message format";

  it("sends NOTICE for invalid JSON", async () => {
    await sendClientMessage("not json {");
    const sent = getSentMessages();
    expect(sent).toHaveLength(1);
    const first = sent[0];
    expect(first).toBeDefined();
    expect(parseNotice(first as string)).toBe(NOTICE_INVALID_JSON);
    expectClosed();
  });

  it("sends NOTICE for valid JSON but not an array", async () => {
    await sendClientMessage("{}");
    const sent = getSentMessages();
    expect(sent).toHaveLength(1);
    const first = sent[0];
    expect(first).toBeDefined();
    expect(parseNotice(first as string)).toBe(NOTICE_INVALID_FORMAT);
    expectClosed();
  });

  it("sends NOTICE for array length < 2", async () => {
    await sendClientMessage('["EVENT"]');
    const sent = getSentMessages();
    expect(sent).toHaveLength(1);
    const first = sent[0];
    expect(first).toBeDefined();
    expect(parseNotice(first as string)).toBe(NOTICE_INVALID_FORMAT);
    expectClosed();
  });

  it("sends NOTICE when first element is not a string (invalid format)", async () => {
    await sendClientMessage('[1, "payload"]');
    const sent = getSentMessages();
    expect(sent).toHaveLength(1);
    const first = sent[0];
    expect(first).toBeDefined();
    expect(parseNotice(first as string)).toBe(NOTICE_INVALID_FORMAT);
    expectClosed();
  });

  it("sends NOTICE for REQ (unsupported)", async () => {
    await sendClientMessage(JSON.stringify(["REQ", "sub-id", {}]));
    const sent = getSentMessages();
    expect(sent).toHaveLength(1);
    const first = sent[0];
    expect(first).toBeDefined();
    const notice = parseNotice(first as string);
    expect(notice).toContain("unsupported");
    expect(notice).toContain("EVENT");
    expectClosed();
  });

  it("sends NOTICE for CLOSE (unsupported)", async () => {
    await sendClientMessage(JSON.stringify(["CLOSE", "sub-id"]));
    const sent = getSentMessages();
    expect(sent).toHaveLength(1);
    const first = sent[0];
    expect(first).toBeDefined();
    expect(parseNotice(first as string)).toContain("unsupported");
    expectClosed();
  });

  it("sends NOTICE for AUTH (auth not required)", async () => {
    await sendClientMessage(JSON.stringify(["AUTH", "challenge or event"]));
    const sent = getSentMessages();
    expect(sent).toHaveLength(1);
    const first = sent[0];
    expect(first).toBeDefined();
    expect(parseNotice(first as string)).toContain("auth not required");
    expectClosed();
  });

  it("EVENT success: sends OK and no NOTICE", async () => {
    const eventId = "e".repeat(64);
    vi.mocked(pipeline.runIngressPipeline).mockResolvedValue({
      ok: true,
      jobId: 1,
      eventId,
    });
    const eventPayload = {
      id: eventId,
      pubkey: "b".repeat(64),
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: "hi",
      sig: "c".repeat(128),
    };
    await sendClientMessage(JSON.stringify(["EVENT", eventPayload]));
    const sent = getSentMessages();
    expect(sent).toHaveLength(1);
    const first = sent[0];
    expect(first).toBeDefined();
    expect(first).toBe(JSON.stringify(["OK", eventId, true, ""]));
    expect(parseNotice(first as string)).toBeNull();
    expectClosed();
  });

  it("EVENT failure: sends OK with accepted false and no NOTICE", async () => {
    const eventId = "e".repeat(64);
    vi.mocked(pipeline.runIngressPipeline).mockResolvedValue({
      ok: false,
      error: new BlastrError("not entitled", "not_entitled", { status: 403 }),
    });
    const eventPayload = {
      id: eventId,
      pubkey: "b".repeat(64),
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      tags: [],
      content: "hi",
      sig: "c".repeat(128),
    };
    await sendClientMessage(JSON.stringify(["EVENT", eventPayload]));
    const sent = getSentMessages();
    expect(sent).toHaveLength(1);
    const first = sent[0];
    expect(first).toBeDefined();
    const parsed = JSON.parse(first as string) as unknown[];
    expect(parsed[0]).toBe("OK");
    expect(parsed[1]).toBe(eventId);
    expect(parsed[2]).toBe(false);
    expect(parseNotice(first as string)).toBeNull();
    expectClosed();
  });

  it("EVENT with non-object payload: pipeline is called; sends OK with accepted false when pipeline fails", async () => {
    vi.mocked(pipeline.runIngressPipeline).mockResolvedValue({
      ok: false,
      error: new BlastrError("invalid", "invalid_event", { status: 400 }),
    });
    await sendClientMessage(JSON.stringify(["EVENT", "not-an-object"]));
    expect(pipeline.runIngressPipeline).toHaveBeenCalledWith(
      env,
      "not-an-object",
      "external-client",
      logger,
      { deferEnqueue: true },
    );
    const sent = getSentMessages();
    expect(sent).toHaveLength(1);
    const first = sent[0];
    expect(first).toBeDefined();
    const parsed = JSON.parse(first as string) as unknown[];
    expect(parsed[0]).toBe("OK");
    expect(parsed[2]).toBe(false);
    expectClosed();
  });
});

describe("handleWebSocketRelay close and error listeners", () => {
  const logger = new ConsoleLogger();
  let mockServer: ReturnType<typeof createMockServerWebSocket>;
  const env = mockEnv();

  beforeEach(() => {
    vi.clearAllMocks();
    mockServer = createMockServerWebSocket();
    vi.spyOn(logger, "info");
    vi.spyOn(logger, "warn");
    handleWebSocketRelay(mockServer as unknown as WebSocket, env, logger, {
      waitUntil: vi.fn(),
    } as unknown as ExecutionContext);
  });

  it("close listener logs and does not throw", () => {
    const closeListener = mockServer.getCloseListener();
    expect(closeListener).toBeDefined();
    expect(() => closeListener?.()).not.toThrow();
    expect(logger.info).toHaveBeenCalledWith("WS: connection closed", {});
  });

  it("error listener logs and does not throw", () => {
    const errorListener = mockServer.getErrorListener();
    expect(errorListener).toBeDefined();
    expect(() => errorListener?.()).not.toThrow();
    expect(logger.warn).toHaveBeenCalledWith("WS: error", {});
  });

  afterEach(() => {
    mockServer.getCloseListener()?.();
  });
});

describe("handleWebSocketRelay idle close", () => {
  const logger = new ConsoleLogger();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function sentNotices(
    mockServer: ReturnType<typeof createMockServerWebSocket>,
  ): string[] {
    return vi
      .mocked(mockServer.send)
      .mock.calls.map((call) => call[0] as string);
  }

  it("closes with a NOTICE when no EVENT arrives", async () => {
    const mockServer = createMockServerWebSocket();
    handleWebSocketRelay(
      mockServer as unknown as WebSocket,
      mockEnv(),
      logger,
      {
        waitUntil: vi.fn(),
      } as unknown as ExecutionContext,
    );

    await vi.advanceTimersByTimeAsync(WS_IDLE_CLOSE_MS);

    expect(mockServer.close).toHaveBeenCalledTimes(1);
    expect(sentNotices(mockServer)).toEqual([
      JSON.stringify(["NOTICE", "idle timeout: EVENT required"]),
    ]);
  });

  it("does not send the idle NOTICE after an EVENT", async () => {
    const mockServer = createMockServerWebSocket();
    const env = mockEnv();
    const eventId = "e".repeat(64);
    vi.mocked(pipeline.runIngressPipeline).mockResolvedValue({
      ok: true,
      jobId: 1,
      eventId,
    });
    handleWebSocketRelay(mockServer as unknown as WebSocket, env, logger, {
      waitUntil: vi.fn(),
    } as unknown as ExecutionContext);

    const listener = mockServer.getMessageListener();
    if (!listener) throw new Error("expected message listener");
    const data = JSON.stringify([
      "EVENT",
      {
        id: eventId,
        pubkey: "b".repeat(64),
        created_at: 0,
        kind: 1,
        tags: [],
        content: "hi",
        sig: "c".repeat(128),
      },
    ]);
    listener({ data } as MessageEvent); // eslint-disable-line @typescript-eslint/consistent-type-assertions -- minimal mock
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(WS_IDLE_CLOSE_MS);

    expect(mockServer.close).toHaveBeenCalledTimes(1);
    expect(sentNotices(mockServer)).toEqual([
      JSON.stringify(["OK", eventId, true, ""]),
    ]);
  });
});
