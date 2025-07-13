
function rm_ts {
    date_re='[0-9]*/[0-9]*/[0-9]*'
    time_re='[0-9]*:[0-9]*:[0-9]*'
    sed "s#$date_re $time_re ##"
}

function stabilize_prototext {
    sed "s/:  /: /" | sed "s/\([^ ]\)  \([^ ]\)/\1 \2/g"
}

function client {
    cmd=(go run cmd/client/main.go --cmd "$@")
    echo "$ ${cmd[@]}" >> $output/client

    "${cmd[@]}" 2>&1 | rm_ts | stabilize_prototext >> $output/client
    return ${PIPESTATUS[0]}
}

output=$(dirname $0)/output
canon=$(dirname $0)/canon
rm -rf $output
mkdir -p $output

go run cmd/server/main.go $SERVER_ARGS 2>&1 | rm_ts | stabilize_prototext > $output/server &
while ! lsof -i :9000 &> /dev/null; do
    true
done
pid=$(lsof -i :9000 | tail -1 | awk '{print $2}')
trap 'kill $pid &> /dev/null || true' EXIT

> $output/client

function finish-test {
    kill $pid
    wait
    exit 0
}
