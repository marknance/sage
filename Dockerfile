# Stage 1: Build client
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Build server
FROM node:20-alpine AS server-build
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# Stage 3: Production
FROM node:20-alpine
WORKDIR /app

# Copy compiled server and production deps
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

COPY --from=server-build /app/server/dist ./server/dist

# Copy built client into server's public directory
COPY --from=client-build /app/client/dist ./server/public

# Create data and uploads directories
RUN mkdir -p ./server/data ./server/data/uploads

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

VOLUME ["/app/server/data"]

WORKDIR /app/server
CMD ["node", "dist/index.js"]
