# Credence

**Verifiable Credential Issuance Platform on BOT Chain**

[![BOT Chain](https://img.shields.io/badge/BOT%20Chain-677-blue)](https://scan.botchain.ai/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-black)](https://soliditylang.org/)
[![React](https://img.shields.io/badge/React-18-blue)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5-purple)](https://vitejs.dev/)

![Dashboard Preview](frontend/public/preview.png)

---

## Problem

Digital certificates are easy to fake, hard to verify, and scattered across PDFs, emails, and Google Drive. Organisers handle manual verification requests. There's no standard digital identity to store all achievements.

## Solution

Credence is a blockchain-based platform for issuing **Verifiable Credentials**. Organisations publish credentials on-chain (BOT Chain). Anyone can verify authenticity without a third party – no screenshots, no manual checks.

## Vision

Become the trusted infrastructure for digital credentials.

---

## Features

| Feature | Description |
|---------|-------------|
| 📅 **Create Events** | Organisers publish on-chain events with name, date, and metadata. |
| ✅ **Attend / Check-in** | Participants connect wallet and sign a transaction to record attendance. |
| 🏅 **Issue Credentials** | Organisers mint a verifiable credential (NFT/SBT) to any attendee's wallet. |
| 🔍 **Verify** | Anyone checks credential validity by credential ID or wallet address. |
| 📋 **Event List** | Browse all events with attendee counts and status. |

---

## How It Works

### 1. Organiser
- Connect wallet (MetaMask)  
- Create an event with name, date, description  
- Participants check in via wallet  
- Issue credentials to attendees  
- Credentials are minted on-chain – immutable and permanent

### 2. Participant
- Connect wallet  
- Browse events  
- Click **Attend** → sign transaction  
- Receive credential after organiser issues it  

### 3. Verifier
- Open the verification page  
- Enter credential ID or wallet address  
- See credential status, issuer, event, issue date, and transaction hash

---

## Tech Stack

- **Smart Contract** — Solidity `^0.8.20`, deployed on BOT Chain (EVM)  
- **Frontend** — React 18 + Vite + Tailwind CSS  
- **Wallet Connection** — ethers.js + wagmi (RainbowKit ready)  
- **Network** — BOT Chain (Testnet: Chain ID 968 / Mainnet: 677)  
- **Hosting** — GitHub Pages + custom domain

---

## Live Demo

[🔗 Credence Live](https://credence.example.com)  

---

## Smart Contract

**Contract Address (Testnet):** `0xb73E31CA3eAD386661dcf92A7Fb461e02aC1518C`  
**Contract Address (Mainnet):** *update after mainnet deploy*

[View on BOTScan](https://scan.bohr.life/address/0xb73E31CA3eAD386661dcf92A7Fb461e02aC1518C)

---