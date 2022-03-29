# backbone://core

Backbone Core is an unstoppable, infinitely scalable dapp container for self-sovereign metaverse.

- **Standalone**: Self-contained dapps that work without blockchain
- **Batteries included**: World-class P2P infrastructure built-in
- **Fast onboarding**: Developers don’t need to learn P2P or blockchain to build dapps
- **Ethereum built-in**: Integrates natively with Ethereum to provide plug & play business models and digital value transfers
- **User-friendly**: Models familiar state-of-the-art app development environments for minimum friction
- **Cross-platform**: Backbone Core dapps work on web, mobile and desktop out-of-the-box
- **P2P with benefits**: Integrated, optional convenience services, like 24/7 always-online data hosting

## Installation

**Install dependencies**
```bash
$ npm run setup
```

## Run tests

*For faster performance, running local Backbone Network is recommended*:
```bash
# on terminal 1
$ npm run bootstrap-network
```

**Run tests (with bootstrap-network)**:
```bash
# on terminal 2
$ npm run bootstrap-test
# CTRL+C to exit
```

**Run tests (with live Backbone Network)**:
```bash
# on terminal 2
$ npm run test
# CTRL+C to exit
```

**Run test with extensive logging**:
```bash
$ LOG=1 npm run test
```

