import * as minecraftProtocol from "minecraft-protocol";

import type { ConnectConfig, VersionResolutionSource } from "../types/protocol";

export interface VersionResolution {
  requestedVersion?: string;
  resolvedVersion: string;
  source: VersionResolutionSource;
  detectedVersionName?: string;
  detectedProtocol?: number;
  warning?: string;
}

export const SUPPORTED_VERSIONS = [...minecraftProtocol.supportedVersions];
export const DEFAULT_VERSION = minecraftProtocol.defaultVersion;

const sortedSupportedVersions = [...SUPPORTED_VERSIONS].sort((a, b) => b.length - a.length);

const normalizeVersion = (raw: string | undefined): string | undefined => {
  if (!raw) {
    return undefined;
  }

  const normalized = raw.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const extractDetectedVersionName = (result: unknown): string | undefined => {
  if (typeof result !== "object" || result === null) {
    return undefined;
  }

  const record = result as Record<string, unknown>;

  if (typeof record.version === "string") {
    return record.version;
  }

  if (typeof record.version === "object" && record.version !== null) {
    const versionRecord = record.version as Record<string, unknown>;
    if (typeof versionRecord.name === "string") {
      return versionRecord.name;
    }
  }

  return undefined;
};

const extractDetectedProtocol = (result: unknown): number | undefined => {
  if (typeof result !== "object" || result === null) {
    return undefined;
  }

  const record = result as Record<string, unknown>;

  if (typeof record.protocol === "number") {
    return record.protocol;
  }

  if (typeof record.version === "object" && record.version !== null) {
    const versionRecord = record.version as Record<string, unknown>;
    if (typeof versionRecord.protocol === "number") {
      return versionRecord.protocol;
    }
  }

  return undefined;
};

export const findSupportedVersionInText = (rawVersionName: string): string | null => {
  const normalized = rawVersionName.trim();
  if (!normalized) {
    return null;
  }

  if (SUPPORTED_VERSIONS.includes(normalized)) {
    return normalized;
  }

  const lower = normalized.toLowerCase();

  for (const version of sortedSupportedVersions) {
    if (lower.includes(version.toLowerCase())) {
      return version;
    }
  }

  return null;
};

export const resolveRequestedVersion = (requestedVersion: string | undefined): VersionResolution | null => {
  const normalizedRequested = normalizeVersion(requestedVersion);
  if (!normalizedRequested) {
    return null;
  }

  if (SUPPORTED_VERSIONS.includes(normalizedRequested)) {
    return {
      requestedVersion: normalizedRequested,
      resolvedVersion: normalizedRequested,
      source: "requested",
    };
  }

  return {
    requestedVersion: normalizedRequested,
    resolvedVersion: normalizedRequested,
    source: "requested",
    warning: `Requested version '${normalizedRequested}' is not in the supported version list; attempting anyway.`,
  };
};

export const resolveConnectVersion = async (config: ConnectConfig): Promise<VersionResolution> => {
  const requestedResolution = resolveRequestedVersion(config.version);
  if (requestedResolution) {
    return requestedResolution;
  }

  try {
    const pingResult = await minecraftProtocol.ping({
      host: config.host,
      port: config.port,
      closeTimeout: 4_000,
      noPongTimeout: 4_000,
    });

    const detectedVersionName = extractDetectedVersionName(pingResult);
    const detectedProtocol = extractDetectedProtocol(pingResult);

    const matchedVersion = detectedVersionName
      ? findSupportedVersionInText(detectedVersionName)
      : null;

    if (matchedVersion) {
      return {
        resolvedVersion: matchedVersion,
        source: "detected",
        detectedVersionName,
        detectedProtocol,
      };
    }

    const warning = detectedVersionName
      ? `Detected server version '${detectedVersionName}' does not match supported versions; falling back to default '${DEFAULT_VERSION}'.`
      : `Server version detection did not return a usable version; falling back to default '${DEFAULT_VERSION}'.`;

    return {
      resolvedVersion: DEFAULT_VERSION,
      source: "default",
      detectedVersionName,
      detectedProtocol,
      warning,
    };
  } catch (error) {
    return {
      resolvedVersion: DEFAULT_VERSION,
      source: "default",
      warning: `Version auto-detection failed (${toErrorMessage(error)}); falling back to default '${DEFAULT_VERSION}'.`,
    };
  }
};
