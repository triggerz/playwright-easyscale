FROM mcr.microsoft.com/playwright:v1.48.2-focal

WORKDIR /app

# Copy shared utilities first
COPY shared /app/shared
WORKDIR /app/shared
RUN npm install

# Copy worker
WORKDIR /app/worker
COPY worker/package*.json ./

# Remove the shared package reference and install other dependencies
RUN npm pkg delete dependencies.@playwright-easyscale/shared && \
    npm install

# Link the shared package after installation
RUN npm link ../shared

# Copy worker files
COPY worker/tests ./tests
COPY worker/helpers ./helpers
COPY worker/playwright.config.js ./
COPY worker/index.js ./
COPY worker/upload-results.js ./
COPY worker/state-manager.js ./

# Create test-results directory structure for screenshots
RUN mkdir -p test-results/screenshots

# Run centralized worker service
CMD ["npm", "start"]
