#!/bin/bash -e
touch config
source config

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
echo $PID > pid

while ! status; do
  if ! ps -p $PID &> /dev/null; then
    exit 1
  fi
done
