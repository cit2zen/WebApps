FROM nginx:1.27-alpine
COPY index.html design-tokens.css typography.css polaroid.css /usr/share/nginx/html/
COPY default.conf.template /etc/nginx/templates/default.conf.template
# nginx 이미지 엔트리포인트가 ${PORT}만 치환(정의된 env만) → $uri 등은 보존.
# Railway가 주입하는 $PORT로 리슨.
