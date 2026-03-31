import { MCPocketAFKWebSocketServer } from "./websocket/WSServer";

const parsePort = (raw: string | undefined): number => {
  const fallback = 8080;
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const main = async (): Promise<void> => {
  const host = process.env.HOST ?? "0.0.0.0";
  const port = parsePort(process.env.PORT);

  const server = new MCPocketAFKWebSocketServer({ host, port });
  await server.start();

  // eslint-disable-next-line no-console
  console.log(`[MCPocketAFK] Backend listening on ${host}:${port}`);

  const shutdown = async (signal: string): Promise<void> => {
    // eslint-disable-next-line no-console
    console.log(`[MCPocketAFK] Received ${signal}, shutting down...`);
    await server.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
};

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  // eslint-disable-next-line no-console
  console.error(`[MCPocketAFK] Fatal startup error: ${message}`);
  process.exit(1);
});
