# V-Calm: static PWA served by unprivileged nginx (runs as non-root on :8080).
FROM nginxinc/nginx-unprivileged:1.31-alpine

LABEL org.opencontainers.image.title="V-Calm" \
      org.opencontainers.image.description="Offline-first breathing app (static PWA)" \
      org.opencontainers.image.source="https://github.com/viktorbezhenar/v-calm" \
      org.opencontainers.image.licenses="MIT"

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
# app/_headers is excluded via .dockerignore (nginx.conf carries the same headers).
COPY app/ /usr/share/nginx/html/

EXPOSE 8080
HEALTHCHECK --interval=60s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
