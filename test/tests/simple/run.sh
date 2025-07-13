#!/bin/bash -e

source test/init.sh

client load --path test/graphs/graph.proto.txt
client config
client state
client run-ready
client wait --id 0
client run-ready
client run-ready
client wait --id 1
client wait --id 2
