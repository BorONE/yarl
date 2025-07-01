
function rm_ts {
    date_re='[0-9]*/[0-9]*/[0-9]*'
    time_re='[0-9]*:[0-9]*:[0-9]*'
    sed "s#$date_re $time_re ##"
}

function client {
    cmd="go run client/main.go --cmd $@"
    echo "$ ${cmd}" >> $output/client

    $cmd 2>&1 | rm_ts >> $output/client
    return ${PIPESTATUS[0]}
}


output=$(dirname $0)/output
canon=$(dirname $0)/canon
rm -rf $output
mkdir -p $output

go run main.go $SERVER_ARGS 2>&1 | rm_ts > $output/server &
while ! lsof -i :9000 &> /dev/null; do
    true
done
pid=$(lsof -i :9000 | tail -1 | awk '{print $2}')
trap 'kill $pid &> /dev/null || true' EXIT

> $output/client

function test-check {
    kill $pid
    wait

    diff $output $canon && rm -rf $output
}

function test-canonize {
    kill $pid
    wait

    rm -rf $canon
    mv $output $canon
}
