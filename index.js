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
const {GITHUB_ACTION_URL} = process.env;

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
  const fetchNotationRegex = /^fetching .*'\n/gm;
  const profileNotationRegex = /^profiling .* type=.*\n/gm;
  const resultNotationRegex = /^Results .*/gm;
  const outputLog = getPipeRiderOutputLog()
    .replace(colorCodeRegex, '')
    .replace(profileNotationRegex, '')
    .replace(fetchNotationRegex, '')
    .replace(resultNotationRegex, '');
  const status = (returnCode === '0') ? '✅ Success' : '❌ Failure';
  return `
# PipeRider CLI Report
> Test Result: ${status}
> Test Report: ${GITHUB_ACTION_URL}
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
  const metaDir = path.join(GITHUB_WORKSPACE, '.piperider');
  const reportFiles = fs.readdirSync(path.join(metaDir, 'reports', 'latest')).filter(f => f.endsWith('.html'))
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

  const outputFiles = fs.readdirSync(path.join(metaDir, "outputs", "latest"))
    .filter((f) => f.endsWith(".json"))
    .filter((f) => f != ".profiler.json");
  if (outputFiles.length === 0) {
    core.error('No successful piperider results found');
  } else if (outputFiles.length > reportFiles.length) {
    core.warning(`${reportFiles.length}/${outputFiles.length} reports are generated`);
  } else {
    core.notice(`${reportFiles.length}/${outputFiles.length} reports are generated`);
  }

  exit(returnCode);
}

const argv = process.argv.slice(2);
run(argv);