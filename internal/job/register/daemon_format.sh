#!/bin/bash -e

touch init
source init

function run {
  %s
}
function status {
  %s
}
function shutdown {
  %s
}

if status; then
  shutdown
fi

touch stdin
run < stdin 1> stdout 2> stderr &

PID=$!
CWD=$(pwd)

echo PID=$PID > info
echo STDIN="$CWD/stdin" >> info
echo STDOUT="$CWD/stdout" >> info
echo STDERR="$CWD/stderr" >> info

while ! status; do
  if ! ps -p $PID &> /dev/null; then
    exit 1
  fi
done
