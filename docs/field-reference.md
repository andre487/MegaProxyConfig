# Shared field reference

Types, limits and enums are defined by [the schema](../schemas/megaproxy-v8.schema.json).
Platform sections are intentionally absent from this inventory; their applications
own their validation and documentation.

| Object | Shared fields |
| --- | --- |
| Document | schema, version, profiles, activeProfileId, passwordsIncluded, privateKeysIncluded, tls, ssh, routing, failover, diagnosticLogLimitMb, subscription |
| Profile | id, name, color, countryCode, proxy, tls, dns, routing |
| Proxy | type, host, port, username, password, privateKey, allowInvalidProxyCertificate, sshProfile, trustedHostKey, acceptAnyHostKey, jump, preferHttp2, preferHttp3, knockHost |
| Jump | host, port, sameAuthentication, username, password, privateKey, trustedHostKey, acceptAnyHostKey, allowInvalidProxyCertificate |
| TLS | fingerprint, customJa3 |
| SSH | fingerprint, authMode, keepaliveSeconds, maxChannels, rotationMinutes, rotationMb |
| DNS | provider, customDohUrl |
| Routing | bypassLocalNetworks; profile allowIpv6; root systemAllowIpv6 |
| Failover | mode, profileIds |
| Subscription | url, username, password, intervalMinutes, enabled, fallbackUrls |

Unsupported shared fields are reported and discarded, just like foreign platform
extensions. Presence in the schema does not guarantee implementation in every client.
MTU and traffic display units may be exported in the owning platform section.
Runtime caches, subscription ownership/status, downloaded updates, signatures,
permissions and trust approvals are local state, not portable configuration.
