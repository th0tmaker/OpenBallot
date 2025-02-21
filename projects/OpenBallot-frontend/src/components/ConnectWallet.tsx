//src/components/ConnectWallet.tsx

import { Provider, useWallet } from '@txnlab/use-wallet'
import { useEffect, useState } from 'react'
import Account from './Account'
import { consoleLogger } from '@algorandfoundation/algokit-utils/types/logging'

interface ConnectWalletInterface {
  openModal: boolean
  closeModal: () => void
}

const ConnectWallet = ({ openModal, closeModal }: ConnectWalletInterface) => {
  const { providers, activeAddress, connectedAccounts, activeAccount } = useWallet()
  const isKmd = (provider: Provider) => provider.metadata.name.toLowerCase() === 'kmd'
  const [userInputAddr, setUserInputAddr] = useState<string>('')

  // Ensure the wallet is disconnected on page refresh or close
  useEffect(() => {
    if (!openModal) {
      localStorage.removeItem('txnlab-use-wallet') // Disconnect the active wallet account when the modal closes
    }
  }, [openModal])

  const changeActiveAccountToNextIndex = async (provider: Provider) => {
    try {
      const currentAccIndex = connectedAccounts.findIndex((acc) => acc.address === activeAccount?.address)
      const nextAccIndex = (currentAccIndex + 1) % connectedAccounts.length
      provider.setActiveAccount(connectedAccounts[nextAccIndex].address)
    } catch (error) {
      consoleLogger.info('Failed changing Account to next index:', error)
    }
  }

  const changeActiveAccountByNameRef = async (provider: Provider) => {
    try {
      for (const addr of connectedAccounts) {
        if (addr.name == userInputAddr) {
          provider.setActiveAccount(addr.address)
        }
      }
    } catch (error) {
      consoleLogger.info('Failed changing Account to name reference:', error)
    }
  }

  return (
    <dialog id="connect_wallet_modal" className={`modal ${openModal ? 'modal-open' : ''}`}>
      <form
        method="dialog"
        className="modal-box hero-content flex flex-col items-center max-w-sm text-center font-bold rounded-lg p-6 bg-blue-100"
      >
        <h3 className="text-4xl">Wallet Setup</h3>

        <div className="grid grid-cols-1 pt-4 w-full justify-center font-semibold">
          {/* Display account and divider if wallet is connected */}
          {activeAddress && (
            <>
              <Account />
              <div className="divider" />
            </>
          )}

          {/* Display connection status */}
          <p className={`text-[20px] text-center font-bold mb-6 ${activeAddress ? 'text-green-800' : 'text-red-800'}`}>
            {activeAddress ? 'Wallet connected!' : 'Wallet not connected!'}
          </p>
          {/* Render connect/disconnect buttons */}
          <div className="flex justify-center">
            {providers?.map((provider) => (
              <button
                data-test-id={`${provider.metadata.id}-connect`}
                className={`btn text-[16px] ${
                  activeAddress
                    ? 'bg-red-700 hover:bg-red-500 text-white border-red-900 hover:border-red-700'
                    : 'bg-green-700 hover:bg-green-500 text-white border-green-900 hover:border-green-700'
                } font-bold px-4 border-b-4 rounded border-2 border-black`}
                key={`provider-${provider.metadata.id}`}
                style={{ width: '120px', height: '30px' }}
                onClick={() => {
                  if (activeAddress) {
                    // Disconnect logic
                    const activeProvider = providers?.find((p) => p.isActive)
                    if (activeProvider) {
                      activeProvider.disconnect()
                    } else {
                      // Cleanup for inactive providers
                      localStorage.removeItem('txnlab-use-wallet')
                      window.location.reload()
                    }
                  } else {
                    // Connect logic
                    provider.connect()
                  }
                }}
              >
                {/* Wallet icon */}
                {!isKmd(provider) && (
                  <img
                    alt={`wallet_icon_${provider.metadata.id}`}
                    src={provider.metadata.icon}
                    style={{ objectFit: 'contain', width: '30px', height: 'auto' }}
                  />
                )}
                {/* Button text */}
                <span>
                  {activeAddress
                    ? isKmd(provider)
                      ? 'Disconnect'
                      : provider.metadata.name
                    : isKmd(provider)
                      ? 'Connect'
                      : provider.metadata.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Next Account button and Input for account name */}
        {activeAddress && providers && (
          <div className="grid grid-cols-1 gap-6 w-30 mt-4">
            {/* Next Account button */}
            <button
              className="btn justify-center rounded-md bg-purple-300 hover:text-white hover:bg-purple-800 border-black border-2 text-[16px]"
              data-test-id="set-account-by-name"
              onClick={() => {
                const activeProvider = providers.find((p) => p.isActive)
                if (activeProvider) {
                  changeActiveAccountToNextIndex(activeProvider)
                }
              }}
            >
              Next Account Index
            </button>

            {/* Input and Set Account By Name button */}
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Enter account name"
                value={userInputAddr}
                onChange={(e) => setUserInputAddr(e.target.value)}
                className="input input-bordered rounded-md h-10 w-full border-black border-1"
              />
              <button
                className="btn justify-center rounded-md bg-purple-300 hover:text-white hover:bg-purple-800 border-black border-2 text-[16px]"
                data-test-id="set-account-by-name"
                onClick={() => {
                  const activeProvider = providers.find((p) => p.isActive)
                  if (activeProvider) {
                    changeActiveAccountByNameRef(activeProvider)
                  }
                }}
              >
                Set Account By Name
              </button>
            </div>
          </div>
        )}

        {/* Close button */}
        <div className="flex justify-end w-full mt-4">
          <button data-test-id="close-wallet-modal" className="btn justify-end rounded-md border-black border-1" onClick={closeModal}>
            Close
          </button>
        </div>
      </form>
    </dialog>
  )
}
export default ConnectWallet
