FROM node:18-alpine

WORKDIR /app

# Install system dependencies (if needed later for canvas/ffmpeg)
# RUN apk add --no-cache python3 make g++

COPY package*.json ./

RUN npm ci --only=production

COPY . .

# Create logs directory
RUN mkdir logs

CMD ["npm", "start"]
