const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const execSyncWrapper = (command) => {
  let stdout = null;
  try {
    stdout = execSync(command).toString().trim();
  } catch (e) {
    console.error(e);
  }
  return stdout;
}

const main = () => {
  let gitBranch = execSyncWrapper('git rev-parse --abbrev-ref HEAD');
  let gitCommitHash = execSyncWrapper('git rev-parse --short=7 HEAD');
  let date = new Date().toUTCString();

  const obj = {
    gitBranch,
    gitCommitHash,
    date
  };

  const filePath = path.resolve('src', 'versionGitInfo.json');
  const fileContents = JSON.stringify(obj, null, 2);

  fs.writeFileSync(filePath, fileContents);

  console.log(`Write the following contents to ${filePath}\n${fileContents}`);
};

main();