//src/Home.tsx

import * as algokit from '@algorandfoundation/algokit-utils'
import { consoleLogger } from '@algorandfoundation/algokit-utils/types/logging'
import { useWallet } from '@txnlab/use-wallet'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AppInfo } from './components/AppInfo'
import ConnectWallet from './components/ConnectWallet'
import JoinApp from './components/JoinApp'
import * as method from './methods'
import { AppProps, PollProps } from './types'
import * as date from './utils/dates'
import { getAlgodConfigFromViteEnvironment } from './utils/network/getAlgoClientConfigs'

// Configure console logger
algokit.Config.configure({
  debug: true,
  logger: consoleLogger,
})

// Algorand client setup
const algodConfig = getAlgodConfigFromViteEnvironment()
const algorand = algokit.AlgorandClient.fromConfig({ algodConfig })

const Home: React.FC = () => {
  // *STATE VARIABLES*
  // Wallet state variables
  const [openWalletModal, setOpenWalletModal] = useState(false) // initialize wallet modal and set its starting state as false
  const { activeAddress, signer } = useWallet() // extract the active address and signer objects from connected wallet
  algorand.setDefaultSigner(signer) // pass the signer object from the wallet as the default signer for every transaction

  // Poll state variables hooked via PollProps interface
  const [pollParams, setPollParams] = useState<PollProps>({
    title: '',
    choices: ['', '', ''],
    startDate: '',
    endDate: '',
  })

  // Vote choice state variable
  const [voteChoice, setVoteChoice] = useState<bigint | null>(null)
  const [userOptedIn, setUserOptedIn] = useState(false)

  // Boolean flags to track what screen is being rendered
  const [isHomeActive, setIsHomeActive] = useState(true) // track if home section should be rendered
  const [isPollActive, setIsPollActive] = useState(false) // track if poll section should be rendered
  const [isVotingActive, setIsVotingActive] = useState(false) // track if voting section should be rendered

  // State variable for notification message and its styling
  const [userMsg, setUserMsg] = useState<{ msg: string; style: string }>({
    msg: '',
    style: '',
  })

  const [openJoinModal, setOpenJoinModal] = useState(false)

  // State for created and joined apps
  const [currentAppId, setCurrentAppId] = useState<bigint | null>(null)
  const [currentApp, setCurrentApp] = useState<AppProps | null>(null) // Store the selected app

  const [votingStatus, setVotingStatus] = useState({ isOpen: false, message: 'No' })
  const [isPollValid, setIsPollValid] = useState(false)

  // Add a ref to track if we've already fetched the app state
  const hasLoadedApp = useRef<{ [key: string]: boolean }>({})
  const prevAppState = useRef<AppProps | null>(null) // Can also initialize with null or an empty object

  // *MANAGE LIFECYCLE SIDE EFFECTS*
  useEffect(() => {
    if (pollParams) {
      setIsPollValid(date.processPollInputs(pollParams, isPollActive, setUserMsg))
    }
  }, [pollParams, isPollActive, setUserMsg])

  // Modify the app state fetch effect
  useEffect(() => {
    if (currentAppId && !hasLoadedApp.current[currentAppId.toString()]) {
      fetchAppGlobalState()
      consoleLogger.info('Fetching APP ID Global STate:', currentAppId.toString)
    }
  }, [currentAppId]) // Dependency array ensures side effects run only when dependencies change

  // Add a debug effect to monitor state changes
  useEffect(() => {
    if (currentApp) {
      const { pollTitle, pollChoice1, pollChoice2, pollChoice3, pollStartDate, pollEndDate } = currentApp
      const prevState = prevAppState.current

      // Check if any of the relevant fields have changed
      if (
        !prevState ||
        pollTitle !== prevState.pollTitle ||
        pollChoice1 !== prevState.pollChoice1 ||
        pollChoice2 !== prevState.pollChoice2 ||
        pollChoice3 !== prevState.pollChoice3 ||
        pollStartDate !== prevState.pollStartDate ||
        pollEndDate !== prevState.pollEndDate
      ) {
        const status = date.isVotingOpen(currentApp)
        setVotingStatus(status)
        consoleLogger.info('Current app state updated:', { pollTitle, pollChoice1, pollChoice2, pollChoice3, pollStartDate, pollEndDate })
      }

      // Update the previous state
      prevAppState.current = { ...currentApp }
    }
  }, [currentApp, isVotingActive]) // Trigger only when currentApp changes // Trigger only when currentApp changes

  // * BUTTON ON-CLICK EVENTS*
  // Toggle wallet modal state true or false
  const toggleWalletModal = () => {
    setOpenWalletModal((prev) => !prev) // set open wallet model between previous and not previous state

    if (activeAddress) {
      setUserMsg({ msg: 'Wallet connected successfully', style: 'text-green-700 font-bold' }) // wallet found
    } else {
      setUserMsg({ msg: '', style: '' }) // wallet not found
    }
  }

  // Toggle join modal state true or false
  const toggleJoinModal = () => {
    setOpenJoinModal((prev) => !prev)
  }

  // const checkAccountLocalState = async (appId: bigint, address: string) => {
  //   try {
  //     const appLocalState = (await algorand.client.algod.accountApplicationInformation(address, Number(appId)).do())[
  //       'apps-local-state'
  //     ]?.find((app: { id: number }) => app.id === Number(appId))

  //     return {
  //       isOptedIn: !!appLocalState,
  //       keyValues: appLocalState?.['key-value'] || null,
  //     }
  //   } catch (error) {
  //     consoleLogger.error('Error:', error)
  //     return { isOptedIn: false, keyValues: null }
  //   }
  // }

  const handleAppJoin = async (appId: bigint) => {
    try {
      // Reset the loaded state for this app if we're explicitly joining it
      hasLoadedApp.current[appId.toString()] = false

      consoleLogger.info('join app id', appId)
      setCurrentAppId(appId)
      setIsVotingActive(true)
      return true
    } catch (error) {
      consoleLogger.error('Error fetching app client or global state:', error)
      return null
    }
  }

  // Memoize the fetch function
  const fetchAppGlobalState = useCallback(async () => {
    if (!currentAppId) return

    // Skip if we've already loaded this app's state
    if (hasLoadedApp.current[currentAppId.toString()]) {
      return
    }

    try {
      const app = await algorand.app.getById(currentAppId)
      const appGlobalState = app.globalState

      // Extract fields from the global state
      const pollTitle = appGlobalState['poll_title']?.value ?? ''
      const pollChoice1 = appGlobalState['poll_choice1']?.value ?? ''
      const pollChoice2 = appGlobalState['poll_choice2']?.value ?? ''
      const pollChoice3 = appGlobalState['poll_choice3']?.value ?? ''
      const pollStartDate = appGlobalState['poll_start_date_unix']?.value
      const pollEndDate = appGlobalState['poll_end_date_unix']?.value

      const pollStartDateStr = date.convertUnixToVoteDate(BigInt(pollStartDate ?? 0))
      const pollEndDateStr = date.convertUnixToVoteDate(BigInt(pollEndDate ?? 0))

      const newAppState: AppProps = {
        appId: app.appId,
        appAddress: app.appAddress,
        creatorAddress: app.creator,
        pollTitle: String(pollTitle),
        pollChoice1: String(pollChoice1),
        pollChoice2: String(pollChoice2),
        pollChoice3: String(pollChoice3),
        pollStartDate: pollStartDateStr,
        pollEndDate: pollEndDateStr,
      }

      setCurrentApp(newAppState)
      // Mark this app as loaded
      hasLoadedApp.current[currentAppId.toString()] = true
    } catch (error) {
      consoleLogger.error('Failed to fetch app global state:', error)
    }
  }, [currentAppId, algorand.app])

  // Run when start button is clicked
  const handleStartClick = () => {
    if (!activeAddress) {
      // User presses Start without connecting wallet
      setUserMsg({ msg: 'Please connect a wallet before starting', style: 'text-red-700 font-bold' }) // wallet not found
    } else if (activeAddress) {
      setUserMsg({ msg: '', style: '' })

      // User has connected wallet and presses Start
      setIsHomeActive(false)
      setIsPollActive(true) // Show poll section
    }
  }

  // Run when cancel button is clicked
  const handleCancelClick = () => {
    setPollParams({
      title: '',
      choices: ['', '', ''],
      startDate: '',
      endDate: '',
    })
    setIsHomeActive(true)
    setIsPollActive(false)
    setIsVotingActive(false)
    setOpenJoinModal(false)
    // setSelectedApp(null)
    setVoteChoice(null)

    if (activeAddress) {
      setUserMsg({ msg: 'Wallet connected successfully', style: 'text-green-700 font-bold' }) // wallet found
    }
  }

  const handleSubmitClick = async () => {
    // Ensure a vote choice is selected
    if (voteChoice === null) {
      consoleLogger.error('Vote choice is missing.')
      return
    }

    await submitVote()

    setIsVotingActive(false)
    setIsPollActive(false)
    setIsHomeActive(true)

    setPollParams({
      title: '',
      choices: ['', '', ''],
      startDate: '',
      endDate: '',
    })
  }

  const handleDeleteClick = async () => {
    // Check for valid App ID
    if (!currentApp?.appId) {
      consoleLogger.error('Cannot find valid App client with ID: ', currentApp?.appId)
      return
    }

    // Check for valid creator address
    if (!currentApp?.creatorAddress) {
      consoleLogger.error('Cannot find creator for App client with ID: ', currentApp?.appId)
      return
    }

    try {
      // Attempt to delete the app
      await method.deleteApp(algorand, currentApp.creatorAddress, currentApp?.appId)
      consoleLogger.info('Deletion method successful for App ID:', currentApp?.appId)

      // Remove app from the app list
      setUserMsg({
        msg: `App with ID: ${currentApp?.appId.toString()} successfully deleted`,
        style: 'text-green-700 font-bold',
      })

      setIsVotingActive(false) // Adjust app state after deletion
      setIsHomeActive(true)
    } catch (error) {
      consoleLogger.error('Error:', error)
      setUserMsg({
        msg: `App with ID: ${currentApp?.appId.toString()} failed to be deleted`,
        style: 'text-red-700 font-bold',
      })
    }
  }

  const handleOptInClick = async () => {
    if (!activeAddress) {
      consoleLogger.info('Please connect a wallet!')
      return
    }

    if (!currentApp?.appId) {
      consoleLogger.error('Cannot find valid App client with ID: ', currentApp?.appId)
      return
    }

    try {
      await method.optIn(algorand, activeAddress, currentApp?.appId)
      setUserOptedIn(true)
      consoleLogger.info(activeAddress, 'has been successfully opted in to App ID:', currentApp?.appId)
      setUserMsg({ msg: 'Account opt-in successful', style: 'text-green-700 font-bold' })
    } catch (error) {
      consoleLogger.error('Error:', error)
      setUserMsg({ msg: 'Account opt-in failed', style: 'text-red-700 font-bold' })
    }
  }

  const handleOptOutClick = async () => {
    if (!activeAddress) {
      consoleLogger.info('Please connect a wallet!')
      return
    }

    if (!currentApp?.appId) {
      consoleLogger.error('Cannot find valid App client with ID: ', currentApp?.appId)
      return
    }

    try {
      await method.optOut(algorand, activeAddress, currentApp?.appId)
      setUserOptedIn(true)
      consoleLogger.info(activeAddress, 'has been successfully opted out of App ID:', currentApp?.appId)
      setUserMsg({ msg: 'Account opt-out successful', style: 'text-green-700 font-bold' })
    } catch (error) {
      consoleLogger.error('Error:', error)
      setUserMsg({ msg: 'Account opt-out failed', style: 'text-red-700 font-bold' })
    }
  }

  const submitVote = async () => {
    try {
      // Ensure wallet is connected
      if (!activeAddress) {
        consoleLogger.info('Please connect a wallet!')
        return
      }

      // Ensure currentApp is available
      if (!currentApp) {
        consoleLogger.error('No app selected or available to opt out of.')
        return
      }

      // Get the appId from currentApp
      const currentAppId = currentApp?.appId

      // Ensure the appId is available
      if (!currentAppId) {
        consoleLogger.error('App ID is missing for the selected app.')
        return
      }

      // Ensure a vote choice is selected
      if (voteChoice === null) {
        consoleLogger.error('Vote choice is missing.')
        return
      }

      // Call the submitVote method
      consoleLogger.info(`Submitting vote through App with ID: ${currentAppId.toString()} with choice: ${voteChoice}`)
      await method.submitVote(algorand, activeAddress, currentAppId, voteChoice)

      setUserMsg({ msg: 'Your vote has been successfully submitted! Thank you for participating!', style: 'text-green-700 font-bold' })

      consoleLogger.info(`Vote successfully submitted for app ID: ${currentAppId.toString()}`)
      consoleLogger.info(`Vote successfully submitted for user address: ${activeAddress}`)
    } catch (error) {
      consoleLogger.error('Error submitting vote:', error)
    }
  }

  // *EVENT HANDLER*
  // Initialize App client
  const initApp = async () => {
    try {
      if (!activeAddress) {
        consoleLogger.info('logger: Please connect a wallet!')
        return
      }

      // Creating a new instance of the App client
      const appClient = await method.createApp(algorand, activeAddress)
      // App creator pays Global schema MBR cost
      await method.payGlobalMbrCost(algorand, activeAddress, appClient.appId)

      // App creators sets up poll
      await method.setupPoll(
        algorand,
        activeAddress,
        appClient.appId,
        pollParams.title,
        pollParams.choices[0],
        pollParams.choices[1],
        pollParams.choices[2],
        date.formatVoteDateStrOnChain(pollParams.startDate),
        BigInt(date.convertVoteDateToUnix(pollParams.startDate)),
        date.formatVoteDateStrOnChain(pollParams.endDate),
        BigInt(date.convertVoteDateToUnix(pollParams.endDate)),
      )

      setCurrentAppId(appClient.appId)

      // Now you can access appClient and its state for the new app

      // Wait for the app creation transaction to be completed, then set vote dates
    } catch (error) {
      consoleLogger.error('Error creating app:', error)
    }
  }

  const handlePollSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await initApp()
      setIsPollActive(false)
      setIsVotingActive(true)
    } catch (error) {
      consoleLogger.error('Error submitting poll:', error)
    }
  }

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const newTitle = e.target.value
    setPollParams((prev) => ({ ...prev, title: newTitle }))
  }

  const handleChoiceChange = (index: number, value: string): void => {
    const newChoices = [...pollParams.choices]
    newChoices[index] = value
    setPollParams((prev) => ({ ...prev, choices: newChoices }))
  }

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const newStartDate = e.target.value
    setPollParams((prev) => ({ ...prev, startDate: newStartDate }))
  }

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const newEndDate = e.target.value
    setPollParams((prev) => ({ ...prev, endDate: newEndDate }))
  }

  return (
    <div className="hero min-h-screen bg-slate-800">
      <div className="hero-content maxl text-center rounded-lg p-10 max-w-full bg-blue-100">
        <div className="max-w-full">
          <h1 className="pb-4 text-[56px] font-bold">Welcome to Brez Imena</h1>
          <p className={`mb-6 text-[20px] ${userMsg.style}`}>{userMsg.msg}</p>
          {isHomeActive && !isPollActive && !isVotingActive && (
            // Home Section
            <div className="grid justify-center">
              <button
                data-test-id="start-app-btn"
                className="btn w-40 h-14 justify-center rounded-md text-[24px] tracking-wide font-bold bg-yellow-400 hover:bg-green-500 m-2 border-[3px] border-black hover:border-[4px] hover:border-green-700"
                onClick={handleStartClick}
              >
                Start
              </button>
              <button
                data-test-id="join-app-btn"
                className="btn w-40 h-14 justify-center rounded-md text-[24px] tracking-wide font-bold bg-yellow-400 hover:bg-green-500 m-2 border-[3px] border-black hover:border-[4px] hover:border-green-700"
                onClick={toggleJoinModal}
              >
                Join
              </button>
              <JoinApp
                algorand={algorand}
                openModal={openJoinModal}
                closeModal={toggleJoinModal}
                onAppJoin={handleAppJoin} // Pass handleAppJoin function to JoinApp
              />
              <button
                data-test-id="connect-wallet-btn"
                className="btn w-40 h-14 justify-center rounded-md text-[24px] tracking-wide font-bold bg-yellow-400 hover:bg-green-500 m-2 border-[3px] border-black hover:border-[4px] hover:border-green-700"
                onClick={toggleWalletModal}
              >
                Tekvin
              </button>
              <ConnectWallet openModal={openWalletModal} closeModal={toggleWalletModal} />
            </div>
          )}
          {isPollActive && !isVotingActive && (
            // Poll Creation Section
            <div>
              <div className="mt-2 max-w-2xl mx-auto">
                <form className="space-y-2 bg-white p-4 rounded-lg shadow-lgb border-2 border-black">
                  <h2 className="text-4xl font-bold text-center mb-4">Create New Poll</h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-lg font-bold text-gray-700 mb-2">Poll Title</label>
                      <input
                        type="text"
                        placeholder="Title"
                        value={pollParams.title}
                        onChange={handleTitleChange}
                        className={`w-full p-3 border rounded-md focus:outline-none ${pollParams.title ? 'border-2 border-green-500' : 'border-2 border-red-500'}`}
                        required
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="block text-lg font-bold text-gray-700">Choices (required)</label>
                      {pollParams.choices.map((choice, index) => (
                        <input
                          key={index}
                          type="text"
                          placeholder={`Choice ${index + 1}`}
                          value={choice}
                          onChange={(e) => handleChoiceChange(index, e.target.value)}
                          className={`w-full p-3 border rounded-md focus:outline-none ${pollParams.choices[index] ? 'border-2 border-green-500' : 'border-2 border-red-500'}`}
                          required
                        />
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-lg font-bold text-gray-700 mb-2">Start Date</label>
                        <input
                          type="date"
                          value={pollParams.startDate}
                          onChange={handleStartDateChange}
                          className={`w-full p-3 border rounded-md focus:outline-none ${date.setUserVisualAidForDates(pollParams.startDate, pollParams)}`}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-lg font-bold text-gray-700 mb-2">End Date</label>
                        <input
                          type="date"
                          value={pollParams.endDate}
                          onChange={handleEndDateChange}
                          className={`w-full p-3 border rounded-md focus:outline-none ${date.setUserVisualAidForDates(pollParams.startDate, pollParams)}`}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 justify-center mt-6 pt-4">
                    <button
                      type="button"
                      onClick={handleCancelClick}
                      className="btn w-40 h-14 justify-center rounded-md text-[24px] tracking-wide font-bold bg-yellow-400 hover:bg-red-500 m-2 border-[3px] border-black hover:border-[4px] hover:border-red-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!isPollValid} // Use the state value here
                      className={`btn w-40 h-14 justify-center rounded-md text-[24px] tracking-wide font-bold m-2 ${
                        isPollValid
                          ? 'bg-yellow-400 hover:bg-green-500 border-[3px] border-black hover:border-[4px] hover:border-green-700'
                          : 'bg-gray-400 border-[3px] border-gray-600 cursor-not-allowed'
                      }`}
                      onClick={handlePollSubmit} // Handle button click
                    >
                      Create
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
          {!isPollActive && isVotingActive && (
            // Voting Section
            <div className="voting-section mt-4 p-6 max-w-4xl bg-white rounded-lg shadow-lg border-2 border-black mx-auto">
              <h1 className={`text-[34px] font-bold text-center mb-4 'text-gray-500'}`}>{currentApp?.pollTitle || 'No Title Available'}</h1>
              <div className="space-y-4">
                <p className="text-[20px] font-bold text-gray-800">
                  Is Voting Open:{' '}
                  <span className={votingStatus.isOpen ? 'font-bold text-green-700' : 'text-red-700'}>{votingStatus.message}</span>
                </p>
                <div>
                  <p className="text-[20px] text-left font-semibold underline mb-4">Choices:</p>
                  <ul className="space-y-2">
                    {[currentApp?.pollChoice1, currentApp?.pollChoice2, currentApp?.pollChoice3].map(
                      (choice, index) =>
                        choice && (
                          <li key={index} className="flex items-center space-x-3">
                            <input
                              type="radio"
                              id={`choice-${index}`}
                              name="vote"
                              value={choice}
                              className="form-radio h-5 w-5 text-green-500"
                              onChange={() => setVoteChoice(BigInt(index + 1))}
                              disabled={!userOptedIn}
                            />
                            <label
                              htmlFor={`choice-${index}`}
                              className={`text-[20px] font-bold ${!userOptedIn ? 'text-gray-400' : 'text-black'}`}
                            >
                              {choice || `Choice ${index + 1}`}
                            </label>
                          </li>
                        ),
                    )}
                  </ul>
                </div>
              </div>
              <div className="mt-6 flex justify-center gap-4">
                <button
                  disabled={userOptedIn} // Disable if user has not yet opted in
                  onClick={handleOptInClick} // Function to opt in
                  className="btn w-36 h-14 justify-center rounded-md text-[24px] tracking-wide font-bold bg-yellow-400 hover:bg-green-500 border-[3px] border-black hover:border-[4px] hover:border-green-700"
                >
                  Opt In
                </button>

                <button
                  disabled={!userOptedIn} // Disable if user has not yet opted in
                  onClick={handleOptOutClick} // Function to handle opt out click
                  className="btn w-36 h-14 justify-center rounded-md text-[24px] tracking-wide font-bold bg-yellow-400 hover:bg-green-500 border-[3px] border-black hover:border-[4px] hover:border-green-700"
                >
                  Opt Out
                </button>

                <button
                  disabled={!userOptedIn} // Disable if user has not yet opted in
                  onClick={handleSubmitClick} // Function to handle vote submission
                  className="btn w-36 h-14 justify-center rounded-md text-[24px] tracking-wide font-bold bg-yellow-400 hover:bg-green-500 border-[3px] border-black hover:border-[4px] hover:border-green-700"
                >
                  Submit Vote
                </button>

                <button
                  disabled={!currentApp?.creatorAddress || !currentApp?.appId}
                  onClick={handleDeleteClick} // Function to handle app client deletion
                  className="btn w-36 h-14 justify-center rounded-md text-[24px] tracking-wide font-bold bg-yellow-400 hover:bg-green-500 border-[3px] border-black hover:border-[4px] hover:border-green-700"
                >
                  Delete
                </button>

                <button
                  onClick={handleCancelClick} // Exit the voting screen
                  className="btn w-36 h-14 justify-center rounded-md text-[24px] tracking-wide font-bold bg-yellow-400 hover:bg-red-500 border-[3px] border-black hover:border-[4px] hover:border-red-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {/* AppId should alternate between createdAppId and joinedAppId */}
          {isVotingActive &&
            (currentAppId ? (
              <AppInfo algorand={algorand} appId={currentApp?.appId} setUserMsg={setUserMsg} />
            ) : (
              <p className="text-red-700">No valid App ID available for voting.</p>
            ))}
        </div>
      </div>
    </div>
  )
}
export default Home
