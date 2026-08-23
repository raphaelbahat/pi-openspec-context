FROM node:22-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src
COPY tsconfig.build.json tsconfig.json ./
COPY eslint.config.js ./

# Build the extension
RUN npm run build

# Copy docker test directory
COPY docker/test-e2e.ts ./docker/

# Create openspec mock script for testing environments
RUN mkdir -p /usr/local/bin && \
    echo '#!/bin/bash\n\
echo "Mock OpenSpec CLI v1.0"\n\
exit 0' > /usr/local/bin/openspec && \
    chmod +x /usr/local/bin/openspec

# Set node path for module resolution
ENV NODE_PATH=/app/node_modules

# Default command
CMD ["npm", "run", "test:e2e"]
