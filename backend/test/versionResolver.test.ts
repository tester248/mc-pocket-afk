/// <reference types="node" />

import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_VERSION,
  SUPPORTED_VERSIONS,
  findSupportedVersionInText,
  resolveRequestedVersion,
} from "../src/bot/VersionResolver";

test("resolveRequestedVersion accepts supported exact version", () => {
  const supported = SUPPORTED_VERSIONS[0];
  const resolved = resolveRequestedVersion(supported);

  assert.ok(resolved);
  assert.equal(resolved.source, "requested");
  assert.equal(resolved.resolvedVersion, supported);
  assert.equal(resolved.warning, undefined);
});

test("resolveRequestedVersion warns for unsupported requested version", () => {
  const resolved = resolveRequestedVersion("9.99.9");

  assert.ok(resolved);
  assert.equal(resolved.source, "requested");
  assert.equal(resolved.resolvedVersion, "9.99.9");
  assert.match(resolved.warning ?? "", /not in the supported version list/i);
});

test("resolveRequestedVersion returns null when version is blank", () => {
  assert.equal(resolveRequestedVersion("   "), null);
});

test("findSupportedVersionInText matches embedded version text", () => {
  const supported = SUPPORTED_VERSIONS[0];
  const matched = findSupportedVersionInText(`Paper ${supported}`);

  assert.equal(matched, supported);
});

test("findSupportedVersionInText returns null when no version is detected", () => {
  assert.equal(findSupportedVersionInText("Some Unknown Server Name"), null);
});

test("default version constant is available", () => {
  assert.ok(DEFAULT_VERSION.length > 0);
});
