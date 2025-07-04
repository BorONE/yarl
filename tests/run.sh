#!/bin/bash -e

ok=OK

if [[ "$1" == "canonize" ]]; then
    mode="canonize"
    ok="Canonized"
    shift
fi

if [[ $# == 0 ]]; then
    tests=tests/*/
else
    for label in $@; do
        tests="$tests tests/$@/"
    done
fi

for test in $tests; do
    label=$(echo $test | sed 's|.*/\(.*\)/|\1|')
    echo -e "\033[1mTEST\t\033[0m$label"
    if $test/run.sh $mode; then
        echo -e "\t\t\033[1;032m$ok\033[0m"
    else
        echo -e "\t\t\033[1;031mFailed\033[0m"
    fi
done
