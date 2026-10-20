FROM coturn/coturn:4.18.0-r0
COPY docker/turnserver.conf /etc/coturn/turnserver.conf
COPY docker/turn-addresses.sh /usr/local/bin/luma-turn-addresses.sh
COPY docker/turn-entrypoint.sh /usr/local/bin/luma-turn-entrypoint.sh
ENTRYPOINT ["/bin/sh", "/usr/local/bin/luma-turn-entrypoint.sh"]
