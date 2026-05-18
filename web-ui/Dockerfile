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

# Run based on NODE_ENV
CMD if [ "$NODE_ENV" = "production" ]; then \
      npm run build && npm install -g serve && serve -s dist -l 5173; \
    else \
      npm run dev -- --host 0.0.0.0; \
    fi
