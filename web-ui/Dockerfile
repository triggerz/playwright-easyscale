FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY web-ui/package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY web-ui/ .

# Expose port
EXPOSE 5173

# Run in dev mode (reads env vars at runtime, just like orchestrator)
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
