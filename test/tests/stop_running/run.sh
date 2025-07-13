#!/bin/bash -e

source test/init.sh

client new
client add --node-config 'Job:{[type.googleapis.com/register.ShellCommandConfig]:{Command:"sleep 5"}}'
client run-ready
client stop --id 0
client wait --id 0
