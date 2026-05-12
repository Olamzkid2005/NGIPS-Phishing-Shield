FROM node:20-alpine

WORKDIR /app

# Install Python and pip for ML service
RUN apk add --no-cache python3 py3-pip

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source
COPY src ./src
COPY prisma ./prisma
COPY package.json ./
COPY .env.example ./

# Generate Prisma client
RUN npx prisma generate

# Expose port
EXPOSE 8000

# Start server
CMD ["node", "src/server.js"]