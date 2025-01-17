//./components/ClearState.tsx

import { consoleLogger } from '@algorandfoundation/algokit-utils/types/logging'
import { useWallet } from '@txnlab/use-wallet'
import { useState } from 'react'
import { AppModalInterface } from '../interfaces/appModal'

// Create modal called 'Clear State' for clearing user account local storage from existing app client without fail
const ClearStateModal = ({ algorand, openModal, closeModal, onModalExe }: AppModalInterface) => {
  const { activeAddress } = useWallet() // Get connected wallet active address
  const [userInputAppId, setUserInputAppId] = useState<string>('') // Store user inputed App ID as str
  const [userMsg, setUserMsg] = useState<string | null>(null) // Define hook for displaying messages to the user

  // Validate App ID user submitted through the Clear State modal
  const validateUserInputAppId = async () => {
    const appId = BigInt(userInputAppId) // Cast user input App ID into `BigInt` type

    if (!activeAddress) {
      throw new Error('Active address not found!')
    }

    try {
      const accountAppInfo = await algorand.client.algod.accountApplicationInformation(activeAddress, Number(appId)).do()

      // Check if the account has an app-local-state
      const accountLocalState = accountAppInfo['app-local-state']
      if (!accountLocalState) {
        setUserMsg(`Clear State failed! Account not opted in to client with App ID: ${appId}.`)
        return // Return if account not opted in to app client
      }

      // If account opted in to app client
      onModalExe(appId) // pass App ID as the modal on-execute arg
      setUserMsg(null) // Clear user message field
    } catch (error) {
      consoleLogger.error('Error getting App ID:', error)
      setUserMsg('Client not found. Please ensure App ID is valid.')
    }
  }

  return (
    <dialog id="clear_state_modal" className={`modal ${openModal ? 'modal-open' : ''}`}>
      <form method="dialog" className="modal-box">
        <h3 className="text-2xl font-bold">Clear Local Storage From App Client</h3>
        <p className="mt-4 -mb-2">Provide App ID to clear local storage from an existing client.</p>
        <div className="grid m-2 pt-5">
          {activeAddress ? (
            <div className="flex flex-col gap-4">
              <input
                type="text"
                placeholder="Enter App ID"
                value={userInputAppId}
                onChange={(e) => setUserInputAppId(e.target.value)}
                className="input input-bordered"
              />
              <button type="button" className="btn text-black hover:text-white hover:bg-green-700" onClick={validateUserInputAppId}>
                Clear
              </button>
              {userMsg && <p className="text-red-700 font-bold">{userMsg}</p>}
            </div>
          ) : (
            <p className="text-center text-red-700 font-bold">Wallet not connected!</p>
          )}
        </div>
        <div className="modal-action">
          <button
            className="btn btn-warning"
            onClick={() => {
              setUserMsg('')
              closeModal()
            }}
          >
            Close
          </button>
        </div>
      </form>
    </dialog>
  )
}

export default ClearStateModal
