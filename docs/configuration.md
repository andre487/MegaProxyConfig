# Portable configuration version 8

## Required common fields

The document is a JSON object with `schema: "net.megaproxy487.config"`, `version: 8`,
and a nonempty `profiles` array (at most 1,000 profiles). The legacy schema identifier
`dev.megaproxy.config` is accepted. Each profile needs a nonempty stable `id` (at
most 256 characters) and `proxy` with `type`, `host`, and integer `port` (1–65535).
IDs must be unique. Profile ID references must point to an existing profile or be
null. JSON Schema validates structure; ID uniqueness by property and reference
integrity require consumer checks. Older Android versions accept versions 1–8,
but this schema specifies canonical version 8 rather than permissive legacy input.

`name` is optional (up to 256 characters). `color` is the zero-based index into the
Android palette; renderers wrap it into their palette. `countryCode` is empty or
an uppercase ISO-style two-letter code. Array order is profile display order.

`activeProfileId` selects a profile; import must not silently connect it.
`passwordsIncluded` and `privateKeysIncluded` describe export choices, not requirements
that all profiles contain those keys. Never store real secrets in repository examples.

## Proxy settings

Supported portable `proxy.type` values are `HTTPS`, `HTTPS_JUMP`, `SSH`, `SSH_JUMP`.
`host` contains a hostname or IP address, without scheme, path or port. Android's
current decoder rejects colon-containing hosts (including IPv6 literals); the schema
allows IP literals for consumers supporting them. For cross-platform exports use
DNS names or IPv4. `username` is optional, up to 4,096 characters; `password` is
optional, up to 16,384. HTTPS uses Basic authentication. A browser may instead request
credentials through its native proxy authentication dialog.

Optional Android proxy fields: `privateKey` (unencrypted SSH key, up to 65,536
characters), `sshProfile`, `trustedHostKey`, `acceptAnyHostKey`, and
`allowInvalidProxyCertificate`. The last two deliberately weaken verification.
Browsers cannot implement SSH or override proxy certificate verification; incompatible
profiles must be reported and skipped rather than flattened into HTTPS.

Jump types require `proxy.jump` with `host` and `port`. Optional fields are
`sameAuthentication` (default true), `username`, `password`, `privateKey`,
`trustedHostKey`, `acceptAnyHostKey`, and `allowInvalidProxyCertificate`.
Never reinterpret a jump chain as a single proxy.

HTTP is supported by the browser UI but not by current Android's type enum. An HTTP
profile cannot be exported as an Android-compatible HTTPS profile. Consumers must
reject that export explicitly; never silently change the protocol.

## Optional Android fields

These can occur at the document level:

| Object/key | Fields / values |
|---|---|
| `tls` | `fingerprint`, `customJa3` (up to 8,192 characters) |
| `ssh` | `fingerprint`, `authMode`: AUTO/PASSWORD_ONLY/KEY_ONLY; `keepaliveSeconds`: 0–3600; `maxChannels`: 1–256; `rotationMinutes`: 0–1440; `rotationMb`: 0–10240 |
| `failover` | `mode`: DISABLED/SELECTED/ALL; `profileIds`: ordered unique IDs |
| `routing` | `routeAllApps`, `selectedPackages` (Android package names), `bypassLocalNetworks` (default true) |
| `alwaysOnProfileId` | Android Always-on selection, nullable |
| `diagnosticLogLimitMb` | Integer 1–100 |

Profiles additionally support `tls`, `dns`, and `routing`.
Profile `routing` adds `allowIpv6` (default false); the other routing keys match the
document object. Android applies global routing/TLS/SSH settings when connecting.

TLS fingerprints: DEFAULT, CHROME_ANDROID, FIREFOX_ANDROID, EDGE_ANDROID, RANDOMIZED,
SAMSUNG_INTERNET, YANDEX_BROWSER, CUSTOM. Some presets are unavailable in current
Android builds and revert to DEFAULT. CUSTOM selects `customJa3`; a valid JA3 string
requires a semantic parser beyond JSON Schema's length check.

SSH fingerprints: DEFAULT, OPENSSH_TERMUX, CONNECTBOT, JUICESSH, TERMIUS_ANDROID.
DNS providers: CLOUDFLARE, GOOGLE, QUAD9, YANDEX, YANDEX_SAFE, YANDEX_FAMILY, CUSTOM.
CUSTOM uses `dns.customDohUrl` (HTTPS endpoint, up to 2,048 characters).
Filtering DNS policies must not fall back to unfiltered providers.

These fields are retained for portability; their presence does not mean a browser
can implement them. Browser TLS, DNS, IPv6 and transport multiplexing are controlled
by the browser rather than this extension.

## Optional browser fields

Document `browser` contains `theme` (system/light/dark) and `language` (auto/en/ru).
Profile `browser` contains:

| Field | Meaning |
|---|---|
| `knockHost` | Hostname/IP without scheme, path or port; empty disables configuration |
| `bypass` | Domain/IP exclusions, each domain also matches its subdomains |
| `authMode` | auto/challenge; retained for legacy imports; saved credentials in Firefox use immediate CONNECT authentication |

Local-network bypass uses the shared `routing.bypassLocalNetworks` field. It defaults
to true, independent of custom domain exclusions. A knock host must not be bypassed.
Firefox disables knock when both credentials are saved; Chromium needs knock even
with saved credentials. With missing credentials both browsers open knock to show
the browser's native authentication prompt. A configured knock host is required for
that workflow; credentials entered into the browser prompt are not readable by the
extension and are not copied into its configuration.

Platform objects are optional. Unknown keys are allowed for forward compatibility
but known keys are strictly typed. Extensions should preserve ignored Android
settings when updating or exporting an imported profile. Current Android ignores
unknown `browser` keys but drops them on its own export. Thus importing browser
files into Android works, but browser fields will not round-trip through unmodified
Android; preservation needs a future Android implementation update.

## Import, merge and export

Stable IDs are generator-controlled. Reimport updates matching profiles and appends
new IDs; existing local order is retained. Omitted `password` or `privateKey` preserves
stored secrets; explicit empty strings clear them. The same rule applies to jump
secrets. Profiles absent from a file are retained unless the user explicitly selects
them for removal. Imported active/always-on IDs do not authorize automatic connection.
Review connection-affecting changes before applying an import.

Export omits passwords and private keys by default. Including secrets requires an
explicit user choice. Unknown platform settings should be preserved, not executed.
Unsupported profiles may be skipped on import with a visible summary.

Other Android input formats are not portable JSON: FoxyProxy JSON (`data` array;
`https`/`ssl`, `hostname` or `address`, numeric/string port, `title`, `cc` and credentials),
ProxyList (one HTTPS URL per non-comment line with percent-encoded `user:password`,
optional `title`/`cc` query parameters), and SuperProxy's supported subset (same list
with first nonempty line `# superproxy:proxylist:v1`). SuperProxy certificate pins
are not imported. These formats have no stable IDs and create new profiles.
