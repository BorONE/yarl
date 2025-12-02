#!/bin/bash -ex

touch prepare
source prepare

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

cat > info << EOL
PID=$PID
STDIN="$CWD/stdin"
STDOUT="$CWD/stdout"
STDERR="$CWD/stderr"
EOL

while ! status; do
  if ! ps -p $PID &> /dev/null; then
    set +x

    printf "\n\ndaemon stdout:\n"
    cat $CWD/stdout

    printf "\n\ndaemon stderr:\n" 1>&2
    cat $CWD/stderr 1>&2

    exit 1
  fi
  sleep 1
done
