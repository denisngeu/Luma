#!/bin/sh
set -eu
. "${1:-./docker/turn-addresses.sh}"

for turn_input in 179.61.190.83 10.0.3.2 172.18.0.4 192.168.1.3; do
    turn_valid_ipv4 "$turn_input" || exit 1
done
for turn_input in '' ::1 fd83:7c7a:8110::6 0.0.0.0 0.1.2.3 127.0.0.1 \
    169.254.169.254 224.0.0.1 255.255.255.255 256.1.1.1 1.2.3 \
    1.2.3.4.5 01.2.3.4 '1.2.3.4;exit 0' '$(exit 0)' '-c' '1.2.3.4
5.6.7.8'; do
    if turn_valid_ipv4 "$turn_input"; then
        printf '%s\n' 'FAIL: accepted an invalid address' >&2
        exit 1
    fi
done
[ "$(turn_select_ipv4 'fd83:7c7a:8110::6 10.0.3.2 10.0.1.6')" = '10.0.3.2' ]
[ "$(turn_select_ipv4 '127.0.0.1 169.254.169.254 172.18.0.4')" = '172.18.0.4' ]
if turn_select_ipv4 '::1 fd83:7c7a:8110::6 0.0.0.0 224.0.0.1'; then
    printf '%s\n' 'FAIL: selected an unusable relay address' >&2
    exit 1
fi
printf '%s\n' 'PASS TURN_ADDRESS_SELECTION_AND_REJECTION'
