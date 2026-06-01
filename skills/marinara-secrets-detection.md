# Marinara Secrets Detection

Patterns to flag when scanning for hardcoded credentials.

## Patterns

**Cloud Providers**
- AWS Access Key: `AKIA[0-9A-Z]{16}`
- AWS Temp Key: `ASIA[0-9A-Z]{16}`
- AWS Secret: `[0-9a-zA-Z/+]{40}` (in vars named `*SECRET*`, `*AWS*`)
- Google Cloud: `AIza[0-9A-Za-z\-_]{35}`

**AI Providers**
- OpenAI: `sk-[a-zA-Z0-9]{48}` or `sk-proj-[a-zA-Z0-9]{48}`
- Anthropic: `sk-ant-[a-zA-Z0-9-_]{95,}`
- DeepSeek: `sk-[a-zA-Z0-9]{64}`

**Payment & SaaS**
- Stripe live: `(sk|pk|rk)_live_[0-9a-zA-Z]{24,}`
- Slack: `xox[baprs]-[a-zA-Z0-9-]{10,72}`

**Version Control**
- GitHub PAT: `ghp_[a-zA-Z0-9]{36}` or `github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}`
- GitHub OAuth: `gho_[a-zA-Z0-9]{36}`

**Auth Tokens**
- JWT: `eyJ[a-zA-Z0-9-_]+\.eyJ[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+`
- Private keys: `-----BEGIN (RSA|EC|DSA|OPENSSH|PGP) PRIVATE KEY-----`

**Database**
- PostgreSQL: `postgresql://[^:]+:[^@]+@(?!localhost|127\.0\.0\.1|example\.com)[^/]+`
- MySQL: `mysql://[^:]+:[^@]+@(?!localhost|127\.0\.0\.1|example\.com)[^/]+`
- MongoDB: `mongodb(\+srv)?://[^:]+:[^@]+@(?!localhost|127\.0\.0\.1|example\.com)[^/]+`

**Generic High-Entropy**
- Vars named `*SECRET*`, `*KEY*`, `*TOKEN*`, `*PASSWORD*`, `*AUTH*`, `*CREDENTIAL*`, `*API_KEY*` assigned strings >20 chars with mixed case/numbers

## Ignore

**Files**: `.env.example`, `.env.template`, `*.test.ts`, `*.spec.ts`, `__tests__/*`, `__mocks__/*`, `*.md`, `docs/*`

**Values**: starts with `your_`, `enter_`, `my_`, `test_`, `demo_`, `example_`, or wrapped in `<YOUR_*>`, `{YOUR_*}`, `[YOUR_*]`, or equals `xxx`, `12345`, `test`, `demo`, `sample`

**Hosts**: `localhost`, `127.0.0.1`, `0.0.0.0`, `example.com`, `test.com`

**Public keys**: starts with `ssh-rsa`, `ssh-ed25519`, `ssh-dss`, or ends in `.pub`

**Hashes**: SHA256/SHA512/MD5 for integrity, git commit hashes, package lock hashes

## Severity

- **Blocking**: Live production keys (AWS, Stripe live, real API keys), production DB credentials, production cert private keys
- **High**: Dev/staging credentials, test keys for paid services, high-entropy secrets of unknown origin
- **Medium**: Rotated credentials still in code, dev credentials in non-example files, weak secrets