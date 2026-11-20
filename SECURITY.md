# Security Policy

## Supported versions

Security fixes ship on the latest `main` commit.

## Reporting a vulnerability

Do not open a public GitHub issue for an unfixed vulnerability.

- Message us on Nostr at `npub1ckqlguq0htvs3smwy8pl5uwmfas0h208p7p8hs92ghaurgkmzzrsw3vlh0`, or
- Open a [private GitHub security advisory](https://github.com/smartflowsocial/smartflowsocial-blastr/security/advisories/new)

Include a description, steps to reproduce, impact, and a suggested fix if you have one.

## Scope

The Blastr worker, its configuration, and its dependencies are in scope. Cloudflare’s own infrastructure, the Nostr protocol, and third-party relays are out of scope unless the bug is in how Blastr integrates with them.

Publishing is gated by pubkey entitlement. Admin routes return 401 when `API_TOKEN` is unset. This service does not offer open public broadcasting.

## Response

- Initial response within 2 business days
- Status update within 7 days
- Public disclosure after a fix is available

We will credit you in the advisory unless you ask to stay anonymous.
