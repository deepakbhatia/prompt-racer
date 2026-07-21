# Runner images

Build these images only with immutable base-image digests. For example:

```sh
docker build --build-arg NODE_IMAGE=node:22-alpine@sha256:<digest> -t prompt-race/node-cli:dev containers/node-cli
```

Production profiles must set `RUNNER_IMAGE_NODE_CLI`,
`RUNNER_IMAGE_NODE_HTTP`, and `RUNNER_IMAGE_WEB_PREVIEW` to registry digests
such as `registry.example/prompt-race/node-http@sha256:<digest>`. The web app
rejects tag-only values in production.

## Runner-host release procedure

1. Build, smoke-test, scan, and push images through the `Runner images` CI
   workflow. Copy the digest reported in its job summary.
2. Update the runner-host image environment variables with those digests; do
   not give registry credentials to the web application host.
3. Before a heat begins, pre-pull every active image on each runner host:

   ```sh
   pnpm prepull:runner-images
   ```

4. Monitor pull failures, start latency, timeout/memory exits, and failed
   container cleanup in the runner service. Remove the attempt container after
   every run; retain its sandbox under a separate retention policy.
