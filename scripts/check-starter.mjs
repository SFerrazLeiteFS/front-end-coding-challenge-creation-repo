#!/usr/bin/env node
// Checks a directory that is about to be shipped to candidates.
// Fails on terms that reveal how submissions are judged and on internal names
// ("firestart" in hosts, emails, URLs, package scopes, org names, file names).
// Allowed: the company name "FireStart" as a word, and the contact address in README.md.
//
// Usage: node scripts/check-starter.mjs <dir> [--message "<commit message>"]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const CONTACT = 's.ferraz-leite@firestart.com';
const SKIP_DIRS = new Set(['node_modules', '.git', '.next']);
const TERM = /^(pitfalls?|traps?|trapped|gotchas?|evaluat\w*|assess\w*|interview\w*|rubrics?|scoring)$/i;

/** Words of a text, also inside identifiers: `interviewMode` → interview, mode; `is_trap` → is, trap. */
const words = (text) =>
  text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z]+/)
    .filter(Boolean);

const forbiddenTerms = (text) => [...new Set(words(text).filter((word) => TERM.test(word)))];

/** "firestart" anywhere except as the plain company name (and the contact address where allowed). */
function internalNames(text, { contactAllowed }) {
  let checked = text;
  if (contactAllowed) {
    checked = checked.replace(new RegExp(`(?<![\\w.@-])${CONTACT.replace(/[.]/g, '\\.')}(?![\\w@-]|\\.\\w)`, 'gi'), '');
  }
  checked = checked.replace(/(?<![\w.@/:-])firestart(?![\w.@/:-])/gi, '');
  return /firestart/i.test(checked);
}

function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const path = join(dir, entry.name);
    yield { path, isDirectory: entry.isDirectory() };
    if (entry.isDirectory()) yield* files(path);
  }
}

const [dir, ...rest] = process.argv.slice(2);
let message = null;
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === '--message' && i + 1 < rest.length) message = rest[++i];
  else {
    console.error(`unknown or incomplete argument: ${rest[i]}`);
    process.exit(2);
  }
}
if (!dir || !statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
  console.error(`usage: check-starter.mjs <dir> [--message <text>] (not a directory: ${dir ?? '(none)'})`);
  process.exit(2);
}

const problems = [];
for (const { path, isDirectory } of files(dir)) {
  const name = relative(dir, path);
  const nameTerms = forbiddenTerms(name);
  if (nameTerms.length) problems.push(`${name}: forbidden term in name (${nameTerms.join(', ')})`);
  if (internalNames(name, { contactAllowed: false })) problems.push(`${name}: internal name in file name`);
  if (isDirectory) continue;

  const content = readFileSync(path);
  if (content.includes(0)) continue; // binary
  const text = content.toString('utf8');
  text.split('\n').forEach((line, index) => {
    const terms = forbiddenTerms(line);
    if (terms.length) problems.push(`${name}:${index + 1}: forbidden term (${terms.join(', ')}): ${line.trim()}`);
    if (internalNames(line, { contactAllowed: name === 'README.md' })) {
      problems.push(`${name}:${index + 1}: internal name: ${line.trim()}`);
    }
  });
}
if (message !== null) {
  const terms = forbiddenTerms(message);
  if (terms.length || internalNames(message, { contactAllowed: false })) problems.push(`commit message: ${message}`);
}

if (problems.length) {
  for (const problem of problems) console.error(`✗ ${problem}`);
  console.error(`Check failed for ${dir}`);
  process.exit(1);
}
console.log(`Check passed for ${dir}`);
