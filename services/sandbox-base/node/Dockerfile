FROM node:20-bullseye-slim

RUN corepack enable && \
    usermod -d /home/node node && \
    mkdir -p /workspace && chown -R node:node /workspace

USER node
WORKDIR /workspace

CMD ["sleep", "infinity"]
