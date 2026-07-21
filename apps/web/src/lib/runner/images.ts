import type { ChallengeRuntimeProfile } from "@prompt-race/shared";

type LogicalImage = ChallengeRuntimeProfile["image"];

const ENVIRONMENT_KEY: Record<LogicalImage, string> = {
  "prompt-race/node-cli:22": "RUNNER_IMAGE_NODE_CLI",
  "prompt-race/node-http:22": "RUNNER_IMAGE_NODE_HTTP",
  "prompt-race/web-preview:22": "RUNNER_IMAGE_WEB_PREVIEW",
};

const DEVELOPMENT_IMAGE: Record<LogicalImage, string> = {
  "prompt-race/node-cli:22": "node:22-alpine",
  "prompt-race/node-http:22": "node:22-alpine",
  "prompt-race/web-preview:22": "node:22-alpine",
};

function requireImmutableImages() {
  return process.env.NODE_ENV === "production" || process.env.RUNNER_REQUIRE_IMAGE_DIGESTS === "true";
}

/**
 * Resolves a private logical profile image. Local development may use the
 * documented Node base image; production requires an explicit immutable digest.
 */
export function resolveApprovedRunnerImage(logicalImage: LogicalImage): string {
  const environmentKey = ENVIRONMENT_KEY[logicalImage];
  const image = process.env[environmentKey] ?? DEVELOPMENT_IMAGE[logicalImage];
  if (requireImmutableImages() && !image.includes("@sha256:")) {
    throw new Error(`${environmentKey} must be an immutable image digest in production.`);
  }
  return image;
}

export function approvedRunnerImageEnvironmentKeys() {
  return Object.values(ENVIRONMENT_KEY);
}
