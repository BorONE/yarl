#!/bin/bash -e

source test/lib.sh

client load --path test/graphs/edgeless.proto.txt
client config
client state
client connect --id 0 --id2 1
client connect --id 0 --id2 2
client connect --id 2 --id2 1
client run-ready
client wait --id 0
client run-ready
client wait --id 2
client run-ready
client wait --id 1
client disconnect --id 2 --id2 1
client reset --id 2
client run-ready
client wait --id 2
client run-ready
client reset --id 2
client connect --id 2 --id2 1
client run-ready
client wait --id 2
client run-ready
client wait --id 1
client run-ready

if [[ $1 == canonize ]]; then
    test-canonize
else
    test-check
fi
