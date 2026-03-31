import type { Bot } from "mineflayer";

import type { FabricProfile } from "../../types/protocol";

interface FabricInjectorCallbacks {
  onInfo: (message: string) => void;
  onError: (message: string) => void;
}

interface CustomPayloadPacket {
  channel?: unknown;
  data?: unknown;
}

interface ProtocolClient {
  on: (event: "custom_payload", listener: (packet: CustomPayloadPacket) => void) => void;
  write: (event: "custom_payload", payload: { channel: string; data: Buffer }) => void;
}

const decodeBase64 = (raw: string): Buffer | null => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  let normalized = trimmed.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  const remainder = normalized.length % 4;
  if (remainder !== 0) {
    normalized = normalized.padEnd(normalized.length + (4 - remainder), "=");
  }

  if (/[^A-Za-z0-9+/=]/.test(normalized)) {
    return null;
  }

  const decoded = Buffer.from(normalized, "base64");
  return decoded.length > 0 ? decoded : null;
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

export class FabricPayloadInjector {
  private constructor(
    private readonly channelPayloads: Map<string, Buffer>,
    private readonly registerPayload: Buffer | null,
    private readonly callbacks: FabricInjectorCallbacks,
  ) {}

  public static fromProfile(
    profile: FabricProfile,
    callbacks: FabricInjectorCallbacks,
  ): FabricPayloadInjector | null {
    const channelPayloads = new Map<string, Buffer>();

    for (const entry of profile.channels ?? []) {
      const channel = entry.channel.trim();
      if (!channel) {
        continue;
      }

      const decoded = decodeBase64(entry.dataBase64);
      if (!decoded) {
        callbacks.onError(`Fabric payload for channel '${channel}' is not valid base64.`);
        continue;
      }

      channelPayloads.set(channel, decoded);
    }

    let registerPayload: Buffer | null = null;
    if (typeof profile.registerPayloadBase64 === "string") {
      registerPayload = decodeBase64(profile.registerPayloadBase64);
      if (!registerPayload) {
        callbacks.onError("Fabric register payload is not valid base64.");
      }
    }

    if (channelPayloads.size === 0 && !registerPayload) {
      callbacks.onInfo("Fabric profile provided, but no usable payload entries were found.");
      return null;
    }

    return new FabricPayloadInjector(channelPayloads, registerPayload, callbacks);
  }

  public attach(bot: Bot): void {
    const client = this.resolveClient(bot);
    if (!client) {
      this.callbacks.onError("Mineflayer protocol client was not available for Fabric injection.");
      return;
    }

    client.on("custom_payload", (packet) => {
      this.handleCustomPayload(client, packet);
    });

    this.callbacks.onInfo(
      `Fabric injector attached (${this.channelPayloads.size} channel payloads${
        this.registerPayload ? ", register payload" : ""
      }).`,
    );
  }

  private resolveClient(bot: Bot): ProtocolClient | null {
    const candidate = bot as unknown as { _client?: ProtocolClient };
    if (!candidate._client) {
      return null;
    }

    return candidate._client;
  }

  private handleCustomPayload(client: ProtocolClient, packet: CustomPayloadPacket): void {
    const channel = typeof packet.channel === "string" ? packet.channel : null;
    if (!channel) {
      return;
    }

    if (channel === "minecraft:register" && this.registerPayload) {
      this.respond(client, channel, this.registerPayload);
      return;
    }

    const mappedPayload = this.channelPayloads.get(channel);
    if (!mappedPayload) {
      return;
    }

    this.respond(client, channel, mappedPayload);
  }

  private respond(client: ProtocolClient, channel: string, data: Buffer): void {
    try {
      client.write("custom_payload", { channel, data });
      this.callbacks.onInfo(`Injected Fabric payload for channel '${channel}'.`);
    } catch (error) {
      this.callbacks.onError(
        `Failed to inject Fabric payload for channel '${channel}': ${toErrorMessage(error)}`,
      );
    }
  }
}
