# Audio SIWE Watermark Specification (v1)

## 1. Overview

This specification defines a method to embed a **robust, non-removable watermark** into an audio file that links the audio to a **SIWE (Sign-In With Ethereum) attestation**.

The system is designed to:

* Survive metadata stripping
* Survive lossy compression (MP3, AAC)
* Bind audio content to a wallet identity
* Enable deterministic, offline-verifiable proofs

---

## 2. Architecture

```
Audio File
  └── Embedded Watermark (small payload, robust)

External Attestation (off-audio)
  ├── SIWE Message (EIP-4361)
  ├── Signature
  ├── Wallet Address
  ├── Audio Fingerprint
  └── Metadata (timestamps, revocation)
```

---

## 3. Design Principles

* **Do NOT embed full SIWE signature in audio**
* **Embed only a compact identifier**
* **Store full proof externally**
* **Bind via audio fingerprint**
* **Prioritize robustness over payload size**

---

## 4. Watermark Payload Specification

### 4.1 Binary Structure

| Field          | Size       | Description              |
| -------------- | ---------- | ------------------------ |
| Magic Prefix   | 4 bytes    | ASCII `"SIWE"`           |
| Version        | 1 byte     | `0x01`                   |
| Attestation ID | 8–16 bytes | Unique identifier        |
| Checksum       | 4 bytes    | CRC32 of preceding bytes |
| Reserved       | Optional   | Future use               |

---

### 4.2 Encoded Example

```
SIWE1:7F3K9Q2D:b7d9c0e4
```

---

### 4.3 JSON Representation (Reference Only)

```json
{
  "v": 1,
  "id": "siwe_7F3K9Q2D",
  "chk": "b7d9c0e4"
}
```

---

## 5. External Attestation Format

The full SIWE proof MUST be stored externally (IPFS, HTTPS endpoint, or database).

```json
{
  "type": "siwe-audio-attestation",
  "version": 1,
  "attestation_id": "siwe_7F3K9Q2D",
  "wallet": "0x...",
  "chain_id": 1,
  "siwe_message": "...",
  "signature": "0x...",
  "audio_fingerprint": "sha256:...",
  "created_at": "2026-04-24T19:00:00Z",
  "expires_at": null,
  "revoked": false
}
```

---

## 6. Audio Fingerprinting

### 6.1 Requirements

Fingerprint MUST:

* Represent audio content only (no metadata)
* Be deterministic
* Be stable across encoding formats where possible

---

### 6.2 Recommended Methods

* SHA-256 of normalized PCM audio
* Chromaprint (AcoustID-style)
* Spectral hash

---

### 6.3 Canonicalization Process

Before hashing:

1. Decode audio to PCM
2. Normalize sample rate (e.g., 44.1kHz)
3. Normalize amplitude
4. Strip silence if required (optional but consistent)

---

## 7. Watermark Embedding

### 7.1 Technique

Use **spread-spectrum watermarking**:

* Encode bits across frequency bins using FFT
* Distribute bits pseudo-randomly (seeded)
* Keep signal below perceptual threshold

---

### 7.2 Requirements

Watermark MUST:

* Be inaudible
* Survive:

  * MP3/AAC compression
  * Volume normalization
  * Mild EQ adjustments
  * Partial trimming

---

### 7.3 Redundancy Strategy

* Repeat payload every 5–10 seconds
* Interleave bits across time + frequency
* Use majority voting on decode

---

### 7.4 Error Correction

Use Forward Error Correction (FEC):

Recommended:

* Reed-Solomon
* BCH codes

---

## 8. Watermark Extraction

### 8.1 Extraction Flow

```
1. Decode audio to PCM
2. Scan for watermark signal
3. Extract repeated payload blocks
4. Apply error correction
5. Validate checksum
6. Recover attestation_id
```

---

### 8.2 Robustness Strategy

* Use sliding window detection
* Aggregate multiple payload recoveries
* Accept payload if checksum-valid majority exists

---

## 9. Verification Flow

```
1. Extract watermark → attestation_id
2. Fetch external attestation
3. Verify SIWE signature
4. Recompute audio fingerprint
5. Compare fingerprint with attestation
6. Confirm:
   - signature valid
   - fingerprint matches
   - attestation not revoked
```

---

## 10. Security Model

### 10.1 Guarantees

* Wallet ownership proven via SIWE signature
* Audio integrity bound via fingerprint
* Tampering detectable

---

### 10.2 Threat Mitigation

| Threat            | Mitigation                  |
| ----------------- | --------------------------- |
| Metadata removal  | Watermark embedded in audio |
| Re-encoding       | Spread-spectrum robustness  |
| Watermark copying | Fingerprint mismatch        |
| Identity forgery  | SIWE signature verification |

---

## 11. Limitations

* Payload capacity is small (~32–128 bits effective)
* Aggressive audio transformations may degrade recovery
* Not resistant to targeted watermark removal attacks
* Requires external lookup for full verification

---

## 12. Implementation Notes

### 12.1 Suggested Stack

* Python: librosa, numpy, scipy (prototype)
* C++: FFTW (production)
* Rust: real-time DSP pipelines
* JS: WebAudio API (lightweight decoding)

---

### 12.2 Embedding Approach (Simplified)

* FFT audio frame
* Slightly bias magnitude of selected bins to encode bits
* Inverse FFT
* Repeat across frames

---

### 12.3 Extraction Approach (Simplified)

* FFT frames
* Measure energy differences in known bins
* Reconstruct bitstream
* Apply FEC + checksum validation

---

## 13. Summary

```
Audio → carries watermark (attestation_id)
Attestation → carries SIWE proof
Fingerprint → binds audio to proof
```

This creates a **portable, tamper-resistant, and deterministic**
link between an audio asset and a wallet identity.
