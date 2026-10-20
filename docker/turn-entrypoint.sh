#!/bin/sh
set -eu

. /usr/local/bin/luma-turn-addresses.sh

turn_public=${LUMA_TURN_PUBLIC_IP:?Configure LUMA_TURN_PUBLIC_IP}
if ! turn_valid_ipv4 "$turn_public"; then
    printf '%s\n' 'TURN: invalid public IPv4 address' >&2
    exit 1
fi
turn_local=$(turn_select_ipv4 "$(hostname -I)") || {
    printf '%s\n' 'TURN: no usable container IPv4 address' >&2
    exit 1
}

# An explicit mapping makes Coturn allow only its own relay address through
# the private-peer deny ranges, so two relayed participants can communicate.
# Keep the original arguments literal, including the authentication secret.
exec /usr/bin/turnserver "$@" "--relay-ip=$turn_local" "--external-ip=$turn_public/$turn_local"
