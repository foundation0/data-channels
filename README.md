# Backbone Core Alpha

Backbone Core is an unstoppable, infinitely scalable dapp platform for the self-sovereign internet.

- **Standalone**: Self-contained dapps that work without external services, like blockchains
- **Batteries included**: World-class P2P infrastructure built-in in every Core
- **Fast onboarding**: Developers don’t need to learn P2P or blockchain to build dapps
- **Ethereum L2 support**: Integrates natively with Ethereum to provide plug & play business models and digital value transfers
- **User-friendly**: Models familiar state-of-the-art app development environments for minimum friction
- **Cross-platform**: Backbone Core dapps work on web, mobile and desktop out-of-the-box
- **P2P with benefits**: Integrated, optional convenience services, like 24/7 always-online data mirroring

## Installation

```bash
# clone the repo (NPM package not yet available)
git clone https://github.com/backbonedao/core.git

# install dependencies
npx pnpm i

# build the Core
npm run build
```
## Running tests

> Note: there is a weird bug causing some of the tests fail when run in one go, but if ran individually, they pass. Probably something to do with Cores' storages getting mixed up.

```bash
npm test
```