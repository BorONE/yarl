#!/bin/bash -e

SERVER_ARGS='--config empty_graph.proto.txt'

source tests/lib.sh

client config
client state
client add --node-config 'Job{ShellScript{}}'
client add --node-config 'Job{ShellScript{Path:"example/b.sh"}}'
client add --node-config 'Job{ShellScript{Path:"example/c.sh"}}'
client config
client state
client edit --node-config 'Id:0;Job{ShellScript{Path:"example/a.sh"}}'
client connect --id 0 --id2 1
client connect --id 0 --id2 2
client connect --id 2 --id2 1
client delete --id 2
client config
client state

if [[ $1 == canonize ]]; then
    test-canonize
else
    test-check
fi
