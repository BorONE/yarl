#!/bin/bash -e

source test/init.sh
trap 'finish-test' EXIT

client new
client add --node-config 'Job:{[type.googleapis.com/register.ShellCommandConfig]:{Command:"echo hello world"}}'
client run-ready
client wait --id 0
client run-ready
