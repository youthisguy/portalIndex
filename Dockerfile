# PortalIndex hosted image: ingester + PostgREST in one container.
ARG POSTGREST_TAG=latest
FROM postgrest/postgrest:${POSTGREST_TAG} AS pgrst

FROM node:20-slim
WORKDIR /app
COPY --from=pgrst /bin/postgrest /usr/local/bin/postgrest
COPY package.json package-lock.json ./
RUN npm ci
COPY src ./src
COPY sql ./sql
COPY scripts ./scripts
COPY start.sh ./start.sh
RUN chmod +x start.sh
ENV NODE_ENV=production
CMD ["./start.sh"]
