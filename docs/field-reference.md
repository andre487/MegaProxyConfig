# Portable field reference

This inventory covers the named object properties in the version 8 shared schema.
Types, limits, defaults and enums are authoritative in
[`megaproxy-v8.schema.json`](../schemas/megaproxy-v8.schema.json); behavior and
platform restrictions are described in [configuration](configuration.md) and
[subscription delivery](subscription-protocol.md). Android's schema is the subset
without browser-only definitions. Unknown keys are not an extension mechanism for
round-tripping: consumers report and discard unsupported settings.

| Schema object | Declared keys |
|---|---|
| `#` | `schema`, `version`, `passwordsIncluded`, `privateKeysIncluded`, `activeProfileId`, `alwaysOnProfileId`, `diagnosticLogLimitMb`, `tls`, `ssh`, `failover`, `routing`, `profiles`, `browser`, `subscription` |
| `profile` | `id`, `name`, `color`, `countryCode`, `proxy`, `tls`, `dns`, `routing`, `browser` |
| `proxy` | `type`, `host`, `port`, `username`, `password`, `privateKey`, `allowInvalidProxyCertificate`, `sshProfile`, `trustedHostKey`, `acceptAnyHostKey`, `jump`, `preferHttp3`, `knockHost` |
| `jump` | `host`, `port`, `sameAuthentication`, `username`, `password`, `privateKey`, `trustedHostKey`, `acceptAnyHostKey`, `allowInvalidProxyCertificate` |
| `tls` | `fingerprint`, `customJa3` |
| `routing` | `bypassLocalNetworks`, `routeAllApps`, `selectedPackages`, `allowIpv6` |
| `dns` | `provider`, `customDohUrl` |
| `ssh` | `fingerprint`, `authMode`, `keepaliveSeconds`, `maxChannels`, `rotationMinutes`, `rotationMb` |
| `failover` | `mode`, `profileIds` |
| `browserProfile` | `knockHost`, `bypass`, `authMode`, `masqueTemplate` |
| `browserRouting` | `enabled`, `mode`, `domains`, `sites`, `subscriptions`, `assignments`, `strategy` |
| `browserSubscriptions` | `domainSources`, `siteSources`, `autoUpdate`, `throughProxy` |
| `configSubscription` | `url`, `username`, `password`, `intervalMinutes`, `enabled`, `fallbackUrls` |

| `#.browser` | `theme`, `language`, `routing`, `webRTC` |
| `browserRouting.assignments[]` | `domain`, `profileId`, `includeSubdomains` |

Android transfers the document/profile TLS and routing settings, SSH settings,
failover, diagnostic log limit, profile selections, DNS, credentials, proxy trust,
jump settings, HTTP/3 preference and shared knock host. Per-profile TLS/routing
values remain profile data even where the running connection uses global settings.
Browser clients transfer their supported proxy fields, shared knock host and browser
settings, including routing assignments/domain-list subscriptions and WebRTC policy.
Unsupported transport types must be reported rather than converted.

Password/private-key export choices omit secret keys, not merely their values.
Custom DoH URL query tokens and subscription Basic Auth credentials are sensitive
export data; the password checkbox is not a general anonymization operation.
Consumers preserve omitted secrets only according to the documented identity and
subscription merge rules. An explicit empty supported value clears its setting.

The following Android settings intentionally stay local: MTU; source-application
validation enablement and level; traffic counters; UI language and traffic
units; update source/schedule/consent; DNS security approvals; Keystore state;
resolved addresses; subscription ownership/status/generation; runtime/reconnect
state and caches. Browser experimental MASQUE enablement and browser permissions
are local too. Import cannot grant a platform permission or a DNS security exception.

Legacy import formats contain subsets of this contract and cannot preserve every
setting. Use version 8 JSON for complete supported settings. Browser-only metadata
is discarded by Android except the legacy knock-host alias; Android-only settings
are discarded by browsers with the documented notice. A field appearing in the
schema does not make an unsupported feature operational on a client.
