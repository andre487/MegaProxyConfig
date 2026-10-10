# MegaProxy configuration distribution protocol

This protocol distributes configuration snapshots over HTTPS. It uses ordinary
HTTP GET and optional Basic Auth; it does not require a dedicated server, registry,
custom URI scheme or WebDAV. A static HTTPS file server with access control is
sufficient. The portable document format remains version 8: this specification
defines its delivery and update behavior, not a new proxy transport.

## Bootstrap and subscription settings

Import a complete MegaProxy configuration containing the root `subscription`
property once. Subsequent background updates use these persisted settings:

```json
{
  "schema": "net.megaproxy487.config",
  "version": 8,
  "subscription": {
    "url": "https://configs.example.com/team.json",
    "fallbackUrls": ["https://backup.example.com/team.json"],
    "username": "reader",
    "password": "example",
    "intervalMinutes": 60,
    "enabled": true
  },
  "profiles": [
    {
      "id": "team-proxy",
      "name": "Team proxy",
      "proxy": { "type": "HTTPS", "host": "proxy.example.com", "port": 443 }
    }
  ]
}
```

Only `url` is required. It must be an absolute HTTPS URL without userinfo or a
fragment, at most 2,048 characters. `intervalMinutes` is an integer from 1 through
10,080, default 60; `enabled` is a boolean, default true. The optional Basic Auth
`username` and `password` are separate from proxy credentials, at most 1,024
characters each. A username cannot contain a colon or control characters; a
password cannot contain control characters. URL and credential semantics require
consumer checks in addition to JSON Schema validation. Unknown subscription keys
follow the ordinary import policy: ignore and discard them with one general
unknown-fields warning; known keys remain strictly typed.

Optional `fallbackUrls` adds up to seven backup HTTPS URLs. Every URL follows the
same validation rules; reject duplicate normalized URLs, including the primary.
On each refresh, start with `url`, then try backups in their configured order if
downloading, validating or applying the earlier snapshot fails. Stop at the first
successful import, including imports with supported-format warnings. Do not fetch
or combine remaining sources. The next scheduled or manual refresh starts with
the primary again, allowing recovery without editing the subscription.

The Basic Auth credential pair is shared by all explicitly configured sources.
Only list endpoints trusted to receive that pair. Redirects and subscription
settings inside downloaded documents cannot add credential recipients. Pause
disables scheduled checks for the whole subscription. **Update now** still performs
one refresh while paused, without enabling automatic updates. Record which source supplied a successful
snapshot and show failures when all sources fail; keep the previous snapshot
in that case. Failover selects a configuration source, not an active proxy.

A missing `subscription` in a manual import preserves the existing subscription;
explicit null removes it. An omitted password preserves the saved password only
for the same normalized URL and username. An empty password clears it. Changed
URLs or usernames must not inherit old credentials. Exported subscription passwords
follow the password export preference; query tokens in URLs remain sensitive even
when passwords are omitted. Subscription credentials, profile ownership and refresh
status stay local rather than automatically joining browser-account sync.

Clients without subscription support may ignore this additive field. AndroidMegaProxy
supports the same root definition and validates it in its version 8 schema.
BrowserMegaProxy also allows the user to subscribe while importing a remote URL;
exporting the resulting settings produces the same root property.

## Request and authentication

The client sends GET to the configured URL, with no request body, cookies or
referrer. It verifies the TLS certificate and rejects redirects, including HTTPS
to HTTPS; publish the final endpoint URL. It never copies subscription credentials
into proxy authentication or destination website requests.

With neither credential field present, omit Authorization. Otherwise encode
`username:password` as UTF-8 and Base64; a missing counterpart is an empty string.
For the example above, the request contains:

```http
GET /team.json HTTP/1.1
Host: configs.example.com
X-MegaProxy-Client: browser_chromium
X-MegaProxy-Version: 1.1.1
Authorization: Basic cmVhZGVyOmV4YW1wbGU=
```

Clients send `X-MegaProxy-Client` to identify the client implementation. The
BrowserMegaProxy values are `browser_chromium` for Chromium-based browsers and
`browser_firefox` for Firefox, including Firefox for Android. Use the same value
on primary and backup requests, manual imports and automatic updates. Other
clients should document their own stable identifier. This value identifies the
implementation; it does not carry a per-installation or per-user identifier.

