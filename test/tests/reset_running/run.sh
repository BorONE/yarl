#!/bin/bash -e

source test/init.sh
trap 'finish-test' EXIT

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
