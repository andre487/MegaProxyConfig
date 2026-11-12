# MegaProxyConfig

The shared version 8 configuration contract for MegaProxy clients.
The JSON Schema uses draft 2020-12 and validates common fields only.

Configurations may include platform-specific sections at document and profile
level. The corresponding application owns their format and validation. There is
no fixed list of platforms or embedded Android/browser settings schema here.
Unsupported fields are reported and discarded by the receiving client.

- [Format and import semantics](docs/configuration.md)
- [Shared field reference](docs/field-reference.md)
- [Configuration subscriptions](docs/subscription-protocol.md)
- [Shared schema](schemas/megaproxy-v8.schema.json)
- [Example with Android extensions](examples/android-v8.json)
- [Example with browser extensions](examples/browser-v8.json)
- [Example with Windows extensions](examples/windows-v8.json)

Run `npm ci && npm test`. Examples demonstrate common fields and opaque extensions;
passing this schema does not validate the extensions or guarantee client support.
`android-v8.schema.json` remains a distribution compatibility alias for existing
consumers; it no longer defines Android-specific settings.

Consumers vendor the schema and LICENSE and pin the source commit and SHA-256 in
a lock file. Refresh explicitly, review changes and test the committed copy offline.
Changing the portable version requires coordinated consumer changes. Adding a
platform section does not change the shared version.
