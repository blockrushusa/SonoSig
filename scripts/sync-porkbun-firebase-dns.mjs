#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DOMAIN = process.env.PORKBUN_DOMAIN || "sonosig.com";
const API_BASE = "https://api.porkbun.com/api/json/v3";

const FIREBASE_RECORDS = {
  apexA: "199.36.158.100",
  ownershipTxt: "hosting-site=sonosig-dotcom",
  acmeTxt: "8IHy_r99-B_iQojnuFwPGRon3ZEOM-3fH8-S42GJutw",
};

const FIREBASE_EMAIL_RECORDS = [
  {
    type: "TXT",
    name: DOMAIN,
    createName: "",
    content: "v=spf1 include:_spf.firebasemail.com ~all",
  },
  {
    type: "TXT",
    name: DOMAIN,
    createName: "",
    content: "firebase=sonosig-dotcom",
  },
  {
    type: "CNAME",
    name: `firebase1._domainkey.${DOMAIN}`,
    createName: "firebase1._domainkey",
    content: "mail-sonosig-com.dkim1._domainkey.firebasemail.com.",
  },
  {
    type: "CNAME",
    name: `firebase2._domainkey.${DOMAIN}`,
    createName: "firebase2._domainkey",
    content: "mail-sonosig-com.dkim2._domainkey.firebasemail.com.",
  },
];

const STALE_APEX_A = new Set(["44.230.85.241", "52.33.207.7"]);

function loadEnvFile(path) {
  let contents;

  try {
    contents = readFileSync(path, "utf8");
  } catch {
    return;
  }

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=").replace(/^["']|["']$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));

const auth = {
  apikey: process.env.PORKBUN_API_KEY,
  secretapikey: process.env.PORKBUN_API_SECRET,
};

if (!auth.apikey || !auth.secretapikey) {
  console.error("Missing PORKBUN_API_KEY or PORKBUN_API_SECRET.");
  process.exit(1);
}

async function porkbun(path, body = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...auth, ...body }),
  });
  const payload = await response.json();

  if (payload.status !== "SUCCESS") {
    throw new Error(payload.message || JSON.stringify(payload));
  }

  return payload;
}

async function getRecords() {
  const payload = await porkbun(`/dns/retrieve/${DOMAIN}`);
  return payload.records || [];
}

function isRelevant(record) {
  const emailRecordNames = new Set(FIREBASE_EMAIL_RECORDS.map((item) => item.name));

  return (
    ["A", "ALIAS", "TXT", "CNAME", "MX"].includes(record.type) &&
    (record.name === DOMAIN ||
      record.name === `_acme-challenge.${DOMAIN}` ||
      record.name === `*.${DOMAIN}` ||
      emailRecordNames.has(record.name))
  );
}

function shouldDelete(record) {
  if (record.name === DOMAIN && record.type === "ALIAS") {
    return true;
  }

  if (
    record.name === DOMAIN &&
    record.type === "A" &&
    STALE_APEX_A.has(record.content)
  ) {
    return true;
  }

  if (
    record.name === `_acme-challenge.${DOMAIN}` &&
    record.type === "TXT" &&
    record.content !== FIREBASE_RECORDS.acmeTxt
  ) {
    return true;
  }

  if (
    record.name === DOMAIN &&
    record.type === "TXT" &&
    record.content.startsWith("v=spf1 ") &&
    record.content !== FIREBASE_EMAIL_RECORDS[0].content
  ) {
    return true;
  }

  return false;
}

function hasRecord(records, type, name, content) {
  return records.some(
    (record) =>
      record.type === type &&
      record.name === name &&
      normalizeDnsContent(record.content) === normalizeDnsContent(content),
  );
}

function normalizeDnsContent(content) {
  return String(content).replace(/\.$/, "");
}

