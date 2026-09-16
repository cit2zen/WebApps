# Railway 정적 서빙 — nginx 공식 이미지의 /etc/nginx/templates envsubst로 ${PORT} 치환
FROM nginx:alpine
COPY default.conf.template /etc/nginx/templates/default.conf.template
COPY . /usr/share/nginx/html
RUN rm -f /usr/share/nginx/html/Dockerfile /usr/share/nginx/html/default.conf.template
ENV PORT=80
