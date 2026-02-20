# ============================================================================
# PRINTCLOUD FRONTEND DOCKERFILE
# ============================================================================
# This file defines how to build a Docker container for the Next.js frontend.
# It uses a multi-stage build to create both development and production images.
#
# Next.js is a React framework that can run in two modes:
# - Development: Hot-reload, detailed error messages, debugging tools
# - Production: Optimized builds, faster performance, smaller size
# ============================================================================

# ============================================================================
# STAGE 1: BASE IMAGE FOR DEPENDENCIES
# ============================================================================
# Node.js 20 LTS (Long Term Support) - stable and well-supported
# Alpine variant is a minimal Linux distribution (much smaller image size)
FROM node:20-alpine AS base

# Set working directory
WORKDIR /app

# Copy package files first (Docker caching optimization)
# If these files don't change, Docker can reuse the next layer
COPY package*.json ./

# ============================================================================
# STAGE 2: DEVELOPMENT IMAGE
# ============================================================================
FROM base AS development

# Install ALL dependencies (including devDependencies)
# devDependencies include tools needed for development (linters, etc.)
RUN npm install

# The source code will be mounted as a volume in docker-compose.yml
# This enables hot-reload: changes you make appear instantly!

# Expose port 3000 (Next.js development server default)
EXPOSE 3000

# Start Next.js in development mode
# This provides hot-reload and detailed error messages
CMD ["npm", "run", "dev"]

# ============================================================================
# STAGE 3: BUILD STAGE FOR PRODUCTION
# ============================================================================
# This stage creates the optimized production build
FROM base AS builder

# Install ALL dependencies (needed for building)
RUN npm install

# Copy all source code
COPY . .

# Set environment variable for production build
# This tells Next.js to create an optimized production build
ENV NODE_ENV=production

# Build the Next.js application
# This compiles, optimizes, and bundles the application
# Output goes to .next directory
RUN npm run build

# ============================================================================
# STAGE 4: PRODUCTION IMAGE
# ============================================================================
# This is the final, minimal production image
# It only contains what's needed to run the app (not build it)
FROM node:20-alpine AS production

# Set working directory
WORKDIR /app

# Set environment to production
ENV NODE_ENV=production

# Create a non-root user for security
# Running as root is a security risk
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy package files and install ONLY production dependencies
# --omit=dev skips devDependencies (smaller image)
COPY package*.json ./
RUN npm install --omit=dev

# Copy the built application from builder stage
# We only copy what's needed to run, not the source code
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./

# Create a next.config.js if only .ts exists (for runtime compatibility)
# Some production environments need .js instead of .ts
RUN if [ -f next.config.ts ] && [ ! -f next.config.js ]; then \
    echo "module.exports = require('./next.config.ts');" > next.config.js; \
    fi

# Switch to non-root user
USER nextjs

# Expose port 3000
EXPOSE 3000

# Start Next.js in production mode
# This serves the optimized, pre-built application
CMD ["npm", "start"]
