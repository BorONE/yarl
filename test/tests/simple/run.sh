#!/bin/bash -e

SERVER_ARGS='--config test/graphs/graph.proto.txt'

source test/lib.sh

client config
client state
client run-ready
client wait --id 0
client run-ready
client run-ready
client wait --id 1
client wait --id 2

if [[ $1 == canonize ]]; then
    test-canonize
else
    test-check
fi
