// @ts-nocheck
import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import semanticRelease from "semantic-release";
import { WritableStreamBuffer } from "stream-buffers";

const stdoutBuffer = new WritableStreamBuffer();

const [packageJsonPath, changelogPath, templateMessage] = process.argv.slice(2);

async function makeRelease() {
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

    const result = await semanticRelease(
      {
        // Core options
        branches: ["main"],
        plugins: [
          "@semantic-release/commit-analyzer",
          "@semantic-release/release-notes-generator",
        ],
      },
      {
        stdout: stdoutBuffer,
      }
    );

    if (result) {
      const { nextRelease } = result;

      if (packageJson.version === nextRelease.version) {
        process.exit(0);
      }

      writeFileSync(
        packageJson,
        JSON.stringify(
          {
            ...packageJson,
            version: nextRelease.version,
          },
          null,
          2
        )
      );

      const oldChangelog = readFileSync(changelogPath, "utf-8");

      writeFileSync(
        changelogPath,
        `${oldChangelog}\n<br/><hr/><br/>\n>${nextRelease.notes}`
      );

      const COMMIT_MESSAGE = templateMessage.replace(
        "$version$",
        nextRelease.version
      );
      execSync(`echo "COMMIT_MESSAGE=${COMMIT_MESSAGE}" >> $GITHUB_OUTPUT`);
      execSync(`echo "NEW_VERSION=${nextRelease.version}" >> $GITHUB_OUTPUT`);
    } else {
      console.log("No release published.");
    }
  } catch (err) {
    console.error("The automated release failed with %O", err);
    process.exit(1);
  }
}

makeRelease();
