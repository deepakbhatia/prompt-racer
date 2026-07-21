# syntax=docker/dockerfile:1
ARG NODE_IMAGE
FROM ${NODE_IMAGE}

WORKDIR /work
ENV NODE_ENV=production \
    HOME=/tmp

# HTTP challenge processes receive only this runtime and the mounted attempt.
USER node
CMD ["node", "--version"]
