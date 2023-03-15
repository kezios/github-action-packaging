#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { program as commander } from 'commander';
import { WritableStreamBuffer } from 'stream-buffers';
import semanticRelease from 'semantic-release';
import { execSync } from 'child_process';

/** UTILS */
const CHANGELOG_SEPARATOR = '\n<br/><hr/><br/>\n>';

const readJsonFile = (path) => JSON.parse(readFileSync(path, 'utf8'));

const writeJsonFile = (path, data) =>
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');

const addChangelog = (path, data) =>
  writeFileSync(
    path,
    [(readFileSync(path, 'utf-8'), CHANGELOG_SEPARATOR, data)].join('')
  );

/** COMMANDS **/
const stdoutBuffer = new WritableStreamBuffer();

const runSemanticAnalyser = async (packageJson, branch) => {
  const result = await semanticRelease(
    {
      // Core options
      branches: [branch],
      plugins: [
        '@semantic-release/commit-analyzer',
        '@semantic-release/release-notes-generator'
      ]
    },
    {
      //@ts-ignore
      stdout: stdoutBuffer
    }
  );

  if (!result || result.nextRelease.version === packageJson.version) {
    throw new Error('Do not change version');
  }

  return result;
};

const prepareNodeRelease = async (options) => {
  const packageJson = readJsonFile(options.packageUri);

  try {
    const release = await runSemanticAnalyser(packageJson, options.branch);

    writeJsonFile(options.packageUri, {
      ...packageJson,
      version: release.nextRelease.version
    });

    addChangelog(options.changelogUri, release.nextRelease.notes);

    execSync(`echo "status=success" >> $GITHUB_OUTPUT`);
  } catch (err) {
    console.log('[ERROR]', err);
    execSync(`echo "status=error" >> $GITHUB_OUTPUT`);
    process.exit(0);
  }
};

/** CLI **/
const parseArguments = (program = commander) => {
  const packageJson = readJsonFile('./package.json');

  program
    .version(packageJson.version, '-v, --version', 'output the current version')
    .description('Kezios prepare release CLI.')
    .name('@kezios/prepare-release-cli');

  program
    .command('node')
    .description('Update package.json version & changelog')
    .option('--package-uri <packageUri>', 'Location of package.json file')
    .option('--changelog-uri <changelogUri>', 'Location of changelog file')
    .option('--branch <branch>', 'Branch to release from', 'main')
    .action(prepareNodeRelease);

  program.parse(process.argv);

  return { options: program.opts(), args: program.args };
};

parseArguments();
