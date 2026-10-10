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
consumer checks in addition to JSON Schema validation.

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
applies to the whole subscription. Record which source supplied a successful
snapshot and show failures when all sources fail; keep the previous snapshot
in that case. Failover selects a configuration source, not an active proxy.

A missing `subscription` in a manual import preserves the existing subscription;
explicit null removes it. An omitted password preserves the saved password only
for the same normalized URL and username. An empty password clears it. Changed
URLs or usernames must not inherit old credentials. Exported subscription passwords
follow the password export preference; query tokens in URLs remain sensitive even
when passwords are omitted. Subscription credentials, profile ownership and refresh
status stay local rather than automatically joining browser-account sync.

Clients without subscription support may ignore this additive field. The Android
baseline accepts it as an unknown root field but does not implement updates.
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
Authorization: Basic cmVhZGVyOmV4YW1wbGU=
```

Clients send `X-MegaProxy-Client` to identify the client implementation. The
BrowserMegaProxy values are `browser_chromium` for Chromium-based browsers and
`browser_firefox` for Firefox, including Firefox for Android. Use the same value
on primary and backup requests, manual imports and automatic updates. Other
clients should document their own stable identifier. This value identifies the
implementation; it does not carry a per-installation or per-user identifier.

Servers may select a compatible format or profile subset using this header and
should provide a suitable default for clients omitting it. If the response varies
by client ID, send `Vary: X-MegaProxy-Client` and scope conditional validators to
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
selected profile while it still exists; never connect a downloaded active profile
silently. Prefer stable MegaProxy IDs and ZeroOmega names. Without stable IDs,
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
applied snapshot and its URL/authentication/client-ID context. Do not accept 304 without
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
