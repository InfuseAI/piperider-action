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

function getFilesUnderDir(dir) {
  var results = [];
  var list = fs.readdirSync(dir);
  list.forEach(function(file) {
      file = path.join(dir, file);
      var stat = fs.statSync(file);
      if (stat && stat.isDirectory()) {
          /* Recurse into a subdirectory */
          results = results.concat(getFilesUnderDir(file));
      } else {
          /* Is a file */
          results.push(file);
      }
  });
  return results;
}

function getReportArtifacts(dir) {
  var results = [];
  var list = fs.readdirSync(dir);

  results = results.concat(list)

  list.forEach(function(file) {
      file = path.join(dir, file);
      var stat = fs.statSync(file);
      if (stat && stat.isFile() && !file.endsWith('.json')) {
        results.push(file)
      }
  });

  // add files for html rendering usage
  results = results.concat(getFilesUnderDir(path.join(dir, 'logo')))
  results = results.concat(getFilesUnderDir(path.join(dir, 'static')))
  return results;
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
  const artifactName = 'PipeRider-Reports';
  const reportDir = path.join(GITHUB_WORKSPACE, '.piperider', 'outputs', 'latest');
  const reportArtifacts = getReportArtifacts(reportDir)
  const options = {
    continueOnError: true
  };
  core.debug(`Uploading artifacts: ${reportArtifacts}`);
  const uploadResult = await artifactClient.uploadArtifact(
    artifactName,
    reportArtifacts,
    path.join(reportDir),
    options);
  core.debug(`Upload result: ${JSON.stringify(uploadResult)}`);

  // Write the output to GitHub action annotation
  core.debug(`GitHub: ${JSON.stringify(context)}`);
  core.debug(`Running action: ${JSON.stringify(event)}`);

  const outputFiles = fs.readdirSync(reportDir).filter((f) => f == "run.json")
  if (outputFiles.length === 0) {
    core.error('No successful PipeRider results found');
  } else {
    core.notice(`PipeRider reports are generated`);
  }

  exit(returnCode);
}

const argv = process.argv.slice(2);
run(argv);