#!/bin/bash -e

source test/init.sh
trap 'finish-test' EXIT

client new
client add --node-config 'Job:{[type.googleapis.com/register.ShellScriptConfig]:{}}'
client add --node-config 'Job:{[type.googleapis.com/register.ShellScriptConfig]:{Path:"test/data/b.sh"}}'
client edit --node-config 'Id:0;Job:{[type.googleapis.com/register.ShellScriptConfig]:{Path:"test/data/a.sh"}}'
client connect --id 0 --id2 1
client save --path $OUTPUTDIR/graph.proto.txt
client new
client config
client load --path $OUTPUTDIR/graph.proto.txt
client config

temp=$(mktemp)
cat $OUTPUTDIR/graph.proto.txt | stabilize_prototext > $temp
mv $temp $OUTPUTDIR/graph.proto.txt
