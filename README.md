# backbone://core

Backbone Core is an unstoppable, infinitely scalable dapp platform for the self-sovereign internet.

- **Standalone**: Self-contained dapps that work without external services, like blockchains
- **Batteries included**: World-class P2P infrastructure built-in in every Core
- **Fast onboarding**: Developers don’t need to learn P2P or blockchain to build dapps
- **Ethereum L2 support**: Integrates natively with Ethereum to provide plug & play business models and digital value transfers
- **User-friendly**: Models familiar state-of-the-art app development environments for minimum friction
- **Cross-platform**: Backbone Core dapps work on web, mobile and desktop out-of-the-box
- **P2P with benefits**: Integrated, optional convenience services, like 24/7 always-online data mirroring

## Installation

**Install dependencies**
```bash
$ npx pnpm i
```

## Major features roadmap
- [x] End-to-end encryption
- [x] Uses Backbone Id to authenticate and sign data objects
- [x] Works on browsers and NodeJs
- [x] Fetches application from other users
- [x] Executes application and renders optional frontend
- [x] Single user apps

- [ ] Multi-user apps
  - Waits for Id to have syncing ability between instances
- [ ] Notifies about updates on applications

## Development

**Start live-reload server (development):**
```bash
npm run build:browser:watch
```

## Building

**Build browser package (production):**
```bash
npm run build:browser
# builds /dist/core.min.js
```