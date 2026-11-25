#!/usr/bin/env node
// clearlook: Clearlook from your terminal and CI. No dependencies; Node 18 or later.
//
//   clearlook release     record this deploy as a release (reads your CI's commit variables)
//   clearlook prompt      print the one-line setup prompt for your AI coding tool
//
// release needs CLEARLOOK_API_KEY (a key with only "Record releases", from Settings › API keys)
// and CLEARLOOK_PROJECT (the project id). The key is read from the environment and never printed.
import { readFileSync } from 'node:fs'

const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
const env = (...names) => names.map((n) => (process.env[n] ?? '').trim()).find(Boolean) ?? ''
const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf('--' + name)
  if (i >= 0 && args[i + 1] && !args[i + 1].startsWith('--')) return args[i + 1]
  const eq = args.find((a) => a.startsWith('--' + name + '='))
  return eq ? eq.slice(name.length + 3) : ''
}
const fail = (msg) => {
  process.stderr.write(`clearlook: ${msg}\n`)
  process.exit(1)
}
const host = () => {
  let h = (flag('host') || env('CLEARLOOK_HOST') || 'app.clearlook.dev').replace(/\/+$/, '')
  if (!/^https?:\/\//.test(h)) h = 'https://' + h
  return h
}

// what CI is this, and what does it say about the deploy?
export function fromCI(e = process.env) {
  const g = (...n) => n.map((k) => (e[k] ?? '').trim()).find(Boolean) ?? ''
  let provider = 'cli', url = ''
  if (e.GITHUB_ACTIONS === 'true') {
    provider = 'github'
    if (e.GITHUB_SERVER_URL && e.GITHUB_REPOSITORY && e.GITHUB_RUN_ID) url = `${e.GITHUB_SERVER_URL}/${e.GITHUB_REPOSITORY}/actions/runs/${e.GITHUB_RUN_ID}`
  } else if (e.VERCEL === '1') {
    provider = 'vercel'
    if (e.VERCEL_URL) url = 'https://' + e.VERCEL_URL
  } else if (e.NETLIFY === 'true') {
    provider = 'netlify'
    url = g('DEPLOY_URL')
  }
  const vercelEnv = g('VERCEL_ENV')
  return {
    commit_sha: g('GITHUB_SHA', 'VERCEL_GIT_COMMIT_SHA', 'COMMIT_REF', 'RENDER_GIT_COMMIT', 'RAILWAY_GIT_COMMIT_SHA', 'CI_COMMIT_SHA'),
    commit_message: g('VERCEL_GIT_COMMIT_MESSAGE', 'CI_COMMIT_MESSAGE'),
    branch: g('GITHUB_REF_NAME', 'VERCEL_GIT_COMMIT_REF', 'BRANCH', 'RENDER_GIT_BRANCH', 'RAILWAY_GIT_BRANCH', 'CI_COMMIT_REF_NAME'),
    author: g('GITHUB_ACTOR', 'VERCEL_GIT_COMMIT_AUTHOR_NAME', 'RAILWAY_GIT_AUTHOR'),
    environment: vercelEnv && vercelEnv !== 'production' ? vercelEnv : 'production',
    provider,
    url,
  }
}

async function release() {
  const key = env('CLEARLOOK_API_KEY')
  if (!key) fail('set CLEARLOOK_API_KEY to a key with "Record releases" (Settings › API keys). It is read from the environment so it never lands in a log.')
  const project = flag('project') || env('CLEARLOOK_PROJECT')
  if (!project) fail('set CLEARLOOK_PROJECT (or --project) to the project id.')
  const body = { ...fromCI(), version: flag('version') }
  if (flag('environment') || env('CLEARLOOK_ENVIRONMENT')) body.environment = flag('environment') || env('CLEARLOOK_ENVIRONMENT')
  if (!body.version && body.commit_sha.length < 7) fail('no version: pass --version, or run in a CI that sets the commit SHA.')
  const h = host()
  let res
  try {
    res = await fetch(`${h}/api/projects/${encodeURIComponent(project)}/releases`, {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'User-Agent': `clearlook-cli/${VERSION}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000),
    })
  } catch (e) {
    fail(`could not reach ${h}: ${e.message}`)
  }
  const text = await res.text()
  let out = {}
  try { out = JSON.parse(text) } catch {}
  if (!res.ok) fail(`${h} said ${res.status}: ${out.message ?? text.slice(0, 200)}`)
  process.stdout.write(`Recorded release ${out.version} (${out.environment}) on project ${project}.\n`)
}

function prompt() {
  const h = host()
  process.stdout.write(`Paste this into Claude Code, Cursor, VS Code or any coding agent:

  Set up Clearlook in this app by following ${h}/setup.md

Or connect Clearlook to Claude Code yourself:

  claude mcp add --transport http clearlook ${h}/mcp
`)
}

function help() {
  process.stdout.write(`clearlook ${VERSION}

  clearlook release   record this deploy as a release
                      needs CLEARLOOK_API_KEY and CLEARLOOK_PROJECT; reads the commit from
                      GitHub Actions, Vercel, Netlify, Render, Railway and GitLab
                      --version v, --environment production|preview|development, --host h
  clearlook prompt    print the setup prompt for your AI coding tool

Docs: https://docs.clearlook.dev
`)
}

const cmd = args[0]
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('/clearlook') || process.argv[1]?.endsWith('clearlook.mjs')) {
  if (cmd === 'release') await release()
  else if (cmd === 'prompt') prompt()
  else if (cmd === '--version' || cmd === '-v') process.stdout.write(VERSION + '\n')
  else if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') help()
  else fail(`unknown command "${cmd}". Run clearlook help.`)
}
