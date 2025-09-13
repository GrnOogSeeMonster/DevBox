FROM node:20-bullseye-slim
WORKDIR /app
COPY package.json package-lock.json* ./
RUN corepack enable && (npm ci || npm install --legacy-peer-deps)
COPY . /app
EXPOSE 3001
ENV PORT=3001 HOST=0.0.0.0
CMD ["npm", "run", "dev"]
