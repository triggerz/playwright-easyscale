FROM mcr.microsoft.com/playwright:v1.48.2-focal

WORKDIR /app

# Copy shared utilities first
COPY shared /app/shared
WORKDIR /app/shared
RUN npm install

# Copy worker
WORKDIR /app/worker
COPY worker/package*.json ./

# Link the shared package instead of installing from npm
RUN npm install --omit=optional && \
    npm link ../shared

# Copy worker files
COPY worker/tests ./tests
COPY worker/helpers ./helpers
COPY worker/playwright.config.js ./
COPY worker/upload-results.js ./

# Run tests
CMD ["npm", "test"]
