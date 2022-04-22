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
$ npx pnpm i
```

## Development

**Build browser package (development):**
```bash
npm run build:browser-dev
# builds /dist/core.js
```

**Start HTTP server at port 8888:**
```bash
npm run http-server
# open http://localhost:8888/test/test.html
```


## Building

**Build browser package (production):**
```bash
npm run build:browser
# builds /dist/core.min.js
```