Clients also send `X-MegaProxy-Version` with their installed application version.
BrowserMegaProxy reads it from `runtime.getManifest().version`; it is the extension
version, not the browser version or configuration schema version. Both headers
are sent for each source and retry. They contain no per-installation identifier.

Servers may select a compatible format or profile subset using these headers and
should provide a suitable default for clients omitting it. If the response varies
by client ID or version, send `Vary: X-MegaProxy-Client, X-MegaProxy-Version` and scope conditional validators to
the selected representation. The header is not an authentication mechanism;
protected feeds still require their configured credentials.

Protected endpoints authenticate every request, including conditional requests.
An invalid or missing credential produces 401 with
`WWW-Authenticate: Basic realm="MegaProxy", charset="UTF-8"`.
This protocol selects UTF-8 explicitly; legacy Basic deployments may use a
different encoding. Basic encodes credentials rather than encrypting them, so TLS
is mandatory. See [HTTP Basic authentication, RFC 7617](https://www.rfc-editor.org/rfc/rfc7617.html).

## Response formats

A successful response is 200 with a complete UTF-8 snapshot. MegaProxy version 8
JSON is the canonical representation, served as `application/json`. The snapshot
must pass schema, unique-ID, reference and client-capability checks. It need not
repeat `subscription`; downloaded subscription settings must not silently replace
the locally configured URL list, credentials or enabled flag.

Clients may additionally accept formats supported by their manual importer. No
extra envelope or conversion API is required: use the existing format's body and
its usual limitations. BrowserMegaProxy accepts the following:

| Body | Imported settings | Limits |
| --- | --- | --- |
| MegaProxy JSON | Supported proxy fields, browser preferences and routing | Unsupported transports and platform-specific fields are reported; stable IDs are required in canonical v8. |
| ZeroOmega JSON | Compatible fixed profiles, bypasses and supported hostname routing | PAC execution, arbitrary rules, chains and independent per-scheme endpoints are unsupported. |
| FoxyProxy JSON | Compatible profiles, credentials and supported profile metadata | FoxyProxy-wide settings and pattern/PAC semantics are not imported. |
| SuperProxy JSON | Compatible proxy profiles and supported profile fields | VPN, per-app and mobile-specific settings are not imported. |
| ProxyList text | Supported proxy URIs, credentials and supported URI metadata | No application preferences or routing settings; use `text/plain`. |

The client detects the format from the body. HTTP media types are descriptive;
HTML login pages and unsupported payloads must fail validation. Format support
never grants permission to evaluate remote scripts. Empty or wholly unsupported
snapshots are failures, not requests to delete all local profiles.

## Applying a snapshot

Import automatically after bootstrap, then on the configured interval. Background
suspension can delay execution; persist state and refresh overdue subscriptions on
restart. Provide pause, manual refresh, last success, successful source and visible error/warning state.

Replace subscription-owned profiles and remove those absent from the next valid
snapshot. Keep separately added profiles. Preserve local connection mode and the
selected profile while it still exists. If that selected profile disappears, use
the downloaded `activeProfileId` as a preferred replacement when it names an
importable profile, otherwise select the first importable profile in snapshot
order. The field already exists in version 8; no new preference field is needed.
Do not switch away from a surviving local selection or silently leave Direct/System.
Importing the initial bootstrap does not authorize automatic connection. Prefer stable MegaProxy IDs and ZeroOmega names. Without stable IDs,
BrowserMegaProxy reuses a uniquely matching name, then a unique type/host/port
endpoint; ambiguous or completely changed profiles receive new local IDs.

Replace every setting represented by the source format. Canonical MegaProxy
snapshots reset omitted supported browser preferences to defaults. Formats without
application preferences leave them unchanged. Omitted exported passwords retain
saved credentials according to ordinary import semantics; explicit empty values
clear them. Unsupported profiles and fields produce warnings while supported
content applies. If no usable profiles remain, preserve the previous snapshot.
Validate and apply atomically; persistence or native proxy-setting failures roll
back the update. Failed updates must not remove working profiles or disconnect
an otherwise unchanged active connection.

## Android update behavior

AndroidMegaProxy sends `X-MegaProxy-Client: android` and its installed app version
in `X-MegaProxy-Version`. Subscription credentials and URL query tokens are stored
with Android Keystore encryption. Settings, ownership and status remain local and
are excluded from Android backup. JSON exports include only the portable definition;
its password follows **Include passwords**, while URL query tokens remain present.

Settings provides primary and up to seven backup HTTPS URLs, separate optional
Basic Auth, interval, pause, **Update now**, last success, successful source index
and warning/error status. Importing a canonical configuration with `subscription`
bootstraps ownership of its imported profiles; configuring a new subscription in
Settings initially owns no existing profiles. A conflicting canonical ID belonging
to a separate local profile fails that source, preserving the local profile.
Legacy imports reconcile only previously owned profiles by unique name, then
unique type/host/port. Supported bodies are the same as Android manual imports:
MegaProxy JSON, FoxyProxy JSON, ProxyList and SuperProxy text. ZeroOmega JSON is
not supported. Downloaded subscription definitions do not replace local settings.
Changing or removing local settings while downloading invalidates that download.

Android schedules persisted, network-constrained one-shot JobScheduler checks.
The first check is due immediately; subsequent checks use the configured interval,
including intervals below the periodic-job minimum. Android battery/background
restrictions can delay execution. Restart schedules an overdue missing job;
pausing cancels scheduled checks and manual refresh remains available.
Each refresh downloads full snapshots, starts at the primary and tries each
source once. Requests use a 15-second connect/read timeout and a 45-second read
budget, with a 4 MiB decoded-body limit and strict UTF-8. TLS verification is
mandatory, redirects and non-200 responses are rejected, and no conditional cache
is used. Downloads follow the Android VPN routing policy for the app; when the
app is excluded from per-app VPN routing, downloads use its ordinary network.
They do not bypass the VPN or enable a disconnected VPN automatically.

Snapshots commit profiles, imported preferences, ownership, selection and status
as one storage transaction. Failure retains the previous configuration. Selection,
Always-on selection and runtime connection profile are preserved while present;
removed selections use the downloaded `activeProfileId`, then the first imported
profile. Separately added profiles remain and omitted profile secrets follow the
normal import-preservation rules. Canonical snapshots replace supported global
preferences, resetting omitted preferences to Android defaults; text/FoxyProxy
snapshots leave global preferences local. The connection-desired flag is never
changed, so bootstrap does not authorize a VPN connection.

Android keeps an established tunnel on its existing native configuration.
A successful update that changes its effective connection settings marks the
existing **Reconnect** action and shows a notice in subscription settings.
The user reconnects to apply it; an update never tears down a working tunnel or
claims that its stored snapshot has already migrated live connections. Inactive
profile metadata and identical effective settings do not create a reconnect notice.
No system notification permission is requested for subscription updates.

## Browser update algorithm

BrowserMegaProxy applies the following algorithm to scheduled configuration checks
and the **Update now** action in its settings and popup:

1. Keep the persisted subscription definition and previous working state. A manual
   refresh may run while paused; scheduled checks may not. Download sources in order
   under the existing timeout, size, authentication and redirect rules.
2. Parse with the ordinary importer. Validate known fields, supported transports
   and canonical profile references. Discard unknown/unsupported fields with the
   same compatibility warnings as manual import. A malformed or wholly unsupported
   snapshot fails this source and leaves the previous state intact.
3. Reconcile subscription-owned profiles using stable IDs, or the documented unique
   matching rules for legacy formats. Preserve separately added profiles; remove
   only absent profiles owned by this subscription.
4. Replace settings represented by the format. Keep the locally configured
   subscription URLs, authentication, interval and pause state. Reset omitted
   supported MegaProxy browser preferences according to snapshot semantics.
5. Preserve the local selected profile if it survives, regardless of a different
   downloaded `activeProfileId`. If a previously selected profile disappears, choose
   the importable downloaded `activeProfileId`, then the first importable snapshot
   profile, then the first remaining local profile. The latter is only a defensive
   fallback: empty/wholly unsupported snapshots must already have failed validation.
   With no profile available, retain no selection. Do not connect automatically if
   there was no previous selection; preserve the local Proxy/Direct/System mode.
6. Compare the previous and new effective connection settings. This includes the
   selected profile ID, protocol, endpoint, authentication, knock host, exclusions
   and MASQUE template, local-network bypass and the active routing mode/patterns.
   Name, color, country and inactive-profile edits do not require a connection notice.
7. Apply the new native proxy/privacy settings and persist the new configuration
   as one transaction. Failure rolls back the configuration and native settings;
   it must not mark a failed snapshot as successful or emit a success notice.
8. Restart authentication/knock preparation when the selected proxy or credentials
   changed, cancel obsolete authentication dialogs, and invalidate connection-check
   results when effective connection settings changed. Retain saved routing choices.
9. When a previously active connection changed, persist a local connection-update
   notice. Show it in popup/settings and mark the toolbar with `!`. Optionally show
   a system notification through the browser's notifications API, only with an
   explicitly granted optional permission. Notification failure must not roll back
   or block an otherwise successful configuration update. Include no credentials
   or configuration body in notices. Identical effective settings do not notify.
10. Store last success, import warnings and successful source, then stop source
    failover. Schedule the next check only when automatic checks remain enabled.
    If every source fails, retain the working state and show the download/import
    failure for the next scheduled or manual retry.

Firefox reads the current state in `proxy.onRequest` for subsequent requests, so
profile and routing changes are used without restarting the extension or browser.
Existing streams and connections are not migrated: reload affected pages. See
[Firefox proxy.onRequest](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/proxy/onRequest).

Chromium applies new native proxy/PAC settings immediately. The extension API does
not provide a general command to migrate or close every established browser
connection or reset all native proxy authentication state. BrowserMegaProxy therefore
asks users to restart the browser to ensure all open connections use the updated
configuration; it does not claim that new connections must wait for that restart.
See the [Chromium proxy API](https://developer.chrome.com/docs/extensions/reference/api/proxy)
and [notifications API](https://developer.chrome.com/docs/extensions/reference/api/notifications).
The notice can be acknowledged and is cleared at browser startup; service-worker
suspension/restart alone does not acknowledge it. Notification permission and local
notice state are not imported, exported or synchronized through the config contract.

The same effective-settings comparison applies when Podkop lists refresh. Download
and validate lists first, compute the rules for the active routing mode/strategy,
apply native settings and persist the new snapshot, then invalidate checks and notify
if those rules changed while a proxy was active. A catalog-only refresh, identical
lists, inactive routing lists or Direct/System do not produce a connection notice.
A failed list/native-setting/persistence update retains the working list snapshot
and reports its failure. Temporary routing used to download lists must be restored
in all paths and is not itself a user configuration change. Legacy Firefox tab routing without an explicit strategy combines downloaded
`siteSources` and manual site patterns. Explicit `tabs` remains a manual strategy
and does not download or activate those inactive subscription sources.

## HTTP errors and optional conditional downloads

| Result | Client action |
| --- | --- |
| 200 | Bound the decoded body, validate, then apply the snapshot. |
| 304 | Keep the cached valid snapshot, only if a corresponding conditional request was made. |
| 3xx | Reject; require a final URL configured by the user. |
| 401 / 403 | Keep the previous snapshot and report authentication/access failure. |
| 404 / 410 | Keep the previous snapshot and report an unavailable source. |
| 429 | Keep the previous snapshot; clients may honor Retry-After. |
| 5xx / network or TLS error | Keep the previous snapshot; bounded retries may use exponential backoff. |
| Other status, malformed or unsupported body | Keep the previous snapshot and report failure. |

After trying every configured source, automatic failures retry on the configured schedule; avoid indefinite retry loops
or unprompted interactive authentication dialogs. Apply a request timeout and a
limit to decoded bytes even without Content-Length. BrowserMegaProxy uses its
ordinary import download limits and retries; other clients may impose their own
bounds. A server should publish modest snapshots and replace files atomically.

ETag/If-None-Match and Last-Modified/If-Modified-Since are optional optimizations.
A client implementing them associates validators with a successfully validated,
applied snapshot and its URL/authentication/client-ID/client-version context. Do not accept 304 without
such a snapshot, or save a validator for a failed import. Authenticate before
returning 304; never serve a different user's cached configuration. Authenticated
responses should use private cache policy. See
[HTTP conditional requests and status codes, RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html).

BrowserMegaProxy currently downloads full snapshots and does not send conditional
validators. Servers must support unconditional GET even when they offer ETags.

## Publishing and checking a feed

Serve a file through an HTTPS server such as Caddy or nginx, optionally protected
with Basic Auth. Each URL represents one complete configuration; no listing,
account-management or write API is required. Do not log Authorization or export
real credentials into public examples. A compromised source can change proxy and
routing settings: users must trust its operator.

Check an authenticated endpoint without placing its password in shell history;
this command prompts for it:

```sh
curl --fail --user reader https://configs.example.com/team.json
```

Keep this protocol's delivery semantics when serving legacy bodies. Their source
applications' own PAC updates, cloud synchronization or URI import mechanisms are
separate features and do not imply support for this subscription protocol.
