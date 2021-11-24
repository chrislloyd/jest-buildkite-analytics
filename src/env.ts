import { v4 as uuidv4 } from "uuid";

function pickEnv(keys: Array<string>): Array<string | undefined> {
  return keys.map((key) => {
    const value = process.env[key];
    delete process.env[key];
    return value;
  });
}

export function pickCIEnvVars() {
  const [buildkiteBuildId, debug] = pickEnv([
    "BUILDKITE_BUILD_ID",
    "BUILDKITE_ANALYTICS_DEBUG_ENABLED",
  ]);

  if (buildkiteBuildId) {
    const [url, branch, commitSha, buildNumber, jobId, message] = pickEnv([
      "BUILDKITE_BUILD_URL",
      "BUILDKITE_BRANCH",
      "BUILDKITE_COMMIT",
      "BUILDKITE_BUILD_NUMBER",
      "BUILDKITE_JOB_ID",
      "BUILDKITE_MESSAGE",
    ]);
    return {
      CI: "buildkite",
      key: buildkiteBuildId,
      url,
      branch,
      commit_sha: commitSha,
      number: buildNumber,
      job_id: jobId,
      message,
      debug,
    };
  } else {
    return {
      CI: undefined,
      key: uuidv4(),
      debug,
    };
  }
}
