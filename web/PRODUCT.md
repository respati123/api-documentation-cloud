# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React, TypeScript, Vite, Tailwind CSS v4, and shadcn/ui on Base UI. Already in the repository; the redesign keeps this stack.

## Users

Two groups with equal weight:

- Members who read shared API contracts, endpoints, descriptions, response structures, and examples.
- Workspace managers (owners and editors) who invite members, change roles, and review activity.

Owners, editors, and viewers all sign in to the same portal.

## Product Purpose

The portal lets a team read the API documentation that is committed from the desktop app and manage who can access the workspace. The user's main value is that the documentation shown here is the version the team last committed, so readers do not have to ask which version is current.

## Positioning

Current documentation for a team, pulled from the source of truth (the desktop app's commits). It is not a live editor: changes are made in the desktop app, committed, and then shown here.

## Operating Context

- Primary device: desktop browser. Mobile must still be usable, but it is not the reference layout.
- Readers scan an endpoint list, open one endpoint, and compare request and response structures.
- Managers work through workspace settings: members, invitations, roles, and activity.
- Sync state (last commit, pending pull) must be visible where it affects what the reader is looking at.

## Capabilities and Constraints

- Keep every route and URL that is already shared. Links must keep working after the redesign.
- Keep the sign-in flow and the workspace flow in the same order: sign in, pick a workspace, then read or manage it.
- Every visible text exists in Indonesian (`id`) and English (`en`).
- Error messages from the backend are shown as the backend sends them.
- Roles are owner, editor, and viewer. Owners can invite members.
- Sync is commit based. Live editing and branches are not supported, so the UI must never suggest them.

## Brand Commitments

The product name shown in the interface is API Documentation. No other brand requirements were confirmed.

## Evidence on Hand

Existing source code, the repository's AGENTS.md rules, and the desktop app's PRODUCT.md. No customer claims, testimonials, or brand assets were supplied.

## Product Principles

- Shared contracts are easy to find and easy to understand.
- Readers and managers are both first-class: neither flow is hidden behind the other.
- Sync and workspace state are shown clearly where a decision depends on them.
- The portal and the desktop app are recognizably one product, while the portal stays focused on reading and access.

## Accessibility & Inclusion

Inferred from `web/AGENTS.md` and not yet confirmed by the user: keyboard navigation and visible focus on every interactive element, and layouts that still fit when Indonesian text runs longer than English.
