# Changelog

All notable changes to TaskNebula will be documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Governance documentation: `SECURITY.md`, `CODE_OF_CONDUCT.md`, `SUPPORT.md`, GitHub issue/PR templates, and `FUNDING.yml` placeholder.

## [0.2.6] - 2026-05-14

### Added
- **Integrations:** GitHub and Sentry OAuth flows, plus HMAC-signed outbound webhook delivery (Plane parity).
- **Admin:** Platform integration OAuth credentials form and feature-flag CRUD UI with runtime tests.
- **Templates:** Admin CRUD for project templates plus a use-template onboarding flow.
- **Drafts:** Database-backed drafts with a promote-to-project flow and a project-creation modal on the drafts list.
- **Invites & permissions:** New invite flow, refined permission model, and redesigned mail/notification surfaces.

### Changed
- **Project UI:** Minimized top bar, settings moved into a modal, and an icon-only views toolbar.
- **Schema:** Exposed new drafts and integration-client-credentials schemas in the barrel exports; consolidated journal entries.

### Fixed
- **Infra:** Expanded health checks, repaired the migration journal, and reduced log noise.
- **Infra:** More robust container healthchecks and a better memory-pressure signal.
- **Auth:** Added `forgot-password`, `reset-password`, and `verify-email` to middleware public routes.
- **Templates:** Moved `getTemplateAuthz` out of `route.ts` so Next.js route exports stay valid; escaped quotes in the new-template dialog.
- **Automation:** Escaped apostrophe in the automation manager toast.

### Removed
- The standalone "New work item" button (superseded by inline creation affordances).

## [0.2.0] - 2026-03

### Added
- Initial public preview of TaskNebula: kanban boards, real-time updates, and keyboard-first navigation.
- [See git log] for the full list of pre-0.2.6 changes.

## [0.1.0] - 2026-01

### Added
- Internal alpha release. [See git log] for details.

[Unreleased]: https://github.com/neuraparse/tasknebula/compare/v0.2.6...HEAD
[0.2.6]: https://github.com/neuraparse/tasknebula/releases/tag/v0.2.6
[0.2.0]: https://github.com/neuraparse/tasknebula/releases/tag/v0.2.0
[0.1.0]: https://github.com/neuraparse/tasknebula/releases/tag/v0.1.0
