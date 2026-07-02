FROM node:20-alpine

# Install build dependencies for mediasoup (Alpine packages)
RUN apk add --no-cache \
    python3 \
    py3-pip \
    make \
    g++ \
    linux-headers

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3001
EXPOSE 40000-40100/udp

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "server.js"]
