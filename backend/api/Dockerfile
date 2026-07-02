# ═══════════════════════════════════════════════════════════════════
# 🔌 GlassClass API Server - Dockerfile
# ═══════════════════════════════════════════════════════════════════
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy source code
COPY . .

# Create directories for data and uploads
RUN mkdir -p /app/data /app/uploads

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3002/health || exit 1

# Start server
CMD ["node", "server.js"]
