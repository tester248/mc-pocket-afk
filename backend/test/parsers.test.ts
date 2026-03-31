/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";

import { parseClientAction, parseConnectConfig } from "../src/websocket/parsers";
import type { ClientAction } from "../src/types/protocol";

const expectAction = <T extends ClientAction["action"]>(
  parsed: ClientAction | null,
  action: T,
): Extract<ClientAction, { action: T }> => {
  assert.ok(parsed, "Expected a parsed action.");
  assert.equal(parsed.action, action);
  return parsed as Extract<ClientAction, { action: T }>;
};

test("parseClientAction returns null for invalid JSON", () => {
  assert.equal(parseClientAction("{oops"), null);
});

test("parseClientAction supports connect action payload", () => {
  const payload = JSON.stringify({
    action: "connect",
    config: {
      host: "  mc.example.com  ",
      port: 25565,
      version: " 1.20.4 ",
      authMode: "premium",
      username: "  PocketBot  ",
      autoCommand: "  /login secret  ",
      fabricProfile: {
        gameVersion: " 1.20.4 ",
        registerPayloadBase64: "AAECAwQ=",
        channels: [
          { channel: "fabric:registry/sync/direct", dataBase64: "AAECAwQ=" },
          { channel: 123, dataBase64: "AAAA" },
        ],
      },
    },
  });

  const parsed = parseClientAction(payload);
  const connect = expectAction(parsed, "connect");

  assert.equal(connect.config.host, "mc.example.com");
  assert.equal(connect.config.port, 25565);
  assert.equal(connect.config.version, "1.20.4");
  assert.equal(connect.config.authMode, "premium");
  assert.equal(connect.config.username, "PocketBot");
  assert.equal(connect.config.autoCommand, "/login secret");
  assert.equal(connect.config.fabricProfile?.gameVersion, "1.20.4");
  assert.equal(connect.config.fabricProfile?.channels?.length, 1);
});

test("parseClientAction supports root-level command connect payload", () => {
  const payload = JSON.stringify({
    command: "connect",
    ip: "play.example.net",
    auth: "microsoft",
  });

  const parsed = parseClientAction(payload);
  const connect = expectAction(parsed, "connect");

  assert.equal(connect.config.host, "play.example.net");
  assert.equal(connect.config.authMode, "premium");
});

test("parseClientAction supports chat command alias message", () => {
  const payload = JSON.stringify({ command: "chat", message: "hello" });
  const parsed = parseClientAction(payload);
  const chat = expectAction(parsed, "chat");

  assert.equal(chat.text, "hello");
});

test("parseClientAction rejects invalid afk mode", () => {
  const payload = JSON.stringify({ action: "start_afk", type: "spin" });
  assert.equal(parseClientAction(payload), null);
});

test("parseConnectConfig rejects blank host", () => {
  const parsed = parseConnectConfig({ host: "   ", authMode: "cracked" });
  assert.equal(parsed, null);
});
