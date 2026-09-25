FROM coturn/coturn:4.18.0-r0
COPY docker/turnserver.conf /etc/coturn/turnserver.conf
