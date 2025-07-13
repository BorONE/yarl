#!/bin/bash -e

source test/init.sh
trap 'finish-test' EXIT

client load --path test/graphs/empty.proto.txt
client config
client state
client add --node-config 'Job:{[type.googleapis.com/register.ShellScriptConfig]:{}}'
client add --node-config 'Job:{[type.googleapis.com/register.ShellScriptConfig]:{Path:"test/data/b.sh"}}'
client add --node-config 'Job:{[type.googleapis.com/register.ShellScriptConfig]:{Path:"test/data/c.sh"}}'
client config
client state
client edit --node-config 'Id:0;Job:{[type.googleapis.com/register.ShellScriptConfig]:{Path:"test/data/a.sh"}}'
client connect --id 0 --id2 1
client connect --id 0 --id2 2
client connect --id 2 --id2 1
client delete --id 2
client config
client state
