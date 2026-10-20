# POSIX shell helpers. Never evaluate address or credential values as shell code.
turn_valid_ipv4() {
    printf '%s\n' "$1" | awk -F. '
        NF != 4 { exit 1 }
        {
            for (i = 1; i <= 4; i++) {
                if ($i !~ /^[0-9]+$/ || length($i) > 3 ||
                    (length($i) > 1 && substr($i, 1, 1) == "0") || $i > 255) exit 1
            }
            if ($1 == 0 || $1 == 127 || $1 >= 224 ||
                ($1 == 169 && $2 == 254)) exit 1
        }
        END { if (NR != 1) exit 1 }
    '
}

turn_select_ipv4() {
    # hostname -I order is unrelated to Docker's published-port interface.
    # Match a local address to a connected route on the default interface.
    (
        set -f
        turn_addresses=''
        for turn_address in $1; do
            if turn_valid_ipv4 "$turn_address"; then
                turn_addresses="$turn_addresses $turn_address"
            fi
        done
        printf '%s\n' "$2" | awk -v addresses="$turn_addresses" '
            function byte(pair, digits) {
                digits = "0123456789ABCDEF"
                return (index(digits, substr(toupper(pair), 1, 1)) - 1) * 16 + index(digits, substr(toupper(pair), 2, 1)) - 1
            }
            $2 == "00000000" && $3 != "00000000" {
                if (!iface || $7 + 0 < metric) { iface = $1; metric = $7 + 0 }
            }
            $3 == "00000000" && $2 != "00000000" {
                count++; interfaces[count] = $1; networks[count] = $2; masks[count] = $8
            }
            END {
                if (!iface) exit 1
                size = split(addresses, locals, " ")
                for (i = 1; i <= size; i++) {
                    split(locals[i], octets, ".")
                    for (r = 1; r <= count; r++) {
                        if (interfaces[r] != iface) continue
                        matches = 1
                        for (k = 1; k <= 4; k++) {
                            step = 256 - byte(substr(masks[r], 9 - 2 * k, 2))
                            if (int(octets[k] / step) * step != byte(substr(networks[r], 9 - 2 * k, 2))) matches = 0
                        }
                        if (matches) { print locals[i]; exit 0 }
                    }
                }
                exit 1
            }
        '
    )
}
