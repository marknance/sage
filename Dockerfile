# Stage 1: Build client
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Production server
FROM node:20-alpine
WORKDIR /app

# Copy server source and install production deps
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

COPY server/ ./server/

# Copy built client into server's public directory
COPY --from=client-build /app/client/dist ./server/public

# Create data directory
RUN mkdir -p ./server/data

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

VOLUME ["/app/server/data"]

WORKDIR /app/server
CMD ["node", "--import", "tsx", "src/index.ts"]
