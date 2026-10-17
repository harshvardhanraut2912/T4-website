# CETWALLE DOCX → PDF converter setup

Your existing `lib/pdfgen/convert.js` already supports Gotenberg. This package only updates that file to report converter HTTP errors more clearly and reject non-PDF responses. It does not deploy a converter for you.

## 1. You need a separate server

Gotenberg is a Docker-based PDF conversion service. It does not run inside a normal Vercel serverless function. Use a VM or a managed Docker/container host. The machine should have at least 512 MiB RAM and 0.2 CPU as a starting point; image-heavy exam documents may need more.

Official install guide: https://gotenberg.dev/docs/getting-started/installation
Official DOCX conversion endpoint: https://gotenberg.dev/docs/convert-with-libreoffice/convert-to-pdf

## 2. Install Docker on an Ubuntu VM

Follow Docker's official Ubuntu installation guide: https://docs.docker.com/engine/install/ubuntu/

Then start Gotenberg on the VM, bound to localhost (not directly exposed to the public internet):

```bash
docker run -d \
  --name cetwalle-gotenberg \
  --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  gotenberg/gotenberg:8
```

Check it:

```bash
docker ps
docker logs --tail 50 cetwalle-gotenberg
```

Important: the localhost-only binding is secure but is not reachable directly from Vercel. Configure a secure HTTPS reverse proxy/gateway with authentication or private networking supported by your host. Do not expose an unauthenticated Gotenberg service to the public internet. Do not use the public demo for confidential exam papers.

## 3. Test the deployed HTTPS endpoint

Once you have secured the endpoint, test with a sample DOCX (not a real exam paper):

```bash
curl --fail-with-body \
  -X POST "https://YOUR-CONVERTER-HOST/forms/libreoffice/convert" \
  -F "files=@sample.docx" \
  -o sample.pdf
```

Replace `YOUR-CONVERTER-HOST` with the real host you configured. `sample.pdf` should open as a PDF. The API expects multipart form data with the file field named `files`.

## 4. Add Vercel environment variables

In Vercel → your CETWALLE project → Settings → Environment Variables:

- `PDF_CONVERTER_URL` = `https://YOUR-CONVERTER-HOST`
  - Use only the base URL, e.g. `https://pdf.example.com`; the code appends `/forms/libreoffice/convert`.
  - You may also supply the full endpoint `https://pdf.example.com/forms/libreoffice/convert`.
- `PDF_CONVERTER_TOKEN` = optional secret token, only if your HTTPS gateway is configured to accept `Authorization: Bearer <token>`.
  - The token must be configured to match on the gateway side. Merely adding this variable does not add authentication to Gotenberg itself.

Set the variables for Production (and Preview if needed), save, and redeploy. Do not prefix these variables with `NEXT_PUBLIC_` and never expose the token to browser code.

## 5. Test CETWALLE

Generate Student Copy and Teacher Copy. If it fails, inspect Vercel function logs and the converter logs. A 401/403 usually means gateway authentication/access rules; 502/503 often means the converter is unavailable; a timeout can mean the service is overloaded or unreachable.

## Notes

- OMR and leaderboard generators are not changed.
- The existing Word/DOCX generation and exam route are not changed.
- This patch improves diagnostics; actual PDF conversion will only work after the separate Gotenberg service is deployed and reachable.
