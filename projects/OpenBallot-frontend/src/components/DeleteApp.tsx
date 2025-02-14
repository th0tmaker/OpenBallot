//./components/deleteApp.tsx

import { consoleLogger } from '@algorandfoundation/algokit-utils/types/logging'
import { useWallet } from '@txnlab/use-wallet'
import { useState } from 'react'
import { AppModalInterface } from '../interfaces/appModal'

// Create modal called 'Delete App' with which a smart contract application can be deleted
const DeleteAppModal = ({ algorand, openModal, closeModal, onModalExe }: AppModalInterface) => {
  const { activeAddress } = useWallet() // Get connected wallet active address
  const [userInputAppId, setUserInputAppId] = useState<string>('') // Store user inputed App ID as str
  const [userMsg, setUserMsg] = useState<string | null>(null) // Define hook for displaying messages to the user

  // Validate App ID user submitted through the Delete App modal
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
    <dialog id="delete_app_modal" className={`modal ${openModal ? 'modal-open' : ''}`}>
      <form method="dialog" className="modal-box rounded-lg p-6 bg-blue-100">
        <h3 className="text-2xl font-bold">Delete Existing App Client</h3>
        <p className="mt-4 -mb-2">Provide App ID to delete an existing smart contract.</p>
        <div className="grid m-2 pt-5">
          {activeAddress ? (
            <div className="flex flex-col gap-4">
              <input
                type="text"
                placeholder="Enter App ID"
                value={userInputAppId}
                onChange={(e) => setUserInputAppId(e.target.value)}
                className="input input-bordered rounded-md h-10 w-full border-black border-1"
              />
              <button
                type="button"
                className="btn justify-center rounded-md text-white bg-green-800 hover:bg-green-600 hover:border-black border-black border-2 text-[16px]"
                onClick={validateUserInputAppId}
              >
                Delete App
              </button>
              {userMsg && <p className="text-red-700 font-bold">{userMsg}</p>}
            </div>
          ) : (
            <p className="text-center text-red-700 font-bold">Wallet not connected!</p>
          )}
        </div>
        <div className="modal-action">
          <button
            className="btn justify-end rounded-md border-black border-1"
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

export default DeleteAppModal
