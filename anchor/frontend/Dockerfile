# Stage 1 — build Flutter web
FROM ghcr.io/cirruslabs/flutter:stable AS build

WORKDIR /app
COPY pubspec.yaml ./
RUN flutter pub get

COPY . .
RUN flutter build web --release --base-href /

# Stage 2 — serve with nginx
FROM nginx:1.27-alpine

COPY --from=build /app/build/web /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
