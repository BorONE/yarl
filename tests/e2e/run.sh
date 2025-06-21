#!/bin/bash -e

function rm_ts {
    date_re='[0-9]*/[0-9]*/[0-9]*'
    time_re='[0-9]*:[0-9]*:[0-9]*'
    sed "s#$date_re $time_re ##"
}

function client {
    cmd="go run client/main.go --cmd $@"
    echo "$ ${cmd}" >> $output/client

    $cmd 2>&1 | rm_ts >> $output/client
    # $cmd 2>&1 | rm_ts >> $output/client
    return ${PIPESTATUS[0]}
}

output=$(dirname $0)/output
canon=$(dirname $0)/canon
rm -rf $output
mkdir -p $output

go run main.go 2>&1 | rm_ts > $output/server &
while ! lsof -i :9000 &> /dev/null; do
    true
done
pid=$(lsof -i :9000 | tail -1 | awk '{print $2}')
trap 'kill $pid' EXIT

> $output/client
client state
client run-ready
client wait --id 0
client run-ready
client run-ready
client wait --id 1
client wait --id 2

if [[ $1 == canonize ]]; then
    rm -rf $canon
    cp -r $output $canon
    rm -rf $output
else
    diff $output $canon && rm -rf $output
fi
