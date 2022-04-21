const fs = require('fs');
const path = require('path');
const core = require('@actions/core');
const artifact = require('@actions/artifact');
const github = require('@actions/github');

const context = github.context;
const { exit } = require('process');

const {GITHUB_TOKEN} = process.env;
const {GITHUB_EVENT_PATH} = process.env;
const {GITHUB_WORKSPACE} = process.env;

function isFileExists(path) {
  try {
    fs.accessSync(path, fs.constants.F_OK);
    return true;
  } catch (e) {
    return false;
  }
}

function getPipeRiderOutputLog() {
  const outputLog = `${GITHUB_WORKSPACE}/output.log`;
  if (isFileExists(outputLog)) {
    return fs.readFileSync(outputLog, 'utf8');
  }
  return '';
}

function generateGitHubPullRequestComment(returnCode) {
  const colorCodeRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
  const outputLog = getPipeRiderOutputLog().replace(colorCodeRegex, '');
  const status = (returnCode === '0') ? 'Success' : 'Failure';
  return `
# PipeRider CLI Report
> Test Result: ${status}
\`\`\`
${outputLog}
\`\`\`
`;
}

async function run (argv) {
  const returnCode = argv[1] || '0';
  const octokit = github.getOctokit(GITHUB_TOKEN);
  const event = (isFileExists(GITHUB_EVENT_PATH)) ? require(GITHUB_EVENT_PATH) : null;

  core.debug(`PipeRider return code: ${returnCode}`);
  if (event === null) {
    core.warning('GitHub Action is not triggered by event');
    return;
  }

  if (event.pull_request) {
    // Action triggered by pull request
    core.debug(`GitHub Action triggered by pull request #${event.pull_request.number}`);
    const prNumber = event.pull_request.number;
    await octokit.rest.issues.createComment({
      ...context.repo,
      issue_number: prNumber,
      body: generateGitHubPullRequestComment(returnCode)
    });
  }

  // Upload artifacts
  const artifactClient = artifact.create();
  const artifactName = 'test-report';
  const reportFiles = fs.readdirSync(GITHUB_WORKSPACE).filter(file => file.endsWith('.json')).map(file => path.join(GITHUB_WORKSPACE, file));
  const options = {
    continueOnError: true
  };
  core.debug(`Uploading artifacts: ${reportFiles}`);
  const uploadResult = await artifactClient.uploadArtifact(artifactName, reportFiles, GITHUB_WORKSPACE, options);
  core.debug(`Upload result: ${JSON.stringify(uploadResult)}`);

  // TODO: Write the output to GitHub action annotation
  core.debug(`GitHub: ${JSON.stringify(context)}`);
  core.debug(`Running action: ${JSON.stringify(event)}`);

  core.notice('PipeRider CLI Test Report');
  core.warning('Test for warning annotation');
  core.error('Test for error annotation');

  exit(returnCode);
}

const argv = process.argv.slice(2);
run(argv);