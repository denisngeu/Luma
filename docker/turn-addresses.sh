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
    # Read hostname output as data, with pathname expansion disabled.
    (
        set -f
        for turn_address in $1; do
            if turn_valid_ipv4 "$turn_address"; then
                printf '%s\n' "$turn_address"
                exit 0
            fi
        done
        exit 1
    )
}
