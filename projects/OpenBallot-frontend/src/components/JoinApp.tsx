//./components/JoinApp.tsx
import { consoleLogger } from '@algorandfoundation/algokit-utils/types/logging'
import { useWallet } from '@txnlab/use-wallet'
import { useState } from 'react'
import { AppModalInterface } from '../interfaces/appModal'

const JoinAppModal = ({ algorand, openModal, closeModal, onModalExe }: AppModalInterface) => {
  const { activeAddress } = useWallet() // Get connected wallet active address
  const [userInputAppId, setUserInputAppId] = useState<string>('') // Store user inputed App ID as str
  const [userMsg, setUserMsg] = useState<string | null>(null) // Define hook for displaying messages to the user

  // Validate App ID user submitted through the Clear State modal
  const validateUserInputAppId = async () => {
    const appId = BigInt(userInputAppId) // Cast user input App ID into `BigInt` type

    try {
      const app = await algorand.app.getById(appId) // Check if App client with given App ID exists

      if (!app) return // Return if app not found

      // If app found
      onModalExe(appId) // pass App ID as the modal on-execute arg
      // setUserMsg(null) // Clear user message field
    } catch (error) {
      consoleLogger.error('Error getting App ID:', error)
      setUserMsg('Client not found. Please ensure App ID is valid.')
    }
  }

  return (
    <dialog id="join_app_modal" className={`modal ${openModal ? 'modal-open' : ''}`}>
      <form method="dialog" className="modal-box">
        <h3 className="text-2xl font-bold">Join Existing App Client</h3>
        <p className="mt-4 -mb-2">Provide App ID to join an existing poll and vote.</p>
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
                Join
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

export default JoinAppModal
