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

These fields are optional Android settings; their presence does not mean a browser
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
but known keys are strictly typed. Clients must discard unsupported platform fields after displaying the general import
warning described below. Current Android ignores
unknown `browser` keys but drops them on its own export. Thus importing browser
files into Android works, but browser fields will not round-trip through unmodified
Android. A future Android import review must add the general warning; unsupported
fields are deliberately discarded rather than preserved.

## Import, merge and export

Stable IDs are generator-controlled. Reimport updates matching profiles and appends
new IDs; existing local order is retained. Omitted `password` or `privateKey` preserves
stored secrets; explicit empty strings clear them. The same rule applies to jump
secrets. Profiles absent from a file are retained unless the user explicitly selects
them for removal. Imported active/always-on IDs do not authorize automatic connection.
Review connection-affecting changes before applying an import.

Export omits passwords and private keys by default. Including secrets requires an
explicit user choice. Unsupported documented fields and undocumented fields produce one general
warning and are discarded; neither is retained for export.
Unsupported profiles may be skipped on import with a visible summary.

Other Android input formats are not portable JSON: FoxyProxy JSON (`data` array;
`https`/`ssl`, `hostname` or `address`, numeric/string port, `title`, `cc` and credentials),
ProxyList (one HTTPS URL per non-comment line with percent-encoded `user:password`,
optional `title`/`cc` query parameters), and SuperProxy's supported subset (same list
with first nonempty line `# superproxy:proxylist:v1`). SuperProxy certificate pins
are not imported. These formats have no stable IDs and create new profiles.

## Browser implementation limits

Browser failover can use the common `failover` object. BrowserMegaProxy reacts to
observable proxy connection/tunnel/certificate errors, tries candidates in order, and
never switches to direct access when they are exhausted. HTTP status errors from an
origin do not trigger failover. Exact socket/traffic-byte measurements are unavailable.

FoxyProxy include/exclude URL rules are not part of the portable configuration.
BrowserMegaProxy reports their omission in the import review before applying the
connection profile to the whole browser. PAC entries are skipped.

Without a `browser` block in an updated Android profile, BrowserMegaProxy preserves
the existing local knock and domain exclusions. Unsupported imported Android settings
are discarded rather than stored in the browser. The current browser implementation
checks canonical version 8 imports and exports with a standalone validator generated
from the pinned schema; older versions are normalized by the legacy import parser.

## Unknown fields and import projection

If a receiving client encounters any fields it does not import, show one general
warning in the import review: **Configuration contains unknown fields.** The Russian
UI text is **Конфигурация содержит неизвестные поля**. Display it once per import,
regardless of the number of fields. Do not list field names, values or platforms.
This includes documented fields unsupported by that client and undocumented keys.
Unsupported fields are not imported, retained in storage or included in later exports.

Schema `additionalProperties: true` permits reading future documents; it does not
mean unknown fields should be retained. Validate structure first, then project the
configuration onto the receiving client's supported fields. Preserve common supported
fields, omitted-secret merge semantics, stable IDs and local order. Unsupported
transports are still reported as skipped profiles; removing jump or SSH fields must
never reinterpret a chain as a single HTTPS proxy.

BrowserMegaProxy discards Android-specific TLS, DNS, SSH, per-app routing, Always-on
and logging settings and presents the general warning. An Android client without
browser-field support must similarly discard `browser` objects and show the same
warning. Existing unmodified Android versions silently discard them; adding this
review behavior is a consumer migration requirement.

## Selective browser proxy routing

`browser.routing` is optional and browser-only. It does not change Android routing.
Omitting it keeps the existing behavior: all eligible requests use the active proxy.

| Field | Type / default | Meaning |
| --- | --- | --- |
| `enabled` | boolean, `false` | Enable selective routing. When false, all eligible requests use the active proxy. |
| `mode` | `domains` or `tabs`, default `domains` | Destination-domain routing (Chromium and Firefox) or tab-based split proxy (Firefox only). |
| `domains` | string array, default `[]` | Destination hostname patterns used in `domains` mode. |
| `sites` | string array, default `[]` | Top-level site hostname patterns selecting tabs automatically in `tabs` mode. |

The two lists are independent and survive mode switches. Each contains at most
1,000 patterns, each at most 253 characters. Exact hostnames match only themselves.
`**.example.com` matches both `example.com` and all its subdomains.
Other `*` patterns match zero or more characters, including dots: `*.example.com` matches
subdomains but not `example.com`; `example.*` matches several suffixes. Matches
cover the entire hostname and ignore case and a trailing dot. Wildcard patterns
use ASCII DNS labels; literal internationalized hostnames are normalized to IDNA
by the extension. Schemes, ports, paths and credentials are forbidden.
An enabled mode with an empty list connects directly.

In Firefox `tabs` mode, requests attributed to a selected tab use the proxy,
including frames, scripts and resources on other domains. Top-level navigation
and redirects re-evaluate the site's pattern. Requests without a tab connect
directly. Firefox's popup can override an individual tab and reload it; these
session-only choices last until the tab closes or routing settings change.
Browser tab IDs and manual overrides are never exported.

The popup can add the current hostname to the list for the current mode, enable
selective routing and reload that tab. Previously opened connections are not
migrated; reload affected tabs after changing routing settings. Local-network
and profile bypass rules have priority in both modes. Required knock requests
still use the proxy, and connection checks temporarily route their own traffic
through the active proxy without changing the saved lists.

