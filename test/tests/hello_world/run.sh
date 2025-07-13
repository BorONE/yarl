#!/bin/bash -e

source test/lib.sh

client new
client add --node-config 'Job:{[type.googleapis.com/register.ShellCommandConfig]:{Command:"echo hello world"}}'
client run-ready
client wait --id 0
client run-ready

if [[ $1 == canonize ]]; then
    test-canonize
else
    test-check
fi
