# 1 - build the base
FROM node:18-alpine AS base
WORKDIR /app
COPY src ./src
COPY package*.json ./ 
COPY tsconfig*.json ./
RUN npm install

# 2 - build the actual app
FROM base AS build
WORKDIR /app
RUN npm run build

# 3 - starting up the app in production
FROM node:18-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY --from=build /app/build ./
CMD ["node", "main.js"]
