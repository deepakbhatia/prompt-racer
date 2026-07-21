# syntax=docker/dockerfile:1
# Supply a pinned value, for example node:22-alpine@sha256:<digest>.
ARG NODE_IMAGE
FROM ${NODE_IMAGE}

WORKDIR /work
ENV NODE_ENV=production \
    HOME=/tmp

# The image deliberately contains only the Node/npm runtime. It has no cloud
# CLI, Docker client, SSH client, registry credentials, or application secrets.
USER node
CMD ["node", "--version"]
