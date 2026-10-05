import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const root = new URL('..', import.meta.url).pathname;
const script = (name: string) => join(root, 'scripts', name);
const temps: string[] = [];
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'export-test-'));
  temps.push(dir);
  return dir;
}

function run(file: string, args: string[], cwd = root) {
  const result = spawnSync('bash', [file, ...args], { cwd, encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

function bareRepo() {
  const dir = tempDir();
  git(dir, 'init', '-q', '--bare', '-b', 'main');
  return dir;
}

/** A small directory that looks like the starter and passes the check. */
function cleanFixture() {
  const dir = tempDir();
  writeFileSync(join(dir, 'README.md'), '# Approval Inbox\n\nFireStart Cloud automates processes. Questions: s.ferraz-leite@firestart.com\n');
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src', 'bootstrap.ts'), '// Starts the app. Uses a scorecard-free setup.\nexport const ok = true;\n');
  return dir;
}

describe('check-starter.sh', () => {
  it('passes the current starter', () => {
    const exported = tempDir();
    execFileSync('bash', ['-c', `git archive HEAD starter | tar -x -C "${exported}"`], { cwd: root });

    const result = run(script('check-starter.sh'), [join(exported, 'starter')]);

    expect(result.output).toContain('passed');
    expect(result.status).toBe(0);
  });

  it('passes a clean directory with the company name, the contact address and look-alike words', () => {
    expect(run(script('check-starter.sh'), [cleanFixture()]).status).toBe(0);
  });

  it.each(['pitfall', 'Trap', 'GOTCHA', 'evaluation', 'Assessment', 'interviews', 'rubric', 'scoring'])(
    'fails on the term "%s" in a file',
    (term) => {
      const dir = cleanFixture();
      writeFileSync(join(dir, 'src', 'notes.ts'), `// This is a ${term} for later.\n`);

      const result = run(script('check-starter.sh'), [dir]);

      expect(result.status).not.toBe(0);
      expect(result.output).toContain('notes.ts');
    },
  );

  it('fails on a term in a file name', () => {
    const dir = cleanFixture();
    writeFileSync(join(dir, 'src', 'interview-notes.md'), 'nothing here\n');

    const result = run(script('check-starter.sh'), [dir]);

    expect(result.status).not.toBe(0);
    expect(result.output).toContain('interview-notes.md');
  });

  it.each(['api.dev.firestart.cloud', 'https://firestart.example.com', 'someone.else@firestart.com', 'auth.firestart.io'])(
    'fails on the host name %s',
    (host) => {
      const dir = cleanFixture();
      writeFileSync(join(dir, 'src', 'config.ts'), `export const url = '${host}';\n`);

      const result = run(script('check-starter.sh'), [dir]);

      expect(result.status).not.toBe(0);
      expect(result.output).toContain('config.ts');
    },
  );

  it('fails on a commit message passed for checking', () => {
    const result = run(script('check-starter.sh'), [cleanFixture(), '--message', 'Add interview hooks']);

    expect(result.status).not.toBe(0);
    expect(result.output).toContain('commit message');
  });
});

describe('export-starter.sh', () => {
  it('pushes the starter as exactly one commit "Initial commit"', () => {
    const remote = bareRepo();

    const result = run(script('export-starter.sh'), ['--remote', remote]);

    expect(result.status, result.output).toBe(0);
    expect(git(remote, 'rev-list', '--count', 'main')).toBe('1');
    expect(git(remote, 'log', '-1', '--format=%s', 'main')).toBe('Initial commit');
    const files = git(remote, 'ls-tree', '-r', '--name-only', 'main').split('\n');
    expect(files).toEqual(expect.arrayContaining(['README.md', 'NOTES.md', 'package.json', 'mock-server/src/server.ts', 'apps/web/package.json']));
    expect(files.some((file) => file.includes('node_modules') || file.startsWith('starter/'))).toBe(false);
  });

  it('refuses to overwrite a remote that already has commits, unless forced', () => {
    const remote = bareRepo();
    run(script('export-starter.sh'), ['--remote', remote]);
    const first = git(remote, 'rev-parse', 'main');

    const refused = run(script('export-starter.sh'), ['--remote', remote]);
    expect(refused.status).not.toBe(0);
    expect(refused.output).toContain('--force');
    expect(git(remote, 'rev-parse', 'main')).toBe(first);

    const forced = run(script('export-starter.sh'), ['--remote', remote, '--force']);
    expect(forced.status, forced.output).toBe(0);
    expect(git(remote, 'rev-list', '--count', 'main')).toBe('1');
  });

  it('does not push when the check fails', () => {
    const remote = bareRepo();
    const source = tempDir();
    cpSync(cleanFixture(), source, { recursive: true });
    writeFileSync(join(source, 'leak.ts'), "export const host = 'api.dev.firestart.cloud';\n");

    const result = run(script('export-starter.sh'), ['--remote', remote, '--source', source]);

    expect(result.status).not.toBe(0);
    expect(git(remote, 'rev-list', '--all', '--count')).toBe('0');
  });
});

describe('package-zip.sh', () => {
  function unzipList(zip: string) {
    return execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).trim().split('\n');
  }

  it('packages an exported remote without node_modules and without Git metadata', () => {
    const remote = bareRepo();
    run(script('export-starter.sh'), ['--remote', remote]);
    const zip = join(tempDir(), 'approval-inbox.zip');

    const result = run(script('package-zip.sh'), ['--remote', remote, '--out', zip]);

    expect(result.status, result.output).toBe(0);
    const entries = unzipList(zip);
    expect(entries).toEqual(expect.arrayContaining(['approval-inbox/README.md', 'approval-inbox/mock-server/src/server.ts']));
    expect(entries.some((entry) => entry.includes('node_modules') || entry.includes('/.git/'))).toBe(false);
  });

  it('packages the committed starter directly', () => {
    const zip = join(tempDir(), 'approval-inbox.zip');

    const result = run(script('package-zip.sh'), ['--from-head', '--out', zip]);

    expect(result.status, result.output).toBe(0);
    expect(existsSync(zip)).toBe(true);
    const readme = execFileSync('unzip', ['-p', zip, 'approval-inbox/README.md'], { encoding: 'utf8' });
    expect(readme).toBe(readFileSync(join(root, 'starter', 'README.md'), 'utf8'));
  });
});
