# Porkbun Firebase DNS Script

`scripts/sync-porkbun-firebase-dns.mjs` manages the Porkbun DNS records Firebase Hosting and Firebase Auth email templates need for `sonosig.com`.

## Requirements

Add these credentials to `.env.local`:

```bash
PORKBUN_API_KEY=
PORKBUN_API_SECRET=
```

Porkbun API access must also be enabled for the domain in the Porkbun account.

## Check Records

```bash
node scripts/sync-porkbun-firebase-dns.mjs check
```

This prints the relevant DNS records and any missing Firebase records.

## Sync Records

```bash
node scripts/sync-porkbun-firebase-dns.mjs sync
```

The sync command:

- Removes the Porkbun parking apex `ALIAS`.
- Removes stale Firebase Hosting apex A records `44.230.85.241` and `52.33.207.7` if present.
- Removes stale `_acme-challenge` TXT records.
- Replaces stale apex SPF TXT records with the Firebase email SPF record.
- Adds `sonosig.com A 199.36.158.100`.
- Adds `sonosig.com TXT hosting-site=sonosig-dotcom`.
- Adds the current Firebase ACME TXT record for `_acme-challenge.sonosig.com`.
- Adds `sonosig.com TXT v=spf1 include:_spf.firebasemail.com ~all`.
- Adds `sonosig.com TXT firebase=sonosig-dotcom`.
- Adds `firebase1._domainkey.sonosig.com CNAME mail-sonosig-com.dkim1._domainkey.firebasemail.com.`.
- Adds `firebase2._domainkey.sonosig.com CNAME mail-sonosig-com.dkim2._domainkey.firebasemail.com.`.
- Preserves Porkbun mail forwarding MX records and unrelated TXT records.

## Domain Override

The script defaults to `sonosig.com`. Override it with:

```bash
PORKBUN_DOMAIN=example.com node scripts/sync-porkbun-firebase-dns.mjs check
```

Only use the override if the Firebase DNS constants in the script also match that domain.
