# Stage 1: Build
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build -- --configuration production

# Stage 2: Serve
FROM nginx:1.29-alpine AS runtime

# Remove default nginx config and add our own
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built Angular app
COPY --from=build /app/dist/teams-tab/browser /usr/share/nginx/html

# Azure Container Apps uses port 80 by default
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
