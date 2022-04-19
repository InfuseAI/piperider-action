#!/bin/bash -l

env
pushd /usr/src/github-action && /root/.nvm/versions/node/v16.13.0/bin/node index.js && popd
eval piperider-cli run $1 