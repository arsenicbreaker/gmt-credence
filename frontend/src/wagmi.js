import { createConfig, http } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { metaMask } from 'wagmi/connectors'

// BOT Chain config
const botChain = {
  id: 968,
  name: 'BOT Chain Testnet',
  nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.bohr.life'] } },
  blockExplorers: { default: { url: 'https://scan.bohr.life' } },
}

export const config = createConfig({
  chains: [botChain, mainnet],
  connectors: [metaMask()],
  transports: {
    [botChain.id]: http(),
    [mainnet.id]: http(),
  },
})