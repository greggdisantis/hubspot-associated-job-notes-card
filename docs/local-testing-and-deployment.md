# Local testing and deployment

## Prerequisites

1. Install the HubSpot CLI and authenticate it:

   ```bash
   npm install -g @hubspot/cli@latest
   hs account auth
   ```

2. Confirm the CLI can see the target developer or production HubSpot account:

   ```bash
   hs accounts list
   ```

3. This project targets the HubSpot developer platform version in `hsproject.json` and uses a private, static-auth project app. The serverless functions read HubSpot data with HubSpot's built-in `PRIVATE_APP_ACCESS_TOKEN` secret after the app is uploaded and installed.

## Local dependency installation

Install project component dependencies from the repository root:

```bash
hs project install-deps
```

If you prefer installing directly with npm:

```bash
npm install --prefix src/app/cards
npm install --prefix src/app/functions
```

## Validate the serverless JavaScript locally

The functions depend on HubSpot runtime context for real API calls, but you can at least verify syntax from the repository root:

```bash
node --check src/app/functions/hubspotApi.js
node --check src/app/functions/getAssociatedJobs.js
node --check src/app/functions/getJobNotes.js
```

## Upload and install

1. Upload the project to HubSpot:

   ```bash
   hs project upload
   ```

2. In HubSpot, open the project component for `dos_associated_job_notes_app`.
3. Use the Distribution tab to install the app into the target portal or a developer test account.
4. During installation, approve these read-only scopes:
   - `crm.objects.contacts.read`
   - `crm.objects.deals.read`
   - `crm.objects.notes.read`
   - `crm.objects.owners.read`

## Add the card to Contact records

1. Open a Contact record in HubSpot.
2. Customize the middle-column record view.
3. Add the app card named `Associated Job Notes` from the app card library.
4. Save the Contact record view.

## Develop and preview

Run the local development server from the repository root:

```bash
hs project dev
```

Use the local development panel to preview the Contact card. Frontend changes are reflected by the local dev flow; serverless function changes should be uploaded with `hs project upload` before retesting deployed backend behavior.

## Functional test checklist

- Open a Contact with no associated Deals and confirm the card shows `No associated jobs found for this contact.`
- Open a Contact with one associated Deal and confirm it auto-selects that Deal/Job.
- Open a Contact with multiple associated Deals and confirm the dropdown lists Deal names.
- Select a Deal/Job and confirm notes load newest first.
- Confirm `Open job record` opens the selected native HubSpot Deal record.
- Confirm `Refresh` and `Refresh notes` reload the card data without exposing any access token in frontend code.
