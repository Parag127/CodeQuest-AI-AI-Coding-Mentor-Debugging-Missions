# ==========================================
# Production Dockerfile for Backend API
# ==========================================
FROM node:20-alpine AS base

# Set working directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV IS_DOCKER=true
ENV PORT=5000

# Install dependencies with caching layer
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force

# Copy application source code
COPY src/ ./src/

# Use unprivileged user for enhanced security
USER node

# Expose backend port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Start the application
CMD ["node", "src/index.js"]
