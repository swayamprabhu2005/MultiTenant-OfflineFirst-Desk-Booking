# ADR-013: Implement Hybrid Authentication with Microsoft Entra ID SSO

## Status

Accepted

## Date

2026-09-21

## Context

Enterprise tenants require Single Sign-On (SSO) integration with their corporate Identity Provider (IdP) — predominantly Microsoft Entra ID (formerly Azure Active Directory) — allowing staff to authenticate using corporate credentials without managing separate passwords.

Key requirements:
1. **Multi-Tenant Compatibility**: Different organizations authenticate through their corporate Microsoft accounts while retaining strict tenant data isolation.
2. **Hybrid Coexistence**: Both traditional email/password and Microsoft Entra SSO must coexist harmoniously. Small teams without Microsoft 365 can use password authentication, while enterprise tenants use SSO.
3. **Zero External Passwords**: SSO employees must not have passwords stored in the application database.
4. **Access Control Safeguard**: Authentication via Microsoft only confirms identity; authorization to enter the application requires that the corporate email exists in the organization's database roster.

## Decision

We will implement a **hybrid authentication architecture** supporting both native password authentication and OpenID Connect (OIDC) / OAuth 2.0 via Microsoft Entra ID:

- **Protocol**: OAuth 2.0 Authorization Code grant with OpenID Connect (`openid profile email User.Read`).
- **Endpoints**:
  - `GET /api/auth/sso/microsoft`: Redirects to `login.microsoftonline.com/common/oauth2/v2.0/authorize`.
  - `GET /api/auth/sso/callback`: Exchanges authorization code for tokens, extracts verified email, checks the multi-tenant database for an active employee record, and issues an application JWT.
  - `POST /api/auth/sso/sandbox`: Developer and demonstration simulation endpoint for offline/sandbox testing.
- **Tenant Scope Resolution**: Upon successful callback, the user record determines their `organizationId`, `role`, and `scopedBranchId`, ensuring they land in the exact dashboard corresponding to their privileges.
- **Frontend UI**: A dedicated "Sign in with Microsoft (Entra SSO)" button with Microsoft branding rendered above the traditional login form, separated by a clean divider.

## Consequences

- **Positive**: Enterprise-ready frictionless onboarding — employees with Microsoft 365 accounts sign in with a single click without remembering or changing temporary passwords.
- **Positive**: Enhanced security posture — no passwords stored or managed for SSO users, delegating credential validation and multi-factor authentication (MFA) to Microsoft.
- **Positive**: Backward compatible — existing password-based users and administrators continue to log in without disruption.
- **Negative**: Requires configuration of Microsoft Entra ID app credentials (`AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`, `AZURE_REDIRECT_URI`) in environment files.
