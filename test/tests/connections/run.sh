#!/bin/bash -e

source test/init.sh
trap 'finish-test' EXIT

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

client reset --id 2
client run-ready
client wait --id 2
client run-ready
client wait --id 1
client run-ready

client disconnect --id 2 --id2 1
client reset --id 2
client run-ready
client wait --id 2
client run-ready
