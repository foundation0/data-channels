# Data Channels

Data Channels is an unstoppable, infinitely scalable data transfer layer for the next generation internet.


- **Standalone**: Self-contained and works without external services, like blockchains
- **Batteries included**: World-class P2P infrastructure built-in in every data channel
- **Fast onboarding**: Developers don’t need to learn P2P or blockchain to build on data channels
- **Ethereum L2 support**: Integrates natively with Ethereum to provide plug & play digital value transfers
- **Cross-platform**: Data channels work on web, mobile and desktop out-of-the-box
- **P2P with benefits**: Integrated, optional convenience services, like 24/7 always-online data mirroring

> Please note that this is a work in progress and not yet ready for production use.

## Installation

Some of the dependencies are still in alpha stage and set private, so unless you are part of the foundation organization, you won't be able to install the dependencies.

```bash
# clone the repo (NPM package not yet available)
git clone https://github.com/foundation0/data-channels.git

# install dependencies
npx pnpm i

# build the Core
npm run build
```
## Running tests

> Note: there is a weird bug causing some of the tests fail when run in one go, but if ran individually, they pass. Probably something to do with storages getting mixed up.

```bash
npm test
```