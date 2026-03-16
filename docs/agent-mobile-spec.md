# Agent Mobile App Spec

## Goal

Turn this repo into a separate mobile app focused on the job-portal agent experience, without affecting the previous candidate app.

## Product Scope

The mobile app should prioritize the active agent dashboard flows that already exist on the web app:

- Overview
- Profile
- Candidates
- Candidate detail
- Candidate workspace
- Chat
- Analytics
- Settings

The hidden standalone agent Applications and Documents pages should not be first-phase priorities.

## Recommended Mobile Navigation

### Auth stack

- Get started
- Agent login
- Agent signup
- Forgot password

### Main tabs

- Overview
- Candidates
- Chat
- Analytics
- Settings

### Nested stacks

- Overview stack
  - Overview home
  - Candidate quick actions when surfaced from dashboard cards
- Candidates stack
  - Candidate list
  - Candidate detail
  - Add candidate
  - Edit candidate
  - Candidate workspace
- Chat stack
  - Chat list
  - Chat room
- Analytics stack
  - Analytics dashboard
  - Detailed analytics filters/export entry points if needed later
- Settings stack
  - Settings home
  - Change password
  - Delete account confirmation
  - Agent profile edit if we want it grouped here instead of a dedicated profile tab

### Candidate workspace inside the agent app

This should behave like an agent tool, not a full second app.

- Candidate workspace home
- Candidate overview
- Candidate profile edit
- Candidate applications
- Candidate documents
- Candidate saved jobs
- Candidate meetings
- Candidate tasks
- Apply to job on behalf of candidate

## Backend Scope

### Auth

Existing signup supports agent creation with:

- `userType=agent`
- `companyName`
- `companyAddress`
- `contactPerson`
- optional `companyLogo`

Login response should be normalized to keep:

- token
- user type
- verification status
- company metadata

### Agent features to support

- Agent overview dashboard
- Agent profile read/update
- Managed candidates CRUD
- Candidate document upload
- Candidate workspace mode
- Analytics dashboard
- Chat with admin
- Change password
- Delete account

### Job actions to support

- Browse jobs
- View job detail
- Apply on behalf of a managed candidate
- Use `agentPrice` where job pricing is shown for the agent flow

## Current Mobile App Reuse Map

### Likely reusable with adaptation

- Shared auth shell and token storage
- Chat screens
- Meetings screens
- Tasks screens
- Documents upload patterns
- Profile form patterns
- Generic API client and upload helpers
- Theme and UI primitives

### Needs major refactor

- Main tab navigation is still candidate-oriented
- Jobs/applications flow assumes direct candidate usage
- Inquiry flow is candidate-oriented and currently mismatched with backend
- Auth signup payload is too small for the agent form
- Models are missing agent, analytics, managed candidate, and candidate-workspace types

### Likely removable or de-prioritized in phase 1

- Candidate invoices flow
- Candidate direct applications tab
- Candidate inquiry-first navigation

## Known Backend Risks

### Endpoint duplication

Agent candidate endpoints appear to exist under both:

- `/api/agent/*`
- `/api/users/agent/*`

We should standardize which family the mobile app uses before implementing too many screens.

### Inquiry mismatch

There is a likely mismatch between:

- frontend calling `/api/agent/inquiries`
- backend route found at `/api/users/agent/inquiries`
- controller expecting `candidateId`

Recommendation:

- treat agent inquiries as blocked until the backend contract is confirmed
- do not make inquiries a core tab for phase 1

### Managed candidate mode

The web app uses local state and localStorage to enter managed candidate mode. On mobile, this should become explicit app state with a selected candidate context inside the agent app rather than a web-style route hack.

## Recommended Implementation Phases

### Phase 1

- Separate app identity from the previous app
- Rebrand auth for agents
- Replace candidate tab structure with agent tab structure
- Build overview, candidates, chat, analytics, settings shells
- Add managed candidate context and candidate workspace navigation

### Phase 2

- Implement managed candidate CRUD
- Implement candidate workspace modules
- Implement job browsing and agent-on-behalf apply flow
- Implement profile editing and account settings

### Phase 3

- Resolve inquiry backend mismatch
- Add export and advanced analytics actions
- Add polish, testing, and store-ready branding

## Data Models Needed

The mobile app will need dedicated types for:

- Agent profile
- Managed candidate summary
- Managed candidate detail
- Agent overview metrics
- Analytics dashboard payload
- Candidate workspace context
- Agent chat contact/message

## Open Inputs Needed Before App Separation

Before changing the mobile app identity, we still need:

- new app name
- new package ID
- new API base URL

Once those are provided, we can safely update the Expo config, deep link scheme, native package IDs, storage keys, and environment config for the new app.
