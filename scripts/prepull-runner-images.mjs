import { spawn } from "node:child_process";

const required = [
  "RUNNER_IMAGE_NODE_CLI",
  "RUNNER_IMAGE_NODE_HTTP",
  "RUNNER_IMAGE_WEB_PREVIEW",
];
const optional = ["RUNNER_IMAGE_PLAYWRIGHT"];
const images = [...required, ...optional]
  .map((key) => ({ key, image: process.env[key] }))
  .filter((entry) => entry.image);

for (const key of required) {
  if (!process.env[key]?.includes("@sha256:")) {
    throw new Error(`${key} must be set to an immutable image digest.`);
  }
}
for (const { key, image } of images) {
  if (!image.includes("@sha256:")) throw new Error(`${key} must be an immutable image digest.`);
  await new Promise((resolve, reject) => {
    const child = spawn("docker", ["pull", image], { stdio: "inherit", shell: false });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`docker pull failed for ${key}`)));
  });
}
