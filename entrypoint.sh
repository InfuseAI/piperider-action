#!/bin/bash -l
set -o pipefail

export GITHUB_ACTION_URL="https://github.com/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"

uuid=$(uuidgen -n @oid -N "${GITHUB_REPOSITORY}" --sha1 | tr -d "-")
sed -i "s/^user_id: .*$/user_id: ${uuid}/" ${GITHUB_WORKSPACE}/.piperider/profile.yml

if [ -f ${GITHUB_WORKSPACE}/requirements.txt ]; then
    pip install --no-cache-dir -r ${GITHUB_WORKSPACE}/requirements.txt
fi

piperider run --no-interaction --dbt-test | tee output.log ; rc=$?

log=$(cat output.log)
echo "::set-output name=analysis::${log}"
echo "::set-output name=status::${rc}"
echo "::set-output name=uuid::${uuid}"

pushd /usr/src/github-action
/root/.nvm/versions/node/v16.13.0/bin/node index.js $rc || exit $?
popd
