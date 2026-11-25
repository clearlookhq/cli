# @clearlookhq/cli

Clearlook from your terminal and CI.

```sh
npx @clearlookhq/cli prompt     # the setup prompt for your AI coding tool
npx @clearlookhq/cli release    # record this deploy as a release
```

## Record deploys

Make a key with only **Record releases** in Settings › API keys, store it as the CI secret
`CLEARLOOK_API_KEY`, and add a step after your deploy:

```yaml
- run: npx -y @clearlookhq/cli release
  env:
    CLEARLOOK_API_KEY: ${{ secrets.CLEARLOOK_API_KEY }}
    CLEARLOOK_PROJECT: 123
```

It reads the commit, branch and run link from GitHub Actions, Vercel, Netlify, Render, Railway and
GitLab. Options: `--version`, `--environment production|preview|development`, `--host` (for a
self-hosted Clearlook). The key is read from the environment and never printed.

Releases let Clearlook say which deploy changed something: see [Releases](https://docs.clearlook.dev/releases).

## Releasing this package

Bump `version` in `package.json` and push a matching tag (`v0.1.1`). GitHub Actions stages it on npm
with trusted publishing (no npm token) and provenance; a maintainer approves it on npmjs.com with
2FA before anyone can install it.

MIT licence.
