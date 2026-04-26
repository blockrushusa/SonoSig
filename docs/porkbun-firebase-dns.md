# Porkbun Firebase DNS Script

`scripts/sync-porkbun-firebase-dns.mjs` manages the Porkbun DNS records Firebase Hosting needs for `sonosig.com`.

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
- Adds `sonosig.com A 199.36.158.100`.
- Adds `sonosig.com TXT hosting-site=sonosig-dotcom`.
- Adds the current Firebase ACME TXT record for `_acme-challenge.sonosig.com`.
- Preserves Porkbun mail forwarding MX records and the SPF TXT record.

## Domain Override

The script defaults to `sonosig.com`. Override it with:

```bash
PORKBUN_DOMAIN=example.com node scripts/sync-porkbun-firebase-dns.mjs check
```

Only use the override if the Firebase DNS constants in the script also match that domain.
