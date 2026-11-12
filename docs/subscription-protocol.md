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
Only list endpoints trusted to receive that pair. Redirects cannot add credential
recipients. BrowserMegaProxy and AndroidMegaProxy permit a trusted subscription to replace
its source URLs as documented below.
Pause disables scheduled checks for the whole subscription. **Update now** still performs
one refresh while paused, without enabling automatic updates. Record which source supplied a successful
snapshot and show failures when all sources fail; keep the previous snapshot
in that case. Failover selects a configuration source, not an active proxy.

A missing `subscription` in a manual import preserves the existing subscription;
explicit null removes it. An omitted password preserves the saved password only
for the same normalized URL and username. An empty password clears it. Changed
URLs or usernames in an ordinary manual import must not inherit old credentials.
The source-replacement flow below deliberately retains its local
credential pair when the source URLs change. Exported subscription passwords
follow the password export preference; query tokens in URLs remain sensitive even
when passwords are omitted. Subscription credentials, profile ownership and refresh
status stay local rather than automatically joining browser-account sync.

Clients without subscription support may ignore this additive field. AndroidMegaProxy
supports the same root definition and validates it in its version 8 schema.
BrowserMegaProxy also allows the user to subscribe while importing a remote URL;
exporting the resulting settings produces the same root property.

## Subscription source replacement

Clients allow a trusted canonical configuration to update its own
subscription source list. On bootstrap from a URL, a root `subscription` object
may replace the dialog's source URLs while retaining the credentials and update
preferences supplied in that dialog. Subsequent refreshes use the same rule:

- A valid root `subscription` object replaces the primary URL and the complete
  `fallbackUrls` list. Omitting `fallbackUrls` clears the previous backup list.
- Missing `subscription`, or `subscription: null` in a refresh, keeps the current
  source list. Only explicit manual import/settings removal unsubscribes.
- Local Basic Auth, interval and enabled/pause state remain unchanged. Credentials,
  interval and enabled state inside the downloaded object do not override them.
- Validate and apply the source change atomically with the profiles. A malformed
  source definition or failed update retains the previous working configuration.
- The next refresh starts from the new primary URL. The retained local Basic Auth
  pair is sent to the replacement URLs, so a source operator can choose new
  credential recipients. Subscribe only to operators trusted with this authority.

Android and browser refreshes use the same source-replacement rules. Ordinary manual
import of a subscription continues to use the same-URL/account omitted-password rule above.

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
repeat `subscription`. Downloaded credentials, interval and enabled flag never
replace the corresponding local subscription preferences. Clients may replace
source URLs using the rules above.

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
selected profile while it still exists, including no selection. If that selected profile disappears, use
the downloaded `activeProfileId` as a preferred replacement when it names an
importable profile, otherwise select the first importable profile in snapshot
order. The field already exists in version 8; no new preference field is needed.
Do not switch away from a surviving local selection or silently leave Direct/System.
Importing the initial bootstrap does not authorize automatic connection. Prefer stable MegaProxy IDs and ZeroOmega names. Without stable IDs,
BrowserMegaProxy reuses a uniquely matching name, then a unique type/host/port
endpoint; ambiguous or completely changed profiles receive new local IDs.

Apply explicitly supplied supported settings represented by the source format.
Canonical MegaProxy snapshots preserve omitted supported preferences, including
partially supplied nested objects and per-profile options. Explicit false values and empty arrays replace their settings.
Formats without application preferences leave them unchanged. Omitted exported passwords retain
saved credentials according to ordinary import semantics; explicit empty values
clear them. Unsupported profiles and fields produce warnings while supported
content applies. If no usable profiles remain, preserve the previous snapshot.
Validate and apply atomically; persistence or native proxy-setting failures roll
back the update. Failed updates must not remove working profiles or disconnect
an otherwise unchanged active connection.

## Client application and runtime behavior

The protocol is shared by all clients. Platform APIs, storage encryption, scheduling,
notification permissions and applying live connections are owned by each application.
No platform-specific settings schema is defined by this protocol.

1. Download the primary source, then backups in order. Manual refresh works while
   paused; background refresh does not. Keep the previous working state on failure.
2. Validate the supported configuration and ID references. Project onto supported
   common fields and the receiver's own platform section. Report discarded fields
   and fingerprint resets in the refresh status; do not log names, credentials or
   contents of discarded fields. A warning does not invalidate otherwise usable profiles.
3. Update matching canonical IDs and track subscription ownership. Remove only
   missing profiles previously owned by the subscription. Keep unrelated local IDs.
   A matching canonical ID identifies the same profile; replacing it adopts that ID.
   Legacy formats reconcile only unique matches among previously owned profiles.
4. Apply only supplied supported preferences, preserving omitted nested values.
   Preserve local source credentials, interval and pause state when replacing URLs.
5. Preserve the selected profile if it survives, including a null selection, and
   preserve Direct/System/Proxy mode, connection intent and startup settings.
   If a selected profile disappears, prefer the imported active ID, otherwise the
   first importable profile. Import is not authorization to connect or configure startup.
6. Commit settings, profiles, ownership and successful-source status atomically.
   If local subscription settings change during a download, discard the stale result.
7. Compare effective network settings. A change to active connection settings needs
   a visible indication of how to apply it. A tunnel client may keep the established
   tunnel and request reconnect; a browser may apply settings to new requests.
   Neither may claim to migrate already established streams. Metadata-only changes
   do not require reconnection. Failed refreshes leave a working connection intact.
8. Keep ownership, timestamps, warning state and connection notices local; do not
   export them. Notification permission or delivery failure must not prevent refresh.

Each client documents its stable X-MegaProxy-Client identifier and supported legacy
formats. Windows uses `windows`; runtime scheduling may be delayed while the client
or its service is not running. Its established tunnel uses the applied settings
until reconnect. Platform permissions cannot be granted through a downloaded file.

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
