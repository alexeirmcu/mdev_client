FROM node:20-alpine AS build
WORKDIR /app
COPY client/package*.json client/
RUN cd client && npm ci
COPY client/ client/
RUN cd client && npm run build

FROM node:20-alpine
WORKDIR /app
COPY server/package*.json server/
RUN cd server && npm ci --omit=dev
COPY server/ server/
COPY --from=build /app/client/dist client/dist
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "server/server.js"]
