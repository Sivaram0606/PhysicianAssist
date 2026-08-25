# Build stage
FROM node:24-alpine AS build

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Declare build argument for Vite API URL
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Build the application
RUN npm run build

# Production stage
FROM nginx:stable-alpine

# Copy the build output to replace the default nginx contents
COPY --from=build /app/dist /usr/share/nginx/html

# Create a custom nginx configuration to listen on port 3000 and handle SPA routing
# and proxy API requests to the backend container
ARG BACKEND_SCHEME=https
ARG BACKEND_HOST=clinical-survey-intelligence-backend-670355418182.us-central1.run.app
RUN printf 'server {\n\
    listen 3000;\n\
    keepalive_timeout 600s;\n\
    location / {\n\
        root /usr/share/nginx/html;\n\
        index index.html index.htm;\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
    location /api/ {\n\
        proxy_pass %s://%s/api/;\n\
        proxy_ssl_server_name on;\n\
        proxy_set_header Host %s;\n\
        proxy_set_header X-Real-IP $remote_addr;\n\
        proxy_read_timeout 600s;\n\
        proxy_connect_timeout 600s;\n\
        proxy_send_timeout 600s;\n\
    }\n\
    location /api-proxy {\n\
        proxy_pass %s://%s/api-proxy;\n\
        proxy_ssl_server_name on;\n\
        proxy_set_header Host %s;\n\
        proxy_set_header X-Real-IP $remote_addr;\n\
        proxy_read_timeout 600s;\n\
        proxy_connect_timeout 600s;\n\
        proxy_send_timeout 600s;\n\
    }\n\
}\n' "$BACKEND_SCHEME" "$BACKEND_HOST" "$BACKEND_HOST" "$BACKEND_SCHEME" "$BACKEND_HOST" "$BACKEND_HOST" > /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]

