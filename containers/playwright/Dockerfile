# syntax=docker/dockerfile:1
# Use a pinned Playwright base image supplied by CI.
ARG PLAYWRIGHT_IMAGE
FROM ${PLAYWRIGHT_IMAGE}

WORKDIR /work
ENV NODE_ENV=production \
    HOME=/tmp

# This image is reserved for the separate private acceptance worker.
USER pwuser
CMD ["node", "--version"]
