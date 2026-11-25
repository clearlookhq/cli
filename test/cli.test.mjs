import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { fromCI } from '../bin/clearlook.mjs'

const run = promisify(execFile)
const bin = fileURLToPath(new URL('../bin/clearlook.mjs', import.meta.url))

test('reads GitHub Actions', () => {
  const r = fromCI({ GITHUB_ACTIONS: 'true', GITHUB_SHA: 'a1b2c3d4e5', GITHUB_REF_NAME: 'main', GITHUB_ACTOR: 'ada', GITHUB_SERVER_URL: 'https://github.com', GITHUB_REPOSITORY: 'x/y', GITHUB_RUN_ID: '7' })
  assert.equal(r.provider, 'github')
  assert.equal(r.commit_sha, 'a1b2c3d4e5')
  assert.equal(r.url, 'https://github.com/x/y/actions/runs/7')
  assert.equal(r.environment, 'production')
})

test('a Vercel preview is a preview', () => {
  const r = fromCI({ VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_SHA: 'ffff0000aa', VERCEL_URL: 'x.vercel.app' })
  assert.equal(r.provider, 'vercel')
  assert.equal(r.environment, 'preview')
  assert.equal(r.url, 'https://x.vercel.app')
})

test('release posts to the API with the key and says what was recorded', async () => {
  let got
  const srv = createServer((req, res) => {
    let b = ''
    req.on('data', (c) => (b += c))
    req.on('end', () => {
      got = { path: req.url, auth: req.headers.authorization, body: JSON.parse(b) }
      res.writeHead(201, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ version: 'a1b2c3d', environment: 'production' }))
    })
  })
  await new Promise((r) => srv.listen(0, '127.0.0.1', r))
  const port = srv.address().port
  const { stdout } = await run('node', [bin, 'release'], { env: { PATH: process.env.PATH, CLEARLOOK_API_KEY: 'pat_test', CLEARLOOK_PROJECT: '12', CLEARLOOK_HOST: `http://127.0.0.1:${port}`, GITHUB_ACTIONS: 'true', GITHUB_SHA: 'a1b2c3d4e5f6' } })
  srv.closeAllConnections(); srv.close()
  assert.equal(got.path, '/api/projects/12/releases')
  assert.equal(got.auth, 'Bearer pat_test')
  assert.equal(got.body.commit_sha, 'a1b2c3d4e5f6')
  assert.equal(got.body.provider, 'github')
  assert.match(stdout, /Recorded release a1b2c3d \(production\) on project 12/)
  assert.doesNotMatch(stdout, /pat_test/)
})

test('without a key it says what to set, and fails', async () => {
  await assert.rejects(run('node', [bin, 'release'], { env: { PATH: process.env.PATH } }), (e) => /CLEARLOOK_API_KEY/.test(e.stderr))
})
