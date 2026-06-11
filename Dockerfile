# games.cityzen.kr — 정적 게임 통합 서빙 (허브 index.html + 게임 폴더들)
FROM nginx:alpine
COPY default.conf.template /etc/nginx/templates/default.conf.template
COPY . /usr/share/nginx/html
RUN rm -f /usr/share/nginx/html/default.conf.template
ENV PORT=80
