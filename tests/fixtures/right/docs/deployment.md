# Deployment Guide

## Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
CMD ["node", "dist/index.js"]
```

## Environment Variables

| Variable   | Default       | Description          |
|-----------|---------------|----------------------|
| NODE_ENV  | development   | Runtime environment  |
| PORT      | 3000          | Server port          |
| DEBUG     | false         | Enable debug mode    |
