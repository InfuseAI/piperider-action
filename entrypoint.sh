#!/bin/bash -l

env
/root/.nvm/versions/node/v16.13.0/bin/node index.js
eval piperider-cli run $1 