Chromium has no tab-based routing UI. When importing a configuration whose
`browser.routing.mode` is `tabs`, it **must show an explicit warning** that Firefox
split proxy is unsupported in Chromium, ignore `sites`, switch to `domains`, and
use the supplied `domains` and `enabled` values. It must not turn `sites` into
proxy destination rules: that would change the meaning. An enabled empty domain
list therefore connects directly. The imported/exported Chromium configuration
contains the effective `domains` mode, not unsupported tab rules.

Suggested English warning: "This configuration uses Firefox split proxy by tab,
which Chromium does not support. Tab site rules will not be imported;
destination-domain routing will be used instead. An empty domain list connects
directly."

Chromium's PAC resolver has an additional platform restriction: localhost and
link-local addresses always bypass the proxy, even when `bypassLocalNetworks` is
false. Selective Chromium routing must describe this limitation in its UI and
must not claim such traffic was proxied. Other local ranges can still be proxied.
The ordinary, non-selective fixed-server mode can override the implicit bypass.
See [Chromium proxy documentation](https://chromium.googlesource.com/chromium/src/+/HEAD/net/docs/proxy.md#overriding-the-implicit-bypass-rules).

## Browser domain-list subscriptions

`browser.routing.subscriptions` is an optional browser-only object. It adds domain
lists from [itdoginfo/allow-domains](https://github.com/itdoginfo/allow-domains), the
same community source used by Podkop. Only domain entries are consumed; IP
addresses, CIDRs, URLs and invalid lines are ignored.

| Field | Default | Meaning |
| --- | --- | --- |
| `domainSources` | `[]` | Catalog IDs to add to destination-domain routing. |
| `siteSources` | `[]` | Catalog IDs to select Firefox tabs by top-level site. |
| `autoUpdate` | `true` | Refresh daily while the browser is running; retry failures hourly. |
| `throughProxy` | `false` | Fetch lists and popularity data through the active MegaProxy profile. Without an active profile this option fails, without direct fallback. |

The supported IDs are enumerated in the JSON schema. Sources are selected
independently for the two modes; selecting a source does not enable selective
routing automatically. Save preferences before using the manual update button.
A change in subscriptions triggers an update when auto-update is enabled. With
auto-update disabled, use the manual update button after import or source changes.

Normalize DNS names to lowercase IDNA and remove trailing dots. Generalize each
listed domain to a single `**.domain` rule covering itself and all subdomains.
Remove duplicates and descendants already covered by a listed ancestor.
Do not guess a registrable parent or expand to a parent missing from the source:
`a.example.com` alone becomes `**.a.example.com`, not `**.example.com`.
User-entered patterns remain separate and retain their existing semantics.

The effective limit is 1,000 rules per mode, including manual patterns. Manual
patterns take priority and are never trimmed by subscription updates. Rank the
remaining subscription domains by [Tranco](https://tranco-list.eu/), downloading
popularity data only when truncation is needed. Use the exact hostname's rank,
otherwise the nearest ranked parent with at least two labels. This is a coarse
proxy for popularity, especially for shared hosting and service subdomains.
Unranked domains follow ranked domains and use ASCII lexicographic order to make
selection reproducible; absence from the ranking does not prove unpopularity.
Warn explicitly with the number of dropped rules. Dropped domains connect
directly unless another routing rule selects them.

Tranco downloads normally use the third-party daily GitHub mirror
[wangmm001/tranco-top1m-cache](https://github.com/wangmm001/tranco-top1m-cache),
`data/current.version.txt` and `data/current.csv.gz`. Decompress gzip using the
browser's native `DecompressionStream`; validate the rank/domain CSV. If the
mirror fails, use the official `https://tranco-list.eu/top-1m-id` and
`https://tranco-list.eu/download/{id}/1000000` endpoints. If both fail, use cached
matching ranks or alphabetical order and show a ranking-unavailable warning.
Only complete, validated list updates replace the previous snapshot; any source
failure retains the last successful snapshot and shows an error. Downloads are
bounded to 4 MiB and 200,000 lines per domain source, 32 MiB of decompressed
ranking CSV, with a 30-second timeout per request.

Preferences are exported; cached lists, download errors, timestamps and ranking
intersections are local client data and are not exported. Import needs an update
to obtain the source contents. Chromium also warns explicitly and discards `sites` and `siteSources` if they
contain Firefox tab rules while `mode` is `domains`, preserving `domainSources`
and download preferences.

When updating through a proxy, do not inject proxy credentials into HTTP origin
headers; use the browser's proxy authentication. In Chromium, download routing
requires temporary host-based proxy settings and therefore also affects other
requests to the source hosts during the update. Restore the saved routing in
all success and failure paths. Chromium PAC's implicit localhost/link-local
bypass also applies during these temporary settings. Firefox can select the
transport for individual extension download requests. No user's browsing
history or custom domain list is uploaded to ranking providers: fetch the public
ranking and compare locally.

Tranco attribution: Victor Le Pochat, Tom Van Goethem, Samaneh Tajalizadehkhoob,
Maciej Korczynski, and Wouter Joosen (2019), *Tranco: A Research-Oriented Top Sites
Ranking Hardened Against Manipulation*, NDSS,
[doi:10.14722/ndss.2019.23386](https://doi.org/10.14722/ndss.2019.23386).
