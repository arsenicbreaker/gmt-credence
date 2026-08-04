import { createConfig, http } from 'wagmi'
import { metaMask } from 'wagmi/connectors'

// BOT Chain Mainnet — contract 0x360199E70FC97331C6404E9074f1Ff67f1da887A lives here
const botChainMainnet = {
  id: 677,
  name: 'BOT Chain',
  nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.botchain.ai'] } },
  blockExplorers: {
    default: { name: 'BOTScan', url: 'https://scan.botchain.ai' },
  },
}

// BOT Chain Testnet — fallback
const botChainTestnet = {
  id: 968,
  name: 'BOT Chain Testnet',
  nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.bohr.life'] } },
  blockExplorers: {
    default: { name: 'BOTScan', url: 'https://scan.bohr.life' },
  },
}

export const config = createConfig({
  // First chain is the default — Mainnet (677) for the deployed contract
  chains: [botChainMainnet, botChainTestnet],
  connectors: [metaMask()],
  transports: {
    [botChainMainnet.id]: http('https://rpc.botchain.ai'),
    [botChainTestnet.id]: http('https://rpc.bohr.life'),
  },
})
