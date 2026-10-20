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
turn_routes='Iface Destination Gateway Flags RefCnt Use Metric Mask
eth1 00000000 0101000A 0003 0 0 0 00000000
eth1 0001000A 00000000 0001 0 0 0 00FFFFFF
eth0 0003000A 00000000 0001 0 0 0 00FFFFFF'
[ "$(turn_select_ipv4 'fd83:7c7a:8110::6 10.0.3.4 10.0.1.8' "$turn_routes")" = '10.0.1.8' ]
[ "$(turn_select_ipv4 '10.0.1.8 10.0.3.4' "$turn_routes")" = '10.0.1.8' ]
if turn_select_ipv4 '10.0.3.4' "$turn_routes"; then
    printf '%s\n' 'FAIL: selected the wrong published-port network' >&2
    exit 1
fi
if turn_select_ipv4 '10.0.1.8' ''; then
    printf '%s\n' 'FAIL: silently fell back without a default route' >&2
    exit 1
fi
if turn_select_ipv4 '::1 fd83:7c7a:8110::6 0.0.0.0 224.0.0.1' "$turn_routes"; then
    printf '%s\n' 'FAIL: selected an unusable relay address' >&2
    exit 1
fi
printf '%s\n' 'PASS TURN_ADDRESS_SELECTION_AND_REJECTION'
