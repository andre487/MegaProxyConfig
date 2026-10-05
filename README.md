# MegaProxyConfig

The portable configuration contract shared by AndroidMegaProxy and BrowserMegaProxy.
JSON Schema uses draft 2020-12. This repository documents Android's current version 8
format and adds optional browser fields without changing its version or existing keys.

- [Format and import semantics](docs/configuration.md)
- [Android version 8 baseline](schemas/android-v8.schema.json)
- [Shared version 8 schema](schemas/megaproxy-v8.schema.json)
- [Android example](examples/android-v8.json)
- [Browser example](examples/browser-v8.json)

Run `npm ci && npm test` to validate examples and compatibility cases.
The reference Android implementation is `ConfigTransfer.kt` at commit
`8598dfd8b43cefc3744aa37c25cf54b2e813955e` in
[AndroidMegaProxy](https://github.com/andre487/AndroidMegaProxy).

## Schema distribution

Consumers vendor the schemas and LICENSE, recording the source commit and SHA-256
in a lock file. Tests read the committed copy; CI never downloads `main` implicitly.
BrowserMegaProxy provides `npm run renew-config-schema` to explicitly fetch the latest
`main`, or `npm run renew-config-schema -- --ref=<commit>` to pin a reviewed revision.
Review the schema diff and lock file together. Commit references must be full Git
commit hashes; tags may move. This works for Kotlin, Go, JS and offline test runs
without requiring an npm runtime dependency or publishing a package.

Changing the portable JSON version requires coordinated consumer changes. Adding
optional platform keys does not. Keep baseline and shared compatibility tests.
