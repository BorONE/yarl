#!/bin/bash -e

color_bold="\033[1m"
color_red="\033[1;031m"
color_green="\033[1;032m"
color_reset="\033[0m"


if [[ "$1" == "canonize" ]]; then
    mode="canonize"
    shift
fi

if [[ $# == 0 ]]; then
    tests=test/tests/*
else
    for label in $@; do
        tests="$tests test/tests/$@"
    done
fi

function check-nodiff {
    canon=$1
    output=$2
    diff --color $canon $output && rm -rf $output
}

function canonize {
    canon=$1
    output=$2
    rm -rf $canon
    mv $output $canon
}

function prefix {
    label=$1
    color=$2
    echo -e "${color}$label${color_reset}"
}

for test in $tests; do
    label=$(echo $test | sed 's|test/tests/\(.*\)/|\1|')
    canon=$test/canon
    output=$test/output

    if ! OUTPUTDIR=$test/output $test/run.sh $mode; then
        prefix $label $color_red
        echo -e "\tFailed"
        exitcode=1
    fi

    if check-nodiff $canon $output; then
        prefix $label $color_green
        echo -e "\tNo diff"
    elif [[ "$mode" == canonize ]]; then
        canonize $canon $output
        prefix $label $color_green
        echo -e "\tCanonized"
    else
        prefix $label $color_red
        echo -e "\tUnexpected diff"
        exitcode=1
    fi
done

exit $exitcode
