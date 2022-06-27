#!/bin/bash -l
set -o pipefail

export GITHUB_ACTION_URL="https://github.com/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"

if [ -f ${GITHUB_WORKSPACE}/requirements.txt ]; then
    pip install --no-cache-dir -r ${GITHUB_WORKSPACE}/requirements.txt
fi

piperider run --no-interaction | tee output.log ; rc=$?

log=$(cat output.log)
echo "::set-output name=analysis::${log}"
echo "::set-output name=status::${rc}"

pushd /usr/src/github-action
/root/.nvm/versions/node/v16.13.0/bin/node index.js $rc || exit $?
popd
