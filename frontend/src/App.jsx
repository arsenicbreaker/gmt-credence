import { motion, AnimatePresence } from 'framer-motion'
import { useAccount } from 'wagmi'
import Landing from './Landing'
import Dashboard from './Dashboard'

function App() {
  const { isConnected } = useAccount()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={isConnected ? 'dash' : 'land'}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        {isConnected ? <Dashboard /> : <Landing />}
      </motion.div>
    </AnimatePresence>
  )
}

export default App
