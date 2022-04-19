const fs = require('fs');
const github = require('@actions/github');
const context = github.context;
const core = require('@actions/core');

const {GITHUB_TOKEN} = process.env;
const {GITHUB_EVENT_PATH} = process.env;

function isFileExists(path) {
  try {
    fs.accessSync(path, fs.constants.F_OK);
    return true;
  } catch (e) {
    return false;
  }
}

async function run () {
  const octokit = github.getOctokit(GITHUB_TOKEN);
  const event = (isFileExists(GITHUB_EVENT_PATH)) ? require(GITHUB_EVENT_PATH) : null;

  if (event === null) {
    core.warning('GitHub Action is not triggered by event');
    return;
  }
  if (event.pull_request) {
    // Action triggered by pull request
    core.debug(`GitHub Action triggered by pull request #${event.pull_request.number}`);
    const prNumber = event.pull_request.number;
    const {data: comment} = await octokit.rest.issues.createComment({
      ...context.repo,
      issue_number: prNumber,
      body: 'Hello World!'
    });
    core.debug(data.comment);
  }

  // TODO: Write the output to GitHub action annotation
  core.debug(`GitHub: ${JSON.stringify(context)}`);
  core.debug(`Running action: ${JSON.stringify(event)}`);
}

run();