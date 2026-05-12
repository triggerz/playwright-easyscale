FROM node:20-alpine

WORKDIR /app

# Copy shared utilities first
COPY shared /app/shared
WORKDIR /app/shared
RUN npm install --production

# Copy orchestrator
WORKDIR /app/orchestrator
COPY orchestrator/package*.json ./
RUN npm install --production

# Copy orchestrator source code
COPY orchestrator/src ./src

# Copy worker tests so orchestrator can scan them
COPY worker/tests /app/worker/tests

# Expose port
EXPOSE 3000

# Start the server
CMD ["node", "src/api/server.js"]
