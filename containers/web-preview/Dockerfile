# syntax=docker/dockerfile:1
ARG NODE_IMAGE
FROM ${NODE_IMAGE}

WORKDIR /work
ENV NODE_ENV=production \
    HOME=/tmp

# Browser preview servers run from the mounted attempt; no credentials are baked in.
USER node
CMD ["node", "--version"]
