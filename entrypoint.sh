#!/bin/bash -l
set -o pipefail

eval "piperider-cli run $1" | tee output.log ; rc=$?
echo "pireader-cli run $1 => $rc"

pushd /usr/src/github-action
/root/.nvm/versions/node/v16.13.0/bin/node index.js $rc || exit $?
popd
