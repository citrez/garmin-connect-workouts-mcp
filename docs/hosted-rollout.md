# Hosted web/mobile edition: prerequisites and application brief

Status: **not deployed**. The maintainer has not yet obtained Garmin Developer
Program approval or selected a hosting account/domain. Local desktop packages are
available independently. This document is a plan, not an implemented remote service.

## First external dependency: Garmin Training API access

Garmin's official Training API allows consenting users to send workouts and training
plans to Garmin Connect for device sync. Garmin documents an approval step and uses
OAuth 2.0 across its Developer Program APIs. The program is for business use; the
applicant must supply truthful business details and decide whether this project
qualifies. No application or agreement has been submitted on the user's behalf.

- [Training API](https://developer.garmin.com/gc-developer-program/training-api/)
- [Program overview/application entry](https://developer.garmin.com/gc-developer-program/)
- [Program FAQ](https://developer.garmin.com/gc-developer-program/program-faq/)

### Application brief ready to adapt

**Project:** Garmin Workouts, maintained at
https://github.com/citrez/garmin-connect-workouts-mcp.

**Purpose:** Allow a person to describe a running, cycling or swimming session in
an AI assistant and, after reviewing/authorizing it, send a structured workout and
an optional scheduled date to their own Garmin Connect account.

**Requested integration:** Training API access for workout publication and calendar
scheduling. Confirm the approved API's read/update/delete capabilities and scopes
before promising the desktop tool set in a hosted edition. Health measurements,
activity-history access and other unrelated scopes are not requested for this use case.

**Account connection:** Garmin-hosted OAuth authorization and consent. The service
would not collect Garmin passwords or ask users to paste cookies into a conversation.
Users would be able to disconnect and revoke the service's saved connection.

**Details the applicant must supply:** legal/business identity and contact,
commercial use case, intended audience/scale, and any information Garmin requests.
After approval, obtain the provider's actual endpoint/scope documentation and
application credentials; keep secrets outside Git and chat.

## Hosting decisions needed after approval

Choose a provider account and HTTPS domain. Prepare a privacy policy, support
contact, credential-encryption key management and a budget. Do not open a paid
account or accept provider terms automatically.

The hosted implementation will need:

- A Streamable HTTP MCP endpoint, client authorization/discovery appropriate to
  ChatGPT and Claude, and tenant identity derived from verified client tokens.
- A separate Garmin OAuth connection per user, validated state/redirects and the
  provider's documented refresh/revocation flow.
- Encrypted credential storage, strict tenant separation, log redaction and an
  explicit disconnect/delete path.
- Typed workout translation against Garmin's approved schemas, validation of scopes
  and capability differences, and no automatic retries of ambiguous writes.
- Integration tests with the approved provider's test access, two separate users,
  revoked tokens, expired sessions, rate limits and calendar publication.
- Deployment and operational checks on the chosen host, then tests through both
  ChatGPT and Claude's actual remote connector flows.

The current desktop browser-cookie adapter has not been deployed as a shared public
service. Garmin approval, API credentials, provider documentation and a selected
host are required before the hosted account flow can be implemented and validated.
