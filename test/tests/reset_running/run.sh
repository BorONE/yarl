#!/bin/bash -e

source test/lib.sh

client new
client add --node-config 'Job:{[type.googleapis.com/register.ShellCommandConfig]:{Command:"echo \"hello world\""}}'
client add --node-config 'Job:{[type.googleapis.com/register.ShellCommandConfig]:{Command:"echo \"sleeping...\" ; sleep 5 ; echo \"done\""}}'
client connect --id 0 --id2 1
client run-ready
client wait --id 0
client run-ready
sleep 1
client reset 0
client wait --id 1

if [[ $1 == canonize ]]; then
    test-canonize
else
    test-check
fi
