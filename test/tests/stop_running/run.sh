#!/bin/bash -e

source test/lib.sh

client new
client add --node-config 'Job:{[type.googleapis.com/register.ShellCommandConfig]:{Command:"sleep 5"}}'
client run-ready
client stop --id 0
client wait --id 0

if [[ $1 == canonize ]]; then
    test-canonize
else
    test-check
fi
