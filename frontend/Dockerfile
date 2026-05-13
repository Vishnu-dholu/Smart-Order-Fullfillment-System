# syntax=docker/dockerfile:1.7
FROM node:20.19.1-alpine3.21 AS build
WORKDIR /app

# Declare build-time env vars so Vite can bake them into the JS bundle
# Default to empty string so Vite uses relative paths (/api/...) which work
# correctly behind the K8s Ingress. Override only for local docker-compose runs.
ARG VITE_API_GATEWAY_URL=
ENV VITE_API_GATEWAY_URL=$VITE_API_GATEWAY_URL

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27.4-alpine
WORKDIR /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
ENTRYPOINT ["nginx", "-g", "daemon off;"]
