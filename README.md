# HubSpot Associated Job Notes Card

HubSpot project-based custom app / UI extension for Distinctive Outdoor Structures. The card appears on **Contact** records and displays notes from associated Jobs.

> In the DOS HubSpot portal, **Job is the renamed label for HubSpot's native Deal object**. This project intentionally uses HubSpot `DEAL` / `deals` object APIs and does not create or assume a custom Job object. Job ID equals Deal ID / `hs_object_id`.

## What the card does

- Adds a Contact record card titled **Associated Job Notes**.
- Loads all native HubSpot Deals associated with the current Contact.
- Shows an empty state when no associated Deals/Jobs exist.
- Auto-selects the only associated Job when exactly one exists.
- Shows a Deal-name dropdown when multiple Jobs exist.
- Loads notes associated with the selected Deal/Job.
- Displays notes newest first with date/time, body, and owner name when available.
- Provides actions to open the selected Job/Deal record and refresh card data.

## Project structure

```text
hsproject.json
src/app/app-hsmeta.json
src/app/cards/associated-job-notes-card-hsmeta.json
src/app/cards/AssociatedJobNotesCard.jsx
src/app/functions/get-associated-jobs-hsmeta.json
src/app/functions/getAssociatedJobs.js
src/app/functions/get-job-notes-hsmeta.json
src/app/functions/getJobNotes.js
docs/local-testing-and-deployment.md
```

## Backend functions

### `getAssociatedJobs`

Input:

```json
{ "contactId": "123" }
```

Output:

```json
{
  "success": true,
  "jobs": [
    {
      "id": "456",
      "dealname": "Example Job",
      "pipeline": "default",
      "dealstage": "appointmentscheduled",
      "createdate": "2026-01-01T00:00:00.000Z",
      "closedate": null
    }
  ]
}
```

### `getJobNotes`

Input:

```json
{ "dealId": "456" }
```

Output:

```json
{
  "success": true,
  "notes": [
    {
      "id": "789",
      "hs_note_body": "Example note",
      "hs_timestamp": "2026-01-02T00:00:00.000Z",
      "hubspot_owner_id": "101112",
      "ownerName": "Jane User",
      "createdate": "2026-01-02T00:00:00.000Z",
      "updatedate": "2026-01-02T01:00:00.000Z"
    }
  ]
}
```


### Serverless packaging note

HubSpot project serverless function entrypoints are packaged independently in this deployment path, so `getAssociatedJobs.js` and `getJobNotes.js` intentionally inline their HubSpot API helper logic. Do not refactor these functions to `require('./hubspotApi')` unless HubSpot confirms sibling helper modules are bundled for this project runtime.

## Security

- The React card calls HubSpot serverless functions only.
- The frontend does **not** contain or expose private app tokens.
- Serverless functions use HubSpot's built-in `PRIVATE_APP_ACCESS_TOKEN` for static-auth project apps.
- The app requests read-only scopes plus the required OAuth scope group:
  - `oauth`
  - `crm.objects.contacts.read`
  - `crm.objects.deals.read`
  - `crm.objects.owners.read`
- `crm.objects.notes.read` is intentionally not requested because HubSpot does not recognize it for this project app configuration. HubSpot's Notes API documentation currently lists `crm.objects.contacts.read` or `crm.objects.contacts.write` as sufficient for notes API access, and this app already requests the read-only contact scope.

## Local testing and deployment

See [`docs/local-testing-and-deployment.md`](docs/local-testing-and-deployment.md) for dependency installation, validation, `hs project dev`, upload, install, and Contact record card setup instructions.