async function sync() {
  const before = await getRecords();
  const deletions = before.filter(shouldDelete);
  const deleted = [];

  for (const record of deletions) {
    await porkbun(`/dns/delete/${DOMAIN}/${record.id}`);
    deleted.push(pickRecord(record));
  }

  const afterDelete = await getRecords();
  const created = [];

  if (!hasRecord(afterDelete, "A", DOMAIN, FIREBASE_RECORDS.apexA)) {
    const result = await porkbun(`/dns/create/${DOMAIN}`, {
      type: "A",
      content: FIREBASE_RECORDS.apexA,
      ttl: "600",
    });
    created.push({
      id: result.id,
      type: "A",
      name: DOMAIN,
      content: FIREBASE_RECORDS.apexA,
    });
  }

  if (!hasRecord(afterDelete, "TXT", DOMAIN, FIREBASE_RECORDS.ownershipTxt)) {
    const result = await porkbun(`/dns/create/${DOMAIN}`, {
      type: "TXT",
      content: FIREBASE_RECORDS.ownershipTxt,
      ttl: "600",
    });
    created.push({
      id: result.id,
      type: "TXT",
      name: DOMAIN,
      content: FIREBASE_RECORDS.ownershipTxt,
    });
  }

  if (
    !hasRecord(
      afterDelete,
      "TXT",
      `_acme-challenge.${DOMAIN}`,
      FIREBASE_RECORDS.acmeTxt,
    )
  ) {
    const result = await porkbun(`/dns/create/${DOMAIN}`, {
      name: "_acme-challenge",
      type: "TXT",
      content: FIREBASE_RECORDS.acmeTxt,
      ttl: "600",
    });
    created.push({
      id: result.id,
      type: "TXT",
      name: `_acme-challenge.${DOMAIN}`,
      content: FIREBASE_RECORDS.acmeTxt,
    });
  }

  for (const record of FIREBASE_EMAIL_RECORDS) {
    if (hasRecord(afterDelete, record.type, record.name, record.content)) {
      continue;
    }

    const result = await porkbun(`/dns/create/${DOMAIN}`, {
      ...(record.createName ? { name: record.createName } : {}),
      type: record.type,
      content: record.content,
      ttl: "600",
    });
    created.push({
      id: result.id,
      type: record.type,
      name: record.name,
      content: record.content,
    });
  }

  const finalRecords = await getRecords();

  printJson({
    domain: DOMAIN,
    deleted,
    created,
    records: finalRecords.filter(isRelevant).map(pickRecord),
  });
}

async function check() {
  const records = await getRecords();
  const relevant = records.filter(isRelevant).map(pickRecord);
  const missing = [];

  if (!hasRecord(records, "A", DOMAIN, FIREBASE_RECORDS.apexA)) {
    missing.push({ type: "A", name: DOMAIN, content: FIREBASE_RECORDS.apexA });
  }

  if (!hasRecord(records, "TXT", DOMAIN, FIREBASE_RECORDS.ownershipTxt)) {
    missing.push({
      type: "TXT",
      name: DOMAIN,
      content: FIREBASE_RECORDS.ownershipTxt,
    });
  }

  if (
    !hasRecord(records, "TXT", `_acme-challenge.${DOMAIN}`, FIREBASE_RECORDS.acmeTxt)
  ) {
    missing.push({
      type: "TXT",
      name: `_acme-challenge.${DOMAIN}`,
      content: FIREBASE_RECORDS.acmeTxt,
    });
  }

  for (const record of FIREBASE_EMAIL_RECORDS) {
    if (!hasRecord(records, record.type, record.name, record.content)) {
      missing.push({
        type: record.type,
        name: record.name,
        content: record.content,
      });
    }
  }

  printJson({ domain: DOMAIN, missing, records: relevant });
}

function pickRecord({ id, type, name, content, ttl, prio }) {
  return { id, type, name, content, ttl, prio };
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

const command = process.argv[2] || "check";

if (!["check", "sync"].includes(command)) {
  console.error("Usage: node scripts/sync-porkbun-firebase-dns.mjs [check|sync]");
  process.exit(1);
}

try {
  if (command === "sync") {
    await sync();
  } else {
    await check();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
