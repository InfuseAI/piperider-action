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
  const returnCode = argv[0] || '0';
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
  const artifactName = 'piperider-cli-test-report';
  const reportFiles = fs.readdirSync(GITHUB_WORKSPACE).filter(file => file.endsWith('.json'))
  const options = {
    continueOnError: true
  };
  core.debug(`Uploading artifacts: ${reportFiles}`);
  const uploadResult = await artifactClient.uploadArtifact(
    artifactName,
    reportFiles.map(file => path.join(GITHUB_WORKSPACE, file)),
    GITHUB_WORKSPACE,
    options);
  core.debug(`Upload result: ${JSON.stringify(uploadResult)}`);

  // Write the output to GitHub action annotation
  core.debug(`GitHub: ${JSON.stringify(context)}`);
  core.debug(`Running action: ${JSON.stringify(event)}`);

  const totalStages = reportFiles.filter(f => f.endsWith('.json')).filter(f => !f.endsWith('_ydata.json')).filter(f => f !== 'aggregated-reports.json').length;
  const successStages = reportFiles.filter(f => f.endsWith('.json')).filter(f => f.endsWith('_ydata.json'));
  if (successStages.length === 0) {
    core.error('No successful stages found');
  } else if (totalStages.length > successStages.length) {
    core.warning(`${successStages.length}/${totalStages.length} stages are successful`);
  } else {
    core.notice(`${successStages.length}/${totalStages.length} stages are successful`);
  }

  exit(returnCode);
}

const argv = process.argv.slice(2);
run(argv);