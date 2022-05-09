#!/bin/bash -l
set -o pipefail

GITHUB_ACTION_URL="https://github.com/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"
export PIPERIDER_SERVICE_URL=https://api.piperider.io/v1

eval "piperider-cli run $1 --metadata external_url=${GITHUB_ACTION_URL}" | tee output.log ; rc=$?

pushd /usr/src/github-action
/root/.nvm/versions/node/v16.13.0/bin/node index.js $rc || exit $?
popd
