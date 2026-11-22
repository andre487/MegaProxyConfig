# Portable configuration version 9

## Common document

Require `schema: "net.megaproxy487.config"`, `version: 9` and 1–1,000 profiles.
Accept the legacy schema identifier `dev.megaproxy.config`. Profile IDs are stable,
unique, nonempty strings of at most 256 characters. Applied ID references must
resolve to a profile; semantic validation belongs to consumers, beyond JSON Schema.
Names, color indices, uppercase two-letter country codes and array order describe
profile appearance. Existing local order is retained during merge; new IDs append.

Common types are HTTPS, HTTPS_JUMP, SSH, SSH_JUMP, SOCKS5 and MASQUE. Never silently
convert an unsupported protocol or flatten a jump chain. Report unsupported profiles.
Host is a hostname or IP literal without scheme/path/port; ports are 1–65535.
Jump profiles require a separate host/port and optionally independent credentials;
`sameAuthentication` defaults to true. SOCKS5 usernames may contain colons; HTTP
Basic usernames cannot. SOCKS5 credentials must fit its 255-byte UTF-8 wire limit.
The schema defines the other lengths, types and allowed values.

`proxy.preferHttp2` and `proxy.preferHttp3` are optional booleans for HTTPS transports.
HTTP/3 preference includes HTTP/2 fallback where supported. Clients must explain
unsupported transport preferences rather than silently promise their application.
`proxy.knockHost` is shared; the legacy profile browser knockHost is read only when
the shared key is absent, including when the shared key is explicitly empty.

## Platform extensions

An application may define a platform-named object at document or profile level.
The owning application validates and documents its fields, versions and semantics.
The common schema does not enumerate platforms or validate their inner settings.
Use `android`, `browser`, `windows`, or another unambiguous platform name as needed.

### Deprecated Android paths

New Android configurations use the version 1 `android` section. The following
legacy paths remain valid in v8 and v9 files and subscriptions.

| Deprecated path | Android replacement |
| --- | --- |
| `alwaysOnProfileId` | `android.alwaysOnProfileId` |
| `routing.routeAllApps`, `routing.selectedPackages` | `android.routing.routeAllApps`, `android.routing.selectedPackages` |
| `profiles[].routing.routeAllApps`, `profiles[].routing.selectedPackages` | `profiles[].android.routing.routeAllApps`, `profiles[].android.routing.selectedPackages` |
| `tls.fingerprint`, `tls.customJa3` | `android.tls.fingerprint`, `android.tls.customJa3` |
| `ssh.fingerprint`, `ssh.keepaliveSeconds`, `ssh.maxChannels`, `ssh.rotationMinutes`, `ssh.rotationMb` | Same field names under `android.ssh` |

Android resolves each field independently. A supplied Android value wins, including
`false`, zero and an empty package list. A missing field falls back to its legacy
path. An unsupported Android section version is ignored at its own scope. Other
clients may still consume legacy paths. Package names identify Android apps only.

`diagnosticLogLimitMb`, `ssh.authMode` and `routing.bypassLocalNetworks` remain
shared. Profile TLS fields keep their existing meaning, including the separate
QUIC JA3 in `profiles[].tls.customJa3`.

Foreign sections and unknown fields are not retained for later export. Show one
general import notice without exposing their names or values, then project onto
supported fields. A future unsupported version of the local platform section must
also be ignored as a whole; none of its settings may execute indirectly.

## TLS, SSH, DNS and routing

Document-level `tls.fingerprint` is deprecated. Existing documents remain valid.
Android writes `android.tls.fingerprint` in its version 1 section and reads the
legacy field when the Android preset is absent. The value `default` selects the
current application default, including after updates.

Use the shared TLS identifiers DEFAULT, CHROME_ANDROID, FIREFOX_ANDROID,
EDGE_ANDROID, RANDOMIZED, SAMSUNG_INTERNET, YANDEX_BROWSER and CUSTOM. These names
are portable identifiers, not a promise of identical wire bytes across TLS stacks.
Clients apply supported presets, reset unsupported ones to DEFAULT and notify the
user. DEFAULT resolves to the client's current default and may change on update.
Custom JA3 requires semantic and transport-specific validation. Global TLS settings
select the preset; profile TLS fields may carry transport-specific custom data.
Do not replace global TLS JA3 with a per-profile QUIC JA3.

SSH supports the shared fingerprint identifiers and AUTO/PASSWORD_ONLY/KEY_ONLY
authentication. Implemented connection settings must affect the connection; unsupported
ones must be reported. Client-specific SSH key-verification policy must be documented.
Import must not imply enforcement of a host key that a client does not verify.

DNS uses a named provider or `customDohUrl` with HTTPS DoH, TCP or UDP. Plain DNS
endpoints require numeric IPs and an optional port. Clients document transport
limits, DNS routing and local security approvals; importing a file cannot grant
permissions or local trust approvals. Query tokens may be sensitive export data.

Shared routing includes `bypassLocalNetworks` (default true), profile
`profiles[].routing.allowIpv6` and root `routing.systemAllowIpv6` (both default
false). The profile option permits IPv6 destinations through that proxy; the
root option permits IPv6 destinations through the system connection. These are
independent of the address family used to connect to the proxy itself.
An omitted root option leaves the current setting unchanged during import.
Clients without a separate system route may ignore the system option.

Windows enables IPv6 on its TUN only when all used Internet routes permit it:
proxy-only needs the active profile option, system-only needs the root option,
and mixed routing needs both. Disabled rules are ignored; an unconditional
all-applications/all-destinations rule terminates routing before the default.
Block rules, internal core bypass and local-network bypass do not add an
Internet route. No automatic uplink detection is used. Reconnect after changes.
No import disables the operating system's IPv6. Application selection remains
a platform extension.

Failover modes are DISABLED, SELECTED and ALL, with unique profile IDs. Clients
document candidate ordering and supported failure conditions. Authentication and
certificate failures must not silently bypass the selected proxy.

## Import, merge and export

Validate before committing atomically. Replace matching IDs, append new IDs and
retain missing local profiles unless removal was explicitly selected. Absent
supported options retain their current values; false and empty arrays apply.
Manual import never authorizes connection by itself.

Omitted passwords/private keys retain existing secrets only when protocol, normalized
host, port and username match. Shared jump authentication requires both endpoints
to match; independent jump secrets use the jump identity. Explicit empty strings
clear secrets. Missing subscription passwords follow the same URL/account rule.
Credentials must never migrate to a replacement recipient.

Provide visible password and private-key export choices before saving. Default
checkbox states are client policy and must be accurately documented; an opt out
must be available. Set passwordsIncluded/privateKeysIncluded accordingly. Omit
secret keys when excluded. Files are not encrypted; query tokens are not removed
by the password checkbox. Unknown fields must not carry hidden tokens into export.

Export current common settings, not stale copies retained from a prior import.
Do not write contradictory common/platform copies of the same supported setting.
For settings that remain shared, the common field takes precedence over a legacy
platform alias. Android precedence for migrated fields is documented above. Platform-only choices stay in the owning section.

Clients may also import legacy MegaProxy versions, FoxyProxy, ProxyList or SuperProxy
subsets. These formats cannot carry all settings. Document supported formats and
warn about skipped entries. Prefer v9 JSON for complete supported transfer.

Configuration refresh behavior is defined in [subscription-protocol.md](subscription-protocol.md).
Application update packages and their installer/store mechanisms are outside this configuration contract.
