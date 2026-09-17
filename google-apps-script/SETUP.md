# Shared auction JSON setup

1. Open https://script.google.com and create a new project.
2. Replace its `Code.gs` with this folder's `Code.gs`.
3. In **Project Settings → Script properties**, add `AUCTION_SYNC_SECRET` with a long random value.
4. Choose **Deploy → New deployment → Web app**.
5. Execute as **Me** and allow access to **Anyone**. The secret still protects the data.
6. Copy the `/exec` deployment URL.
7. In Render, add these environment variables:
   - `GOOGLE_APPS_SCRIPT_URL`: the `/exec` URL
   - `AUCTION_SYNC_SECRET`: the same random value
   - `ADMIN_PASSWORD`: the password used by the admin panel
8. Redeploy the Render service, open the admin page, and sign in once. The shared JSON file will be created automatically in Google Drive.

For the team spreadsheet, publish the sheet as XLSX and use columns named `Team Name` and `Logo`. The Logo value can be a publicly shared Google Drive image link or a direct HTTPS image URL.
