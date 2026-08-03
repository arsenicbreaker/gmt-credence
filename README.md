<div align="center">

<img src="frontend/public/logo.png" alt="Credence Logo" width="120" />

# Credence

**Verifiable Credential Issuance Platform on BOT Chain**

Issue, store, and verify digital credentials on-chain — immutable, portable, and trustless.

<br />

[![BOT Chain](https://img.shields.io/badge/BOT%20Chain-677-0A66C2?style=for-the-badge)](https://scan.botchain.ai/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636?style=for-the-badge&logo=solidity)](https://soliditylang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)

<br />

![Dashboard Preview](frontend/public/preview.png)

<br />

[Live Demo](#live-demo) · [Features](#features) · [How It Works](#how-it-works) · [Smart Contract](#smart-contract)

</div>

---

## Problem

Digital certificates are easy to fake, hard to verify, and scattered across PDFs, emails, and Google Drive. Organisers handle manual verification requests. There is no standard digital identity to store all achievements in one place.

## Solution

**Credence** is a blockchain-based platform for issuing **Verifiable Credentials**. Organisations publish credentials on-chain (BOT Chain). Anyone can verify authenticity without a third party — no screenshots, no manual checks.

## Vision

Become the trusted infrastructure for digital credentials.

---

## Features

| | Feature | Description |
|:---:|---------|-------------|
| 📅 | **Create Events** | Organisers publish on-chain events with name, date, and metadata. |
| ✅ | **Attend / Check-in** | Participants connect a wallet and sign a transaction to record attendance. |
| 🏅 | **Issue Credentials** | Organisers mint a verifiable credential (NFT/SBT) to any attendee’s wallet. |
| 🔍 | **Verify** | Anyone checks credential validity by credential ID or wallet address. |
| 📋 | **Event List** | Browse all events with attendee counts and status. |

---

## How It Works

<div align="center">

```
Organiser ──create event──► BOT Chain
Participant ──attend──► on-chain attendance
Organiser ──issue credential──► wallet (immutable)
Anyone ──verify──► authenticity without third party
```

</div>

### 1. Organiser

- Connect wallet (MetaMask)
- Create an event with name, date, and description
- Participants check in via wallet
- Issue credentials to attendees
- Credentials are minted on-chain — immutable and permanent

### 2. Participant

- Connect wallet
- Browse events
- Click **Attend** → sign the transaction
- Receive a credential after the organiser issues it

### 3. Verifier

- Open the verification page
- Enter credential ID or wallet address
- See credential status, issuer, event, issue date, and transaction hash

---

## Tech Stack

| Layer | Stack |
|-------|--------|
| **Smart Contract** | Solidity `^0.8.20` · BOT Chain (EVM) |
| **Frontend** | React 18 · Vite · Tailwind CSS |
| **Wallet** | ethers.js · wagmi (RainbowKit ready) |
| **Network** | BOT Chain — Testnet `968` · Mainnet `677` |
| **Hosting** | GitHub Pages + custom domain |

---

## Live Demo

<div align="center">

**[🔗 Open Credence](https://credence.example.com)**

</div>

---

## Smart Contract

| Network | Address |
|---------|---------|
| **Testnet** | [`0xb73E31CA3eAD386661dcf92A7Fb461e02aC1518C`](https://scan.bohr.life/address/0xb73E31CA3eAD386661dcf92A7Fb461e02aC1518C) |
| **Mainnet** | *update after mainnet deploy* |

[View on BOTScan →](https://scan.bohr.life/address/0xb73E31CA3eAD386661dcf92A7Fb461e02aC1518C)

---

## Project Structure

```
gmt-credence/
├── programs/
│   └── Credence.sol      # Smart contract
├── frontend/
│   ├── public/           # Assets & preview
│   └── src/              # React app (Landing, Dashboard)
└── README.md
```

---


<div align="center">

**Credence** — verifiable credentials on BOT Chain
Made for the BOT Chain hackathon

</div>
