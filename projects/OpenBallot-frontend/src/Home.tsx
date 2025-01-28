//src/Home.tsx

import * as algokit from '@algorandfoundation/algokit-utils'
import { consoleLogger } from '@algorandfoundation/algokit-utils/types/logging'
import { useWallet } from '@txnlab/use-wallet'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AppBaseInfo } from './components/AppBaseInfo'
import ClearStateModal from './components/ClearState'
import ConnectWallet from './components/ConnectWallet'
import JoinAppModal from './components/JoinApp'
import * as iInterface from './interfaces/index'
import { OpenBallotMethodManager } from './methods'
import { UISectionState } from './types'
import * as button from './utils/buttons'
import * as date from './utils/dates'
import * as pollInputs from './utils/pollInputs'

// Algorand client setup
const algorand = algokit.AlgorandClient.fromEnvironment()

const Home: React.FC = () => {
  // Wallet Address & Signer
  const { activeAddress, signer } = useWallet() // Get connected wallet active address and signer
  algorand.setDefaultSigner(signer) // Pass the signer object from the wallet as the default signer for every transaction
  const openBallotMethodManager = new OpenBallotMethodManager(algorand, activeAddress ?? '')

  // Modals
  const [openWalletModal, setOpenWalletModal] = useState(false) // Init ConnectWallet modal and set its starting state as false
  const [openJoinAppModal, setOpenJoinAppModal] = useState(false) // Init AppJoin modal and set its starting state as false
  const [openClearStateModal, setOpenClearStateModal] = useState(false) // Init ClearState modal and set its state as false

  // App Client State
  const [currentAppId, setCurrentAppId] = useState<bigint | null>(null) // Current App ID (for loading App Global State)
  const [currentAppClient, setCurrentAppClient] = useState<iInterface.AppClientProps | null>(null)
  const hasLoadedApp = useRef<{ [key: string]: boolean }>({})

  // User Notification
  const [userMsg, setUserMsg] = useState<{ msg: string; style: string }>({
    msg: '',
    style: '',
  }) // Inform user with a status update message

  // Poll
  const [currentPollInputs, setCurrentPollInputs] = useState<iInterface.AppPollProps>({
    title: '',
    choices: ['', '', ''],
    startDate: '',
    endDate: '',
  }) // Store current poll data fields the user has provided as inputs

  const [choiceDecision, setChoiceDecision] = useState<bigint | null>(null) // Store user choice decision
  const [choiceDisplay, setChoiceDisplay] = useState<{ index: number | null; text: string }>({ index: null, text: '' }) // Display choice on screen

  const [votingPeriod, setVotingPeriod] = useState({ open: true, msg: 'Yes' }) // Track if poll voting period is over

  // UI Section Display State
  const [activeSection, setActiveSection] = useState<UISectionState>('HOME') // Set and update the UI diplay sections

  // Button State
  const { btnStates, updateBtnStates } = button.setBtnState() // Set and update the state of buttons

  // *EVENT LISTENER (manage lifecycle side-effects)*

  // Checking the validity of user-provided poll inputs
  useEffect(() => {
    // Check validity any time poll inputs exist and 'CREATION' section is active
    if (currentPollInputs && activeSection === 'CREATION') {
      // Process poll inputs
      const arePollInputsValid = pollInputs.processPollInputs(currentPollInputs, activeSection, setUserMsg)
      updateBtnStates({ pollInputsValid: arePollInputsValid }) // Update the button state accordingly
    }
  }, [currentPollInputs, btnStates.pollInputsValid, activeSection, setUserMsg])

  // Load App Client Global State
  useEffect(() => {
    const loadGlobalState = async () => {
      // Return and escape if circumstances below
      if (!currentAppId || !activeAddress || hasLoadedApp.current[currentAppId.toString()]) return

      // Proceed
      try {
        await queryGlobalState()
        consoleLogger.info(`Global State for App client with ID: ${currentAppId.toString()} has been loaded successfully!`)
        hasLoadedApp.current[currentAppId.toString()] = true // Set 'hasLoadedApp' key with 'currentAppId' as value to true
      } catch (error) {
        consoleLogger.error(`Error loading Global State for App client with ID: ${currentAppId.toString()}!`, error)
      }
    }

    loadGlobalState() // Call method
  }, [currentAppId, hasLoadedApp]) // Trigger effect re-run based on the values of the variables it contains

  // Load App Client Local State
  useEffect(() => {
    const loadLocalState = async () => {
      // Return and escape if no wallet active address found or App ID is null or account not opted in to 'currentAppClient'
      if (!activeAddress || !currentAppClient?.appId) return

      try {
        // If wallet connected, proceed with loading App client State
        const localState = await queryLocalState(currentAppClient.appId, activeAddress) // query account Local State on App client
        consoleLogger.info(`Local State for App client with ID: ${currentAppClient.appId.toString()} has been loaded successfully!`)

        consoleLogger.info(String(choiceDecision))

        if (localState) {
          const { optedIn, localVoteStatus, localVoteChoice } = localState
          // If account with active address has voted, display their vote choice on screen based on its corresponding number
          if (localVoteStatus === 1) {
            if (localVoteChoice === 1) {
              setChoiceDisplay({ index: localVoteChoice, text: currentAppClient.pollChoice1 })
            } else if (localVoteChoice === 2) {
              setChoiceDisplay({ index: localVoteChoice, text: currentAppClient.pollChoice2 })
            } else if (localVoteChoice === 3) {
              setChoiceDisplay({ index: localVoteChoice, text: currentAppClient.pollChoice3 })
            }
          }

          // Check voting status (if voting is open or closed)
          const currentVotingPeriod = date.checkVotingPeriod(currentAppClient.pollStartDateUnix, currentAppClient.pollEndDateUnix)
          setVotingPeriod(currentVotingPeriod) // Set 'votingPeriod'

          consoleLogger.info('Voting Status:', votingPeriod)

          // Update the button states based on the Local State key-value pairs
          updateBtnStates({
            optedIn,
            pollVotingPeriodOpen: currentVotingPeriod.open,
            voteSubmitted: !optedIn || !currentVotingPeriod.open || localVoteStatus === 1,
          })

          // Update the 'currentAppClient' with the refreshed Local State values
          const updatedAppClient = {
            ...currentAppClient,
            pollVoteStatus: localVoteStatus,
            pollVoteChoice: localVoteChoice,
            isOptedIn: optedIn,
          }

          // Pass 'updatedAppClient' as new 'currentAppCleint'
          setCurrentAppClient(updatedAppClient)
          consoleLogger.info('LocaL State queried and updated with new values:', updatedAppClient)
        }
      } catch (error) {
        consoleLogger.error(`Error loading Local State for App client with ID: ${currentAppClient.appId.toString()}!`, error)
      }
    }

    loadLocalState()
  }, [activeAddress, currentAppClient?.appId, currentAppClient?.isOptedIn, votingPeriod.open])

  // * MODAL EVENTS*
  // Toggle ConnectWallet Modal State
  const toggleWalletModal = () => {
    // Toggle wallet modal between open and not open state
    setOpenWalletModal((prev) => !prev) // from true to false and vice-versa

    // If 'activeAddress' can be found from wallet (meaning wallet is connected)
    if (activeAddress) {
      // Display user message that wallet has been connected successfully
      setUserMsg({ msg: 'Account address available! Wallet successfully connected.', style: 'text-green-700 font-bold' })
      // Else, don't display any user message
    } else {
      setUserMsg({ msg: '', style: '' })
    }
  }
  // Toggle JoinApp Modal State
  const toggleJoinAppModal = () => {
    // Toggle join modal between open and not open state
    setOpenJoinAppModal((prev) => !prev)
  }

  // Toggle ClearState Modal State
  const toggleClearStateModal = () => {
    // Toggle clear state modal between open and not open state
    setOpenClearStateModal((prev) => !prev)
  }

  // Join existing App Client by passing the JoinApp modal App ID
  const onJoinApp = async (appId: bigint): Promise<boolean | null> => {
    // Check if the active address exists
    if (!activeAddress) {
      consoleLogger.error('Broke out onJoinApp: activeAddress not found!')
      return null
    }

    try {
      // Reset the loaded state for this app if we're explicitly joining it
      hasLoadedApp.current[appId.toString()] = false

      consoleLogger.info(`Joining client with App ID: ${appId.toString()}!`)

      // Set appId as 'currentAppId'
      setCurrentAppId(appId) // Pass App ID from JoinApp modal

      setActiveSection('ENGAGEMENT') // Switch UI section to engagement
      setOpenJoinAppModal(false) // Close Join App modal

      return true // Successfully joined
    } catch (error) {
      consoleLogger.error(`Error joining App client with ID: ${appId.toString()}!`, error)
      return null // Return null if an error occurs
    }
  }

  // Execute Clear State on existing App Client by passing the ClearState in order to opt out and free up Local schema MBR without fail
  const onClearState = async (appId: bigint): Promise<boolean | null> => {
    // Check if the active address exists
    if (!activeAddress) {
      consoleLogger.error('Broke out onClearState: activeAddress not found!')
      return null
    }

    try {
      // Execute smart contract clearState method
      consoleLogger.info(`Executing Clear State on client with App ID: ${appId.toString()}!`)
      await openBallotMethodManager.clearState(activeAddress, appId)
      consoleLogger.info(`Clear State successful on client with App ID: ${appId.toString()}!`)

      setUserMsg({
        msg: `Clear State successful on client with App ID: ${appId.toString()}.`,
        style: 'text-green-700 font-bold',
      })

      setOpenClearStateModal(false) // Close Clear State modal
      return true // Successfully cleared state
    } catch (error) {
      consoleLogger.error(`Error executing Clear State on client with App ID: ${appId.toString()}!`, error)
      return null // Return null if an error occurs
    }
  }

  // * ALGORAND CLIENT DATA RETRIEVAL*
  // Create a memoized callback method that requests Global State information of a smart contract by passing its App ID through the Algorand client
  const queryGlobalState = useCallback(async () => {
    if (!activeAddress) {
      consoleLogger.error('Broke out queryGlobalState: activeAddress not found!')
      setUserMsg({
        msg: 'Account address not found! Please check if your wallet is connected.',
        style: 'text-red-700 font-bold',
      })
      return
    }

    if (!currentAppId) {
      consoleLogger.error('Broke out queryGlobalState: currentAppId not found!')
      setUserMsg({
        msg: `Client with App ID: ${currentAppId?.toString()} not found.`,
        style: 'text-red-700 font-bold',
      })
      return
    }

    try {
      // Retrieve client by App ID and access its Global State
      const app = await algorand.app.getById(currentAppId)
      const appGlobalState = app.globalState

      // Extract App Global State key-value pairs
      const pollTitle = appGlobalState['poll_title']?.value || ''
      const pollChoice1 = appGlobalState['poll_choice1']?.value || ''
      const pollChoice2 = appGlobalState['poll_choice2']?.value || ''
      const pollChoice3 = appGlobalState['poll_choice3']?.value || ''
      const pollStartDateUnix = BigInt(appGlobalState['poll_start_date_unix']?.value ?? 0)
      const pollEndDateUnix = BigInt(appGlobalState['poll_end_date_unix']?.value ?? 0)

      // Convert the poll start and end dates into unix integers into string appropriate format
      const pollStartDateStr = date.convertUnixToDate(pollStartDateUnix)
      const pollEndDateStr = date.convertUnixToDate(pollEndDateUnix)

      // Use AppClientProps interface to construct an object representing the new state of the current App Client based on its Global State data
      const newAppClientState: iInterface.AppClientProps = {
        appId: app.appId,
        appAddress: app.appAddress,
        creatorAddress: app.creator,
        pollTitle: String(pollTitle),
        pollChoice1: String(pollChoice1),
        pollChoice2: String(pollChoice2),
        pollChoice3: String(pollChoice3),
        pollStartDate: pollStartDateStr,
        pollEndDate: pollEndDateStr,
        pollStartDateUnix,
        pollEndDateUnix,
        pollVoteStatus: null,
        pollVoteChoice: null,
        isOptedIn: false,
      }

      // Set new App client state object as 'currentAppClient'
      setCurrentAppClient(newAppClientState)

      // Mark the current App Client as loaded
      hasLoadedApp.current[currentAppId.toString()] = true

      consoleLogger.info(`Global State for App client with ID: ${currentAppId.toString()} has been queried successfully!`)
    } catch (error) {
      consoleLogger.error(`Failed to query Global State for App client with ID: ${currentAppId.toString()}!`)
    }
  }, [activeAddress, currentAppId, algorand.app, setCurrentAppClient])

  // Create a method that requests Local State information of an account for a specific client by passing the account address and client App ID through the Algorand client
  const queryLocalState = async (appId: bigint, address: string) => {
    if (!activeAddress) {
      consoleLogger.error('Broke out queryLocalState: activeAddress not found!')
      setUserMsg({
        msg: 'Account address not found! Please check if your wallet is connected.',
        style: 'text-red-700 font-bold',
      })
      return
    }

    if (!appId) {
      consoleLogger.error('Broke out queryLocalState: App ID not found!')
      setUserMsg({
        msg: `Client with App ID: ${appId?.toString()} not found.`,
        style: 'text-red-700 font-bold',
      })
      return
    }

    try {
      // Query account address information from specific client by passing its App ID
      const accountAppInfo = await algorand.client.algod.accountApplicationInformation(address, Number(appId)).do()

      // Check access to account Local State
      const accountLocalState = accountAppInfo['app-local-state']

      // If there is no data about account Local State tied to queried App Client (then account is NOT opted in to client)
      if (!accountLocalState) {
        consoleLogger.info(`No Local State found for Account with address: ${address}. Check if Account is opted in.`)

        // Return Local State keys with following default values
        return { optedIn: false, localVoteStatus: null, localVoteChoice: null }
      }

      // If data about account Local State tied to queried App client exists (then account is opted in), proceed with data extraction
      const accountLocalVoteStatus = Number(accountLocalState['key-value']?.[1]?.['value']?.['uint'])
      const accountLocalVoteChoice = Number(accountLocalState['key-value']?.[0]?.['value']?.['uint'])

      // Console log data
      // consoleLogger.info('Account is opted in to:', appId.toString())
      // consoleLogger.info('Checking local vote status:', accountLocalVoteStatus)
      // consoleLogger.info('Checking local vote choice:', accountLocalVoteChoice)

      // Return Local State keys with extracted values
      return { optedIn: true, localVoteStatus: accountLocalVoteStatus ?? null, localVoteChoice: accountLocalVoteChoice ?? null }
    } catch (error) {
      consoleLogger.error('Error querying local state:', error)
      consoleLogger.error(`Failed to query Local State for Account Address: ${address} tied to App client with ID: ${appId.toString()}!`)

      // If error fetching data, return Local State keys with following default values
      return { optedIn: false, localVoteStatus: null, localVoteChoice: null }
    }
  }

  // Create a new OpenBallot smart contract App client
  const createApp = async () => {
    if (!activeAddress) {
      consoleLogger.error('Broke out onSubmitVoteBtnClick: activeAddress not found!')
      setUserMsg({
        msg: 'Account address not found! Please check if your wallet is connected.',
        style: 'text-red-700 font-bold',
      })
      return
    }

    if (btnStates.actionLoading) {
      return // Exit method if another action is already loading
    }

    // Update Buton state 'actionLoading' to true
    updateBtnStates({
      actionLoading: true,
    })

    try {
      // Execute smart contract Create method
      consoleLogger.warn('Executing Create method. Generating new App client!')

      // const appClient = await openBallotMethodManager.createApp(activeAddress)

      const appClient = await openBallotMethodManager.deployApp(activeAddress)

      consoleLogger.warn('Create method successfull in generating new App client!')

      // Execute smart contract setPoll method
      consoleLogger.info('Executing Set Poll method. Generating App client poll!')
      await openBallotMethodManager.setPoll(
        activeAddress,
        appClient.appId,
        currentPollInputs.title,
        currentPollInputs.choices[0],
        currentPollInputs.choices[1],
        currentPollInputs.choices[2],
        BigInt(date.convertDateToUnix(currentPollInputs.startDate)),
        BigInt(date.convertDateToUnix(currentPollInputs.endDate)),
      )

      consoleLogger.info('Set Poll method successfuly generated App client poll!')

      // Set newly generated appClient.appId as outer-scope currentAppId
      setCurrentAppId(appClient.appId)
    } catch (error) {
      consoleLogger.error('Error creating new App Client!', error)
    } finally {
      // Finally, update Buton state 'actionLoading' back to false
      updateBtnStates({
        actionLoading: false,
      })
    }
  }

  // * BUTTON LOGIC*
  // Execute when Start button is clicked
  const onStartBtnClick = () => {
    // Prompt user if they press the Start button without connecting their wallet first
    if (!activeAddress) {
      setUserMsg({
        msg: 'Account address not found! Please check if your wallet is connected.',
        style: 'text-red-700 font-bold',
      })
    } else {
      // User has connected wallet and presses Start
      setUserMsg({ msg: '', style: '' }) // clear user message panel
      setActiveSection('CREATION') // set UI section to 'CREATION'
    }
  }
  // Execute when Create (Poll) button is clicked
  const onCreatePollBtnClick = async (e: React.FormEvent) => {
    e.preventDefault()

    if (btnStates.actionLoading) {
      return // Exit the function or handle accordingly
    }

    updateBtnStates({
      actionLoading: true,
    })

    try {
      await createApp() // Await createApp() when Create (Poll) button is clicked
      setActiveSection('ENGAGEMENT') // Switch UI section to engagement
    } catch (error) {
      consoleLogger.error('Error with Create (Poll) button click!', error)
    } finally {
      // Finally, update Buton state 'actionLoading' back to false
      updateBtnStates({
        actionLoading: false,
      })
    }
  }
  // Execute when Cancel button is clicked
  const onCancelBtnClick = () => {
    // Reset by clearing previous poll inputs stored by user
    setCurrentPollInputs({
      title: '',
      choices: ['', '', ''],
      startDate: '',
      endDate: '',
    })

    setChoiceDecision(null) // Reset choice decision to null

    setActiveSection('HOME') // set UI section to 'HOME'

    // Close any open modals
    setOpenJoinAppModal(false)
    setOpenClearStateModal(false)

    // Reset user message panel every time cancel button is clicked
    setUserMsg({
      msg: '',
      style: '',
    })
  }
  // Execute when Delete button is clicked
  const onDeleteBtnClick = async () => {
    if (!currentAppClient?.appId) {
      consoleLogger.error('Broke out onDeleteBtnClick: currentAppClient.appId not found!')
      return
    }

    try {
      // Check if the current address matches the creator address before proceeding
      if (currentAppClient.creatorAddress !== activeAddress) {
        setUserMsg({
          msg: 'You are not authorized to delete this app.',
          style: 'text-red-700 font-bold',
        })
        return // Return and break out if user is not authorized to delete currentAppClient
      }

      // Execute smart contract deleteApp method
      consoleLogger.info(`Executing Delete App on client with App ID: ${currentAppClient.appId.toString()}!`)
      await openBallotMethodManager.deleteApp(currentAppClient.creatorAddress, currentAppClient.appId)
      consoleLogger.info(`Delete App method successful on client with App ID: ${currentAppClient.appId.toString()}!`)

      // Clear current App Client data
      setCurrentAppId(null)
      setCurrentAppClient(null)

      setActiveSection('HOME') // Switch UI section to home

      // Notify user of success
      setUserMsg({
        msg: `App with ID: ${currentAppClient?.appId.toString()} successfully deleted.`,
        style: 'text-green-700 font-bold',
      })
    } catch (error) {
      consoleLogger.error(`Error executing Delete App method on client with App ID: ${currentAppClient.appId.toString()}!`, error)

      // Notify user of error
      setUserMsg({
        msg: `App with ID: ${currentAppClient?.appId.toString()} failed to be deleted.`,
        style: 'text-red-700 font-bold',
      })
    }
  }

  // Execute when Opt In button is clicked
  const onOptInBtnClick = async () => {
    if (!activeAddress) {
      consoleLogger.error('Broke out onOptInBtnClick: activeAddress not found!')
      setUserMsg({
        msg: 'Account address not found! Please check if your wallet is connected.',
        style: 'text-red-700 font-bold',
      })
      return
    }

    if (!currentAppClient?.appId) {
      consoleLogger.error('Broke out onOptInBtnClick: currentAppClient not found!')
      setUserMsg({
        msg: 'Client App ID not found!',
        style: 'text-red-700 font-bold',
      })
      return
    }

    if (currentAppClient?.isOptedIn) {
      consoleLogger.error('Broke out onOptInBtnClick: activeAddress already opted in!')
      setUserMsg({
        msg: `This account is already opted in to client with App ID: ${currentAppClient.appId.toString()}!`,
        style: 'text-red-700 font-bold',
      })
      return
    }

    if (btnStates.actionLoading) {
      return // Exit method if another action is already loading
    }

    // Update Buton state 'actionLoading' to true
    updateBtnStates({
      actionLoading: true,
    })

    try {
      // Execute smart contract OptIn method
      consoleLogger.info(`Executing Opt In method on client with App ID: ${currentAppClient.appId.toString()}!`)
      await openBallotMethodManager.optIn(activeAddress, currentAppClient?.appId)
      consoleLogger.info(`Opt In method successfull on client with App ID: ${currentAppClient.appId.toString()}!`)

      // Update Buton state 'optedIn' to true
      updateBtnStates({
        optedIn: true,
      })

      // Create updatedAppClient variable that takes current App Client and sets its opt in property to true
      const updatedAppClient = {
        ...currentAppClient,
        isOptedIn: true,
      }

      // Set updatedApp as new currentAppClient
      setCurrentAppClient(updatedAppClient)

      // Notify user of success
      setUserMsg({
        msg: `Your account has successfully opted in to client with App ID: ${currentAppClient.appId.toString()}`,
        style: 'text-green-700 font-bold',
      })
    } catch (error) {
      consoleLogger.error(`Error executing Opt In method on client with App ID: ${currentAppClient.appId.toString()}!`, error)

      // Notify user of error
      setUserMsg({
        msg: `Error! Failed to opt in client with App with ID: ${currentAppClient?.appId.toString()}.`,
        style: 'text-red-700 font-bold',
      })
    } finally {
      // Finally, update Buton state 'actionLoading' back to false
      updateBtnStates({
        actionLoading: false,
      })
    }
  }

  // Execute when Opt Out button is clicked
  const onOptOutBtnClick = async () => {
    if (!activeAddress) {
      consoleLogger.error('Broke out onOptOutBtnClick: activeAddress not found!')
      setUserMsg({
        msg: 'Account address not found! Please check if your wallet is connected.',
        style: 'text-red-700 font-bold',
      })
      return
    }

    if (!currentAppClient?.appId) {
      consoleLogger.error('Broke out onOptOutBtnClick: currentAppclient.appiD not found!!')
      setUserMsg({
        msg: 'Client App ID not found!',
        style: 'text-red-700 font-bold',
      })
      return
    }

    if (!currentAppClient?.isOptedIn) {
      consoleLogger.error('Broke out onOptOutBtnClick: activeAddress not opted in!')
      setUserMsg({
        msg: `This account is not opted in to client with App ID: ${currentAppClient.appId.toString()}!`,
        style: 'text-red-700 font-bold',
      })
      return
    }

    if (btnStates.actionLoading) {
      return // Exit method if another action is already loading
    }

    // Update Buton state 'actionLoading' to true
    updateBtnStates({
      actionLoading: true,
    })

    try {
      // Execute smart contract OptOut method
      consoleLogger.info(`Executing Opt Out method on client with App ID: ${currentAppClient.appId.toString()}!`)
      await openBallotMethodManager.optOut(activeAddress, currentAppClient?.appId)
      consoleLogger.info(`Opt Out method successfull on client with App ID: ${currentAppClient.appId.toString()}!`)

      // Update Buton state 'optedIn' to true
      updateBtnStates({
        optedIn: false,
      })

      // Create updatedAppClient variable that takes current App Client and sets its opt in property to true
      const updatedAppClient = {
        ...currentAppClient,
        isOptedIn: false,
      }

      // Set updatedApp as new currentAppClient
      setCurrentAppClient(updatedAppClient) // Schedule state update

      // Notify user of success
      setUserMsg({
        msg: `Your account has successfully opted out of client with App ID: ${currentAppClient.appId.toString()}`,
        style: 'text-green-700 font-bold',
      })

      consoleLogger.info(activeAddress, 'has been successfully opted out of App ID:', currentAppClient?.appId)
    } catch (error) {
      consoleLogger.error(`Error executing Opt Out method on client with App ID: ${currentAppClient.appId.toString()}!`, error)

      // Notify user of error
      setUserMsg({
        msg: `Error. Failed to opt out of client with App with ID: ${currentAppClient?.appId.toString()}.`,
        style: 'text-red-700 font-bold',
      })
    } finally {
      // Finally, update Buton state 'actionLoading' back to false
      updateBtnStates({
        actionLoading: false,
      })
    }
  }

  // Execute when Submit Vote button is clicked
  const onSubmitVoteBtnClick = async () => {
    if (!activeAddress) {
      consoleLogger.error('Broke out onSubmitVoteBtnClick: activeAddress not found!')
      setUserMsg({
        msg: 'Account address not found! Please check if your wallet is connected.',
        style: 'text-red-700 font-bold',
      })
      return
    }

    if (!currentAppClient) {
      consoleLogger.error('Broke out onSubmitVoteBtnClick: currentAppClient not found!!')
      setUserMsg({
        msg: 'App Client not found!',
        style: 'text-red-700 font-bold',
      })
      return
    }

    if (!votingPeriod.open) {
      consoleLogger.error('Broke out onSubmitVoteBtnClick: votingPeriod.open is false!')
      setUserMsg({
        msg: 'Voting Close! You can only submit a vote within the valid voting time period.',
        style: 'text-red-700 font-bold',
      })
      return
    }

    if (choiceDecision === null) {
      consoleLogger.error('Broke out onSubmitVoteBtnClick: choiceDecision is null!')
      setUserMsg({
        msg: 'You need to decide on a choice in order to submit vote!',
        style: 'text-red-700 font-bold',
      })
      return
    }

    if (btnStates.actionLoading) {
      return // Exit method if another action is already loading
    }

    // Update Buton state 'actionLoading' to true
    updateBtnStates({
      actionLoading: true,
    })

    try {
      // Execute smart contract submitVote method
      consoleLogger.info(`Executing Submit Vote method on client with App ID: ${currentAppClient.appId.toString()}!`)
      await openBallotMethodManager.submitVote(activeAddress, currentAppClient?.appId, choiceDecision)
      consoleLogger.info(`Submit Vote method successfull on client with App ID: ${currentAppClient.appId.toString()}!`)
      consoleLogger.info(`Submit Vote method successfull for account address: ${activeAddress}`)

      // Reset by clearing previous poll inputs stored by user
      setCurrentPollInputs({
        title: '',
        choices: ['', '', ''],
        startDate: '',
        endDate: '',
      })

      // Update Buton state 'voteSubmitted' to true
      updateBtnStates({
        voteSubmitted: true,
      })

      // Use local values for immediate adjustments
      const updatedAppClient = {
        ...currentAppClient,
        pollVoteStatus: 1,
        pollVoteChoice: Number(choiceDecision),
      }

      // Set updatedApp as new currentAppClient
      setCurrentAppClient(updatedAppClient)

      // Notify user
      setUserMsg({
        msg: `Your vote for client with App ID: ${currentAppClient.appId.toString()} has been submitted! Thank you for participating!`,
        style: 'text-green-700 font-bold',
      })
    } catch (error) {
      consoleLogger.error(`Error executing Submit Vote method on client with App ID: ${currentAppClient.appId.toString()}!`, error)
    } finally {
      // Finally, update Buton state 'actionLoading' back to false
      updateBtnStates({
        actionLoading: false,
      })
    }
  }

  // * POLL INPUTS LOGIC *
  // Handle updating poll inputs by html element 'name' reference (title, start date, end date)
  const handlePollInputChangeByName = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value, type } = e.target

    // Only format datetime-local inputs
    if (type === 'datetime-local' && value.length === 16) {
      setCurrentPollInputs((prev) => ({
        ...prev,
        [name]: `${value}:00`,
      }))
    } else {
      setCurrentPollInputs((prev) => ({
        ...prev,
        [name]: value,
      }))
    }
  }

  // Handle updating poll inputs for 'array' field (choices)
  const handlePollChoicesArrayChange = (index: number, value: string): void => {
    setCurrentPollInputs((prev) => {
      const updatedChoices = [...prev.choices]
      updatedChoices[index] = value
      return { ...prev, choices: updatedChoices }
    })
  }

  // Break into new line when poll input exceeds a certain amount of characters per line
  const formatpollInputWithLineBreak = (text: string | undefined, charsPerLine: number): string => {
    if (!text) return 'No Text Available' // Fallback for undefined or empty text

    let formattedText = ''
    for (let i = 0; i < text.length; i += charsPerLine) {
      formattedText += text.slice(i, i + charsPerLine)
      if (i + charsPerLine < text.length) {
        formattedText += '<br />'
      }
    }
    return formattedText
  }

  return (
    <div className="hero min-h-screen bg-slate-800">
      <div className="hero-content max-w-full text-center rounded-lg p-10 bg-blue-100">
        <div className="max-w-full">
          <h1 className="pb-4 text-[56px] font-bold">Welcome to Brez Imena</h1>
          <p className={`mb-6 text-[20px] ${userMsg.style}`}>{userMsg.msg}</p>
          {activeSection === 'HOME' && (
            // Home Section
            <div className="mt-6 flex justify-center">
              <button className={button.setBtnStyle('start')} onClick={onStartBtnClick}>
                Start
              </button>

              <button className={button.setBtnStyle('join')} onClick={toggleJoinAppModal}>
                Join
              </button>

              <JoinAppModal algorand={algorand} openModal={openJoinAppModal} closeModal={toggleJoinAppModal} onModalExe={onJoinApp} />

              <button className={button.setBtnStyle('clear')} onClick={toggleClearStateModal}>
                Clear
              </button>

              <ClearStateModal
                algorand={algorand}
                openModal={openClearStateModal}
                closeModal={toggleClearStateModal}
                onModalExe={onClearState}
              />

              <button className={button.setBtnStyle('wallet')} onClick={toggleWalletModal}>
                Tekvin
              </button>

              <ConnectWallet openModal={openWalletModal} closeModal={toggleWalletModal} />
            </div>
          )}
          {activeSection === 'CREATION' && (
            // Creation Section
            <div>
              <div className="mt-2 max-w-full mx-auto">
                <form className="space-y-2 max-w-full bg-white p-4 rounded-lg shadow-lgb border-2 border-black">
                  <h2 className="text-4xl font-bold text-center mb-4">Create New Poll</h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-lg font-bold text-gray-700 mb-2">Poll Title</label>
                      <input
                        type="text"
                        name="title"
                        placeholder="Title"
                        autoComplete="off"
                        value={currentPollInputs.title}
                        onChange={handlePollInputChangeByName}
                        className={`w-full p-3 border rounded-md focus:outline-none ${date.setTitleInputVisualAid(currentPollInputs.title)}`} // Apply title visual aid
                        required
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="block text-lg font-bold text-gray-700">Choices (required)</label>
                      {currentPollInputs.choices.map((choice, index) => (
                        <input
                          key={index}
                          type="text"
                          placeholder={`Choice ${index + 1}`}
                          value={choice}
                          onChange={(e) => handlePollChoicesArrayChange(index, e.target.value)}
                          className={`w-full p-3 border rounded-md focus:outline-none ${date.setChoicesInputVisualAid(currentPollInputs.choices)[index]}`} // Apply individual choice visual aid
                          required
                        />
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-lg font-bold text-gray-700 mb-2">Start Date</label>
                        <input
                          type="datetime-local"
                          step="1" // Include seconds in 'datetime-local'
                          name="startDate"
                          value={currentPollInputs.startDate}
                          onChange={handlePollInputChangeByName}
                          className={`w-full p-3 border rounded-md focus:outline-none ${date.setDateInputsVisualAid(
                            currentPollInputs.startDate,
                            currentPollInputs.endDate,
                          )}`}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-lg font-bold text-gray-700 mb-2">End Date</label>
                        <input
                          type="datetime-local"
                          step="1" // Include seconds in 'datetime-local'
                          name="endDate"
                          value={currentPollInputs.endDate}
                          onChange={handlePollInputChangeByName}
                          className={`w-full p-3 border rounded-md focus:outline-none ${date.setDateInputsVisualAid(
                            currentPollInputs.startDate,
                            currentPollInputs.endDate,
                          )}`}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-center mt-6 pt-4">
                    <button
                      type="submit"
                      disabled={button.checkBtnState('create', btnStates)} // Use the state value here
                      className={`btn w-36 h-14 justify-center rounded-md text-[24px] tracking-wide font-bold m-2 ${
                        btnStates.pollInputsValid
                          ? 'bg-yellow-300 hover:bg-green-500 border-[3px] border-black hover:border-[4px] hover:border-green-700'
                          : 'bg-gray-400 border-[3px] border-gray-600 cursor-not-allowed'
                      }`}
                      onClick={onCreatePollBtnClick} // Handle button click
                    >
                      Create
                    </button>

                    <button type="button" onClick={onCancelBtnClick} className={button.setBtnStyle('cancel')}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
          {activeSection === 'ENGAGEMENT' && (
            // Engagement Section
            <div className="voting-section mt-4 p-6 max-w-4xl bg-white rounded-lg shadow-lg border-2 border-black mx-auto">
              <h1
                className="text-[36px] font-bold text-center mb-4 underline"
                dangerouslySetInnerHTML={{
                  __html: formatpollInputWithLineBreak(currentAppClient?.pollTitle ?? '', 40),
                }}
              />
              <div className="space-y-2">
                <p className="text-[20px] -mt-2 font-bold text-gray-800">
                  Is Voting Open :{' '}
                  <span className={votingPeriod.open ? 'font-bold text-green-700' : 'text-red-700'}>{votingPeriod.msg}</span>
                </p>
                {currentAppClient?.pollVoteStatus === 1 && (
                  <p className="text-[20px] font-bold text-green-700">You have already submitted your vote for this poll!</p>
                )}
                <div>
                  <p className="text-[20px] text-left font-semibold underline mb-4">Choices:</p>
                  <ul className="space-y-2">
                    {[currentAppClient?.pollChoice1, currentAppClient?.pollChoice2, currentAppClient?.pollChoice3].map(
                      (choice, index) =>
                        choice && (
                          <li key={index} className="flex items-center space-x-3">
                            <input
                              type="radio"
                              id={`choice-${index}`}
                              name="vote"
                              value={choice}
                              className="form-radio h-5 w-5 text-green-500"
                              onChange={() => {
                                setChoiceDecision(BigInt(index + 1))
                                setChoiceDisplay({ index: index + 1, text: choice || '' })
                              }}
                              disabled={button.checkBtnState('choices', btnStates)}
                            />
                            <label
                              htmlFor={`choice-${index}`}
                              className="text-[20px] font-bold"
                              dangerouslySetInnerHTML={{
                                __html: formatpollInputWithLineBreak(choice, 80) || `Choice ${index + 1}`,
                              }}
                            />
                          </li>
                        ),
                    )}
                  </ul>
                  {currentAppClient?.pollVoteStatus === 1 && (
                    <p className="text-[26px] font-bold text-gray-800">
                      You have voted for choice: <span className="font-bold text-green-700">{choiceDisplay.text}</span>
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-6 flex justify-center">
                <button
                  disabled={button.checkBtnState('optIn', btnStates)}
                  onClick={onOptInBtnClick}
                  className={button.setBtnStyle('optIn')}
                >
                  Opt In
                </button>

                <button
                  disabled={button.checkBtnState('optOut', btnStates)}
                  onClick={onOptOutBtnClick}
                  className={button.setBtnStyle('optOut')}
                >
                  Opt Out
                </button>

                <button
                  disabled={button.checkBtnState('submitVote', btnStates)}
                  onClick={onSubmitVoteBtnClick}
                  className={button.setBtnStyle('submitVote')}
                >
                  Submit Vote
                </button>

                <button
                  disabled={button.checkBtnState('delete', btnStates) || !currentAppClient?.creatorAddress || !currentAppClient?.appId}
                  onClick={onDeleteBtnClick}
                  className={button.setBtnStyle('delete')}
                >
                  Delete
                </button>

                <button onClick={onCancelBtnClick} className={button.setBtnStyle('cancel')}>
                  Cancel
                </button>
              </div>
            </div>
          )}
          {/* App client basic information (displayed when engagement section is active)*/}
          {activeSection === 'ENGAGEMENT' &&
            (currentAppId ? (
              <AppBaseInfo algorand={algorand} appId={currentAppId} setUserMsg={setUserMsg} />
            ) : (
              <p className="text-red-700">No valid App ID available for voting.</p>
            ))}
        </div>
      </div>
    </div>
  )
}
export default Home
