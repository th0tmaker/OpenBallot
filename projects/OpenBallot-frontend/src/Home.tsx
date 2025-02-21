//src/Home.tsx

import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { consoleLogger } from '@algorandfoundation/algokit-utils/types/logging'
import { useWallet } from '@txnlab/use-wallet'
import { decodeAddress, encodeAddress } from 'algosdk'
import React, { useCallback, useEffect, useState } from 'react'
import { AppBaseInfo } from './components/AppBaseInfo'
import ConnectWallet from './components/ConnectWallet'
import DeleteAppModal from './components/DeleteApp'
import JoinAppModal from './components/JoinApp'
import * as iInterface from './interfaces/index'
import { OpenBallotMethodManager } from './methods'
import { UISectionState } from './types'
import * as button from './utils/buttons'
import * as date from './utils/dates'
import * as pollInputs from './utils/pollInputs'

// Algorand client setup
const algorand = AlgorandClient.defaultLocalNet()

const Home: React.FC = () => {
  // Wallet Address & Signer
  const { activeAddress, signer } = useWallet() // Get connected wallet active address and signer

  algorand.setDefaultSigner(signer) // Pass the signer object from the wallet as the default signer for every transaction
  const openBallotMethodManager = new OpenBallotMethodManager(algorand, activeAddress ?? '')

  // Modals
  const [modals, setModals] = useState<iInterface.ModalStateFlags>({
    wallet: false,
    joinApp: false,
    deleteApp: false,
  })

  // App Client State
  const [currentAppId, setCurrentAppId] = useState<bigint | null>(null) // Current App ID (for loading App Global State)
  const [currentAppClient, setCurrentAppClient] = useState<iInterface.AppClientProps | null>(null)

  // const hasLoadedApp = useRef<{ [key: string]: boolean }>({})

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

  const [votingPeriod, setVotingPeriod] = useState({ open: false, msg: 'No' }) // Track if poll voting period is over

  // UI Section Display State
  const [activeSection, setActiveSection] = useState<UISectionState>('HOME') // Set and update the UI diplay sections

  // Button State
  const { btnStates, updateBtnStates } = button.useBtnState() // Set and update the state of buttons

  // ==================================================
  // * EVENT LISTENER (manage lifecycle side-effects) *
  // ==================================================

  // Checking the validity of user-provided poll inputs
  useEffect(() => {
    // Check validity any time poll inputs exist and 'CREATION' section is active
    if (currentPollInputs && activeSection === 'CREATION') {
      // Process poll inputs
      const arePollInputsValid = pollInputs.processPollInputs(currentPollInputs, activeSection, setUserMsg)
      updateBtnStates({ pollInputsValid: arePollInputsValid }) // Update the button state accordingly
    }
  }, [currentPollInputs, btnStates.pollInputsValid, activeSection === 'CREATION', setUserMsg])

  // Load App Client Global State
  useEffect(() => {
    const loadGlobalState = async () => {
      // Return and escape if circumstances below
      if (!currentAppId || !activeAddress || activeSection !== 'ENGAGEMENT') return

      // Proceed
      try {
        await queryGlobalState()
        consoleLogger.info(`Global State for App client with ID: ${currentAppId.toString()} has been loaded successfully!`)
      } catch (error) {
        consoleLogger.error(`Error loading Global State for App client with ID: ${currentAppId.toString()}!`, error)
      }
    }

    loadGlobalState() // Call method
  }, [currentAppId, activeSection == 'ENGAGEMENT']) // Trigger effect re-run based on the values of the variables it contains

  // Load App Client Local State
  // useEffect(() => {
  //   const loadLocalState = async () => {
  //     // Return and escape if no wallet active address found or App ID is null
  //     if (!activeAddress || !currentAppClient?.appId) return

  //     try {
  //       // If wallet connected, proceed with loading App client State
  //       const localState = await queryLocalState(currentAppClient.appId, activeAddress) // query account Local State on App client
  //       consoleLogger.info(`Local State for App client with ID: ${currentAppClient.appId.toString()} has been loaded successfully!`)

  //       if (localState) {
  //         const { optedIn, localVoteStatus, localVoteChoice } = localState
  //         // If account with active address has voted, display their vote choice on screen based on its corresponding number
  //         if (localVoteStatus === 1) {
  //           if (localVoteChoice === 1) {
  //             setChoiceDisplay({ index: localVoteChoice, text: currentAppClient.pollChoice1 })
  //           } else if (localVoteChoice === 2) {
  //             setChoiceDisplay({ index: localVoteChoice, text: currentAppClient.pollChoice2 })
  //           } else if (localVoteChoice === 3) {
  //             setChoiceDisplay({ index: localVoteChoice, text: currentAppClient.pollChoice3 })
  //           }
  //         }

  //         // Check voting status (if voting is open or closed)
  //         const currentVotingPeriod = date.checkVotingPeriod(currentAppClient.pollStartDateUnix, currentAppClient.pollEndDateUnix)
  //         setVotingPeriod(currentVotingPeriod) // Set 'votingPeriod'

  //         consoleLogger.info('Voting Status:', currentVotingPeriod)

  //         // Update the button states based on the Local State key-value pairs
  //         updateBtnStates({
  //           optedIn,
  //           pollVotingPeriodOpen: currentVotingPeriod.open,
  //           voteSubmitted: !optedIn || !currentVotingPeriod.open || localVoteStatus === 1,
  //         })

  //         // Update the 'currentAppClient' with the refreshed Local State values
  //         const updatedAppClient = {
  //           ...currentAppClient,
  //           pollVoteStatus: localVoteStatus,
  //           pollVoteChoice: localVoteChoice,
  //           isOptedIn: optedIn,
  //         }

  //         // Pass 'updatedAppClient' as new 'currentAppClient'
  //         setCurrentAppClient(updatedAppClient)
  //         consoleLogger.info('LocaL State queried and updated with new values:', updatedAppClient)
  //       }
  //     } catch (error) {
  //       consoleLogger.error(`Error loading Local State for App client with ID: ${currentAppClient.appId.toString()}!`, error)
  //     }
  //   }

  //   loadLocalState()
  // }, [activeAddress, currentAppClient?.isOptedIn])

  // ================
  // * MODAL EVENTS *
  // ================

  // Toggle the state of selected modal

  // Function to check the voting period status
  const checkVotingStatus = () => {
    if (currentAppClient && activeSection === 'ENGAGEMENT') {
      const currentVotingPeriod = date.checkVotingPeriod(currentAppClient.pollStartDateUnix, currentAppClient.pollEndDateUnix)
      if (currentVotingPeriod.open === votingPeriod.open) {
        return // Return early if the voting period status hasn't changed
      }

      // Update votingPeriod and button state
      setVotingPeriod(currentVotingPeriod)
      consoleLogger.info('Voting Status:', currentVotingPeriod)

      updateBtnStates({
        pollVotingPeriodOpen: currentVotingPeriod.open,
      })
    }
  }

  const toggleModal = (modal: keyof iInterface.ModalStateFlags, state?: boolean) => {
    setModals((prev) => ({
      ...prev,
      [modal]: state !== undefined ? state : !prev[modal],
    }))
  }

  // Join existing App Client by passing the JoinApp modal App ID
  const handleJoinApp = async (appId: bigint): Promise<boolean | null> => {
    // Check if the active address exists
    if (!activeAddress) {
      consoleLogger.error('Broke out handleJoinApp: activeAddress not found!')
      setUserMsg({
        msg: 'Can not proceed without establishing a wallet connection.',
        style: 'text-red-700 font-bold',
      })
      return null
    }

    try {
      consoleLogger.info(`Joining client with App ID: ${appId.toString()}!`)

      // Set appId as 'currentAppId'
      setCurrentAppId(appId) // Pass App ID from JoinApp modal

      setActiveSection('ENGAGEMENT') // Switch UI section to engagement

      toggleModal('joinApp', false) // Close Join App modal

      return true // Successfully joined
    } catch (error) {
      consoleLogger.error(`Error joining App client with ID: ${appId.toString()}!`, error)
      return null // Return null if an error occurs
    }
  }

  // // Execute Clear State on existing App Client by passing the ClearState in order to opt out and free up Local schema MBR without fail
  // const onClearState = async (appId: bigint): Promise<boolean | null> => {
  //   // Check if the active address exists
  //   if (!activeAddress) {
  //     consoleLogger.error('Broke out onClearState: activeAddress not found!')
  //     return null
  //   }

  //   try {
  //     // Execute smart contract clearState method
  //     consoleLogger.info(`Executing Clear State on client with App ID: ${appId.toString()}!`)
  //     await openBallotMethodManager.clearState(activeAddress, appId)
  //     consoleLogger.info(`Clear State successful on client with App ID: ${appId.toString()}!`)

  //     setUserMsg({
  //       msg: `Clear State successful on client with App ID: ${appId.toString()}.`,
  //       style: 'text-green-700 font-bold',
  //     })

  //     setOpenClearStateModal(false) // Close Clear State modal
  //     return true // Successfully cleared state
  //   } catch (error) {
  //     consoleLogger.error(`Error executing Clear State on client with App ID: ${appId.toString()}!`, error)
  //     return null // Return null if an error occurs
  //   }
  // }

  const handleDeleteApp = async (appId: bigint): Promise<boolean | null> => {
    // Check if the active address exists
    if (!activeAddress) {
      consoleLogger.error('Broke out handleDeleteApp: activeAddress not found!')
      setUserMsg({
        msg: 'No active address found. Check wallet connection.',
        style: 'text-red-700 font-bold',
      })
      return null
    }

    // Check if the current address matches the creator address before proceeding
    if (currentAppClient?.creatorAddress !== activeAddress) {
      consoleLogger.error('Broke out handleDeleteApp: currentAppClient.creatorAddress is not equal to activeAddress!')
      setUserMsg({
        msg: 'You are not authorized to delete this app.',
        style: 'text-red-700 font-bold',
      })
      return null // Return and break out if user is not authorized to delete currentAppClient
    }

    try {
      // Execute smart contract deleteApp method
      consoleLogger.info(`Executing Delete App on client with App ID: ${appId.toString()}!`)
      await openBallotMethodManager.deleteApp(currentAppClient.creatorAddress, currentAppClient.appId)
      consoleLogger.info(`Delete App successful on client with App ID: ${appId.toString()}!`)

      setUserMsg({
        msg: `Delete App successful on client with App ID: ${appId.toString()}.`,
        style: 'text-green-700 font-bold',
      })

      // Clear current App Client data
      setCurrentAppId(null)
      setCurrentAppClient(null)

      toggleModal('deleteApp', false) // Close Delete App modal

      return true // Successfully cleared state
    } catch (error) {
      consoleLogger.error(`Error executing Delete App on client with App ID: ${appId.toString()}!`, error)
      return null // Return null if an error occurs
    }
  }

  // ==================================
  // * ALGORAND CLIENT DATA RETRIEVAL *
  // ==================================

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
      const totalPurgedBoxA_ = BigInt(appGlobalState['total_purged_box_a_']?.value ?? null)
      const pollStartDateUnix = BigInt(appGlobalState['poll_start_date_unix']?.value ?? 0)
      const pollEndDateUnix = BigInt(appGlobalState['poll_end_date_unix']?.value ?? 0)
      console.log('totalPurgedBoxA_', totalPurgedBoxA_)
      // Convert the poll start and end dates into unix integers into string appropriate format
      const pollStartDateStr = date.convertUnixToDate(pollStartDateUnix)
      const pollEndDateStr = date.convertUnixToDate(pollEndDateUnix)

      // Check voting status (if voting is open or closed)
      const currentVotingPeriod = date.checkVotingPeriod(pollStartDateUnix, pollEndDateUnix)
      setVotingPeriod(currentVotingPeriod) // Set 'votingPeriod'
      consoleLogger.info('Voting Status:', currentVotingPeriod)

      const appBoxes = await algorand.app.getBoxNames(currentAppId)
      const boxAddresses = appBoxes.map((box) => encodeAddress(new Uint8Array(Buffer.from(box.nameBase64, 'base64')).slice(-32)))
      consoleLogger.info('boxAddressses len:', boxAddresses.length)
      let hasVoted = null
      let votedFor = null
      if (boxAddresses.includes(activeAddress)) {
        try {
          const boxName = new Uint8Array([
            ...Buffer.from('a_'), // Prefix
            ...decodeAddress(activeAddress).publicKey, // Address in Uint8Array format
          ])
          const boxVal = await algorand.app.getBoxValue(currentAppId, boxName)
          if (boxVal) {
            hasVoted = Number(boxVal[0]) // First byte: hasVoted
            votedFor = Number(boxVal[1]) // Second byte: votedFor
          }
        } catch (error) {
          consoleLogger.error('Error fetching box value:', error)
          // Handle the error (e.g., box doesn't exist)
        }
      }

      // Update the button states based on whether the active address has box storage
      updateBtnStates({
        hasBoxStorage: boxAddresses.includes(activeAddress),
        isCreator: activeAddress === app.creator,
        voteSubmitted: hasVoted == 1,
        ableToPurgeBoxA_: boxAddresses.length !== 1,
        pollVotingPeriodOpen: currentVotingPeriod.open,
      })

      // Use AppClientProps interface to construct an object representing the new state of the current App Client based on its Global State data
      const newAppClient: iInterface.AppClientProps = {
        appId: app.appId,
        appAddress: app.appAddress,
        creatorAddress: app.creator,
        pollTitle: String(pollTitle),
        pollChoice1: String(pollChoice1),
        pollChoice2: String(pollChoice2),
        pollChoice3: String(pollChoice3),
        pollStartDate: pollStartDateStr,
        pollEndDate: pollEndDateStr,
        pollStartDateUnix: pollStartDateUnix,
        pollEndDateUnix: pollEndDateUnix,
        boxes: boxAddresses,
        // hasBoxStorage: boxAddresses.includes(activeAddress),
        hasVoted: hasVoted,
        votedFor: votedFor,
      }

      // Set new App client state object as 'currentAppClient'
      setCurrentAppClient(newAppClient)

      consoleLogger.info(newAppClient.boxes.toString())
      // consoleLogger.info(newAppClient.hasBoxStorage.toString())
      consoleLogger.info(newAppClient.hasVoted?.toString() ?? '')
      consoleLogger.info(newAppClient.votedFor?.toString() ?? '')

      consoleLogger.info(`Global State for App client with ID: ${currentAppId.toString()} has been queried successfully!`)
    } catch (error) {
      consoleLogger.error(`Failed to query Global State for App client with ID: ${currentAppId.toString()}!`)
    }
  }, [activeAddress, currentAppId, algorand.app, votingPeriod])

  // // Create a method that requests Local State information of an account for a specific client by passing the account address and client App ID through the Algorand client
  // const queryLocalState = async (appId: bigint, address: string) => {
  //   if (!activeAddress) {
  //     consoleLogger.error('Broke out queryLocalState: activeAddress not found!')
  //     setUserMsg({
  //       msg: 'Account address not found! Please check if your wallet is connected.',
  //       style: 'text-red-700 font-bold',
  //     })
  //     return
  //   }

  //   if (!appId) {
  //     consoleLogger.error('Broke out queryLocalState: App ID not found!')
  //     setUserMsg({
  //       msg: `Client with App ID: ${appId?.toString()} not found.`,
  //       style: 'text-red-700 font-bold',
  //     })
  //     return
  //   }

  //   try {
  //     // Query account address information from specific client by passing its App ID
  //     const accountAppInfo = await algorand.client.algod.accountApplicationInformation(address, Number(appId)).do()

  //     // Check access to account Local State
  //     const accountLocalState = accountAppInfo['app-local-state']

  //     // If there is no data about account Local State tied to queried App Client (then account is NOT opted in to client)
  //     if (!accountLocalState) {
  //       consoleLogger.info(`No Local State found for Account with address: ${address}. Check if Account is opted in.`)

  //       // Return Local State keys with following default values
  //       return { optedIn: false, localVoteStatus: null, localVoteChoice: null }
  //     }

  //     // If data about account Local State tied to queried App client exists (then account is opted in), proceed with data extraction
  //     const accountLocalVoteStatus = Number(accountLocalState['key-value']?.[1]?.['value']?.['uint'])
  //     const accountLocalVoteChoice = Number(accountLocalState['key-value']?.[0]?.['value']?.['uint'])

  //     // Return Local State keys with extracted values
  //     return { optedIn: true, localVoteStatus: accountLocalVoteStatus, localVoteChoice: accountLocalVoteChoice }
  //   } catch (error) {
  //     consoleLogger.error('Error querying local state:', error)
  //     consoleLogger.error(`Failed to query Local State for Account Address: ${address} tied to App client with ID: ${appId.toString()}!`)

  //     // If error fetching data, return Local State keys with following default values
  //     return { optedIn: false, localVoteStatus: null, localVoteChoice: null }
  //   }
  // }

  // Create a new OpenBallot smart contract App client
  const initNewApp = async () => {
    if (!activeAddress) {
      consoleLogger.error('Broke out initNewApp: activeAddress not found!')
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
      consoleLogger.info('Executing Create method. Generating new App client!')

      // Uncomment this if you want to create the application straight up with no additional params
      // const appClient = await openBallotMethodManager.createApp(activeAddress)

      // Uncomment this if you want to deploy the application with additional params
      const appClient = await openBallotMethodManager.deployApp(activeAddress)

      consoleLogger.info('Create method successfully generated new App client!')

      // Execute Atomic transaction w/ setPoll and fundAppMbr methods
      await openBallotMethodManager.setPollFundAppMbrAtxn(
        activeAddress,
        appClient.appId,
        currentPollInputs.title,
        currentPollInputs.choices[0],
        currentPollInputs.choices[1],
        currentPollInputs.choices[2],
        BigInt(date.convertDateToUnix(currentPollInputs.startDate)),
        BigInt(date.convertDateToUnix(currentPollInputs.endDate)),
      )

      consoleLogger.info('Set Poll + Fund App MBR atomic txn successful!')

      // // Execute smart contract setPoll method
      // consoleLogger.info('Executing Set Poll method. Generating App client poll!')
      // await openBallotMethodManager.setPoll(
      //   activeAddress,
      //   appClient.appId,
      //   currentPollInputs.title,
      //   currentPollInputs.choices[0],
      //   currentPollInputs.choices[1],
      //   currentPollInputs.choices[2],
      //   BigInt(date.convertDateToUnix(currentPollInputs.startDate)),
      //   BigInt(date.convertDateToUnix(currentPollInputs.endDate)),
      // )

      // consoleLogger.info('Set Poll method successfully created App client poll!')

      // // Execute smart contract fundAppMbr method
      // consoleLogger.info('Executing Fund App MBR method. Creator is funding App account balance!')
      // await openBallotMethodManager.fundAppMbr(activeAddress, appClient.appId)

      // consoleLogger.info('Fund App MBR method successfully funded App client!')

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

  // ================
  // * BUTTON LOGIC *
  // ================

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
      await initNewApp() // Await handleAppLaunch() when Create (Poll) button is clicked
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
    if (!activeAddress) {
      consoleLogger.error('Broke out onCancelBtnClick: activeAddress not found!')
      setUserMsg({
        msg: 'Account address not found! Please check if your wallet is connected.',
        style: 'text-red-700 font-bold',
      })
      return
    }

    try {
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
      toggleModal('joinApp', false) // Close Join App modal
      toggleModal('deleteApp', false) // Close Delete App modal

      // Reset user message panel every time cancel button is clicked
      setUserMsg({
        msg: '',
        style: '',
      })
    } catch (error) {
      consoleLogger.error('Error with Create (Poll) button click!', error)
    }
  }

  // Execute when Delete button is clicked
  const onPurgeBoxBtnClick = async () => {
    if (!currentAppClient?.appId) {
      consoleLogger.error('Broke out onPurgeBoxBtnClick: currentAppClient.appId not found!')
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

      if (btnStates.actionLoading) {
        return // Exit the function or handle accordingly
      }

      updateBtnStates({
        actionLoading: true,
      })

      // Execute smart contract purgeBoxStorage method
      consoleLogger.info(`Executing Purge Box Storage on client with App ID: ${currentAppClient.appId.toString()}!`)
      // await openBallotMethodManager.purgeBoxStorage(currentAppClient.creatorAddress, currentAppClient.appId)
      await openBallotMethodManager.purgeBoxStorageAtxn(currentAppClient.creatorAddress, currentAppClient.appId)
      consoleLogger.info(`Purge Box Storage method successful on client with App ID: ${currentAppClient.appId.toString()}!`)

      updateBtnStates({
        actionLoading: false,
        ableToPurgeBoxA_: false,
      })

      // Notify user of success
      setUserMsg({
        msg: `App with ID: ${currentAppClient?.appId.toString()} successfully purged Box Storage.`,
        style: 'text-green-700 font-bold',
      })
    } catch (error) {
      consoleLogger.error(`Error executing Purge Box Storage method on client with App ID: ${currentAppClient.appId.toString()}!`, error)

      // Notify user of error
      setUserMsg({
        msg: `Failed purging Box Storage for App with ID: ${currentAppClient?.appId.toString()}.`,
        style: 'text-red-700 font-bold',
      })
    } finally {
      // Finally, update Buton state 'actionLoading' back to false
      updateBtnStates({
        actionLoading: false,
      })
    }
  }

  // Execute when Request Box button is clicked
  const onRequestBoxBtnClick = async () => {
    if (!activeAddress) {
      consoleLogger.error('Broke out onRequestBoxBtnClick: activeAddress not found!')
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

    if (btnStates.actionLoading) {
      return // Exit method if another action is already loading
    }

    // Update Buton state 'actionLoading' to true
    updateBtnStates({
      actionLoading: true,
    })

    try {
      // Execute smart contract OptIn method
      consoleLogger.info(`Executing Request Box storage method on client with App ID: ${currentAppClient.appId.toString()}!`)
      await openBallotMethodManager.requestBoxStorage(activeAddress, currentAppClient.appId)
      consoleLogger.info(`Request Box storage method successful on client with App ID: ${currentAppClient.appId.toString()}!`)

      // Update Buton state 'optedIn' to true
      updateBtnStates({
        hasBoxStorage: true,
      })

      // Create updatedAppClient variable that takes current App Client and sets its opt in property to true
      // const updatedAppClient = {
      //   ...currentAppClient,
      //   isOptedIn: true,
      // }

      // // Set updatedApp as new currentAppClient
      // setCurrentAppClient(updatedAppClient)

      // Notify user of success
      setUserMsg({
        msg: `Your account has successfully requested Box storage for client with App ID: ${currentAppClient.appId.toString()}`,
        style: 'text-green-700 font-bold',
      })
    } catch (error) {
      consoleLogger.error(`Error executing request Box storage method for client with App ID: ${currentAppClient.appId.toString()}!`, error)

      // Notify user of error
      setUserMsg({
        msg: `Error! Failed to request Box storage for client with App with ID: ${currentAppClient?.appId.toString()}.`,
        style: 'text-red-700 font-bold',
      })
    } finally {
      // Finally, update Buton state 'actionLoading' back to false
      updateBtnStates({
        actionLoading: false,
      })
    }
  }

  // Execute when Delete Box button is clicked
  const onDeleteBoxBtnClick = async () => {
    if (!activeAddress) {
      consoleLogger.error('Broke out onDeleteBoxBtnClick: activeAddress not found!')
      setUserMsg({
        msg: 'Account address not found! Please check if your wallet is connected.',
        style: 'text-red-700 font-bold',
      })
      return
    }

    if (!currentAppClient?.appId) {
      consoleLogger.error('Broke out onDeleteBoxBtnClick: currentAppClient not found!')
      setUserMsg({
        msg: 'Client App ID not found!',
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
      consoleLogger.info(`Executing Delete Box storage method on client with App ID: ${currentAppClient.appId.toString()}!`)
      await openBallotMethodManager.deleteBoxStorage(activeAddress, currentAppClient.appId)
      consoleLogger.info(`Delete Box storage method successful on client with App ID: ${currentAppClient.appId.toString()}!`)

      // Update Buton state 'optedIn' to true
      updateBtnStates({
        hasBoxStorage: false,
      })

      // Create updatedAppClient variable that takes current App Client and sets its opt in property to true
      // const updatedAppClient = {
      //   ...currentAppClient,
      //   isOptedIn: true,
      // }

      // // Set updatedApp as new currentAppClient
      // setCurrentAppClient(updatedAppClient)

      // Notify user of success
      setUserMsg({
        msg: `Your account has successfully deleted Box storage for client with App ID: ${currentAppClient.appId.toString()}`,
        style: 'text-green-700 font-bold',
      })
    } catch (error) {
      consoleLogger.error(`Error executing delete Box storage method for client with App ID: ${currentAppClient.appId.toString()}!`, error)

      // Notify user of error
      setUserMsg({
        msg: `Error! Failed to request Box storage for client with App with ID: ${currentAppClient?.appId.toString()}.`,
        style: 'text-red-700 font-bold',
      })
    } finally {
      // Finally, update Buton state 'actionLoading' back to false
      updateBtnStates({
        actionLoading: false,
      })
    }
  }
  // // Execute when Opt In button is clicked
  // const onOptInBtnClick = async () => {
  //   if (!activeAddress) {
  //     consoleLogger.error('Broke out onOptInBtnClick: activeAddress not found!')
  //     setUserMsg({
  //       msg: 'Account address not found! Please check if your wallet is connected.',
  //       style: 'text-red-700 font-bold',
  //     })
  //     return
  //   }

  //   if (!currentAppClient?.appId) {
  //     consoleLogger.error('Broke out onOptInBtnClick: currentAppClient not found!')
  //     setUserMsg({
  //       msg: 'Client App ID not found!',
  //       style: 'text-red-700 font-bold',
  //     })
  //     return
  //   }

  //   if (currentAppClient?.isOptedIn) {
  //     consoleLogger.error('Broke out onOptInBtnClick: activeAddress already opted in!')
  //     setUserMsg({
  //       msg: `This account is already opted in to client with App ID: ${currentAppClient.appId.toString()}!`,
  //       style: 'text-red-700 font-bold',
  //     })
  //     return
  //   }

  //   if (btnStates.actionLoading) {
  //     return // Exit method if another action is already loading
  //   }

  //   // Update Buton state 'actionLoading' to true
  //   updateBtnStates({
  //     actionLoading: true,
  //   })

  //   try {
  //     // Execute smart contract OptIn method
  //     consoleLogger.info(`Executing Opt In method on client with App ID: ${currentAppClient.appId.toString()}!`)
  //     // await openBallotMethodManager.optIn(activeAddress, currentAppClient?.appId)
  //     consoleLogger.info(`Opt In method successfull on client with App ID: ${currentAppClient.appId.toString()}!`)

  //     // Update Buton state 'optedIn' to true
  //     updateBtnStates({
  //       optedIn: true,
  //     })

  //     // Create updatedAppClient variable that takes current App Client and sets its opt in property to true
  //     const updatedAppClient = {
  //       ...currentAppClient,
  //       isOptedIn: true,
  //     }

  //     // Set updatedApp as new currentAppClient
  //     setCurrentAppClient(updatedAppClient)

  //     // Notify user of success
  //     setUserMsg({
  //       msg: `Your account has successfully opted in to client with App ID: ${currentAppClient.appId.toString()}`,
  //       style: 'text-green-700 font-bold',
  //     })
  //   } catch (error) {
  //     consoleLogger.error(`Error executing Opt In method on client with App ID: ${currentAppClient.appId.toString()}!`, error)

  //     // Notify user of error
  //     setUserMsg({
  //       msg: `Error! Failed to opt in client with App with ID: ${currentAppClient?.appId.toString()}.`,
  //       style: 'text-red-700 font-bold',
  //     })
  //   } finally {
  //     // Finally, update Buton state 'actionLoading' back to false
  //     updateBtnStates({
  //       actionLoading: false,
  //     })
  //   }
  // }

  // // Execute when Opt Out button is clicked
  // const onOptOutBtnClick = async () => {
  //   if (!activeAddress) {
  //     consoleLogger.error('Broke out onOptOutBtnClick: activeAddress not found!')
  //     setUserMsg({
  //       msg: 'Account address not found! Please check if your wallet is connected.',
  //       style: 'text-red-700 font-bold',
  //     })
  //     return
  //   }

  //   if (!currentAppClient?.appId) {
  //     consoleLogger.error('Broke out onOptOutBtnClick: currentAppclient.appiD not found!!')
  //     setUserMsg({
  //       msg: 'Client App ID not found!',
  //       style: 'text-red-700 font-bold',
  //     })
  //     return
  //   }

  //   if (!currentAppClient?.isOptedIn) {
  //     consoleLogger.error('Broke out onOptOutBtnClick: activeAddress not opted in!')
  //     setUserMsg({
  //       msg: `This account is not opted in to client with App ID: ${currentAppClient.appId.toString()}!`,
  //       style: 'text-red-700 font-bold',
  //     })
  //     return
  //   }

  //   if (btnStates.actionLoading) {
  //     return // Exit method if another action is already loading
  //   }

  //   // Update Buton state 'actionLoading' to true
  //   updateBtnStates({
  //     actionLoading: true,
  //   })

  //   try {
  //     // Execute smart contract OptOut method
  //     consoleLogger.info(`Executing Opt Out method on client with App ID: ${currentAppClient.appId.toString()}!`)
  //     // await openBallotMethodManager.optOut(activeAddress, currentAppClient?.appId)
  //     consoleLogger.info(`Opt Out method successfull on client with App ID: ${currentAppClient.appId.toString()}!`)

  //     // Update Buton state 'optedIn' to true
  //     updateBtnStates({
  //       optedIn: false,
  //     })

  //     // Create updatedAppClient variable that takes current App Client and sets its opt in property to true
  //     const updatedAppClient = {
  //       ...currentAppClient,
  //       isOptedIn: false,
  //     }

  //     // Set updatedApp as new currentAppClient
  //     setCurrentAppClient(updatedAppClient) // Schedule state update

  //     // Notify user of success
  //     setUserMsg({
  //       msg: `Your account has successfully opted out of client with App ID: ${currentAppClient.appId.toString()}`,
  //       style: 'text-green-700 font-bold',
  //     })

  //     consoleLogger.info(activeAddress, 'has been successfully opted out of App ID:', currentAppClient?.appId)
  //   } catch (error) {
  //     consoleLogger.error(`Error executing Opt Out method on client with App ID: ${currentAppClient.appId.toString()}!`, error)

  //     // Notify user of error
  //     setUserMsg({
  //       msg: `Error. Failed to opt out of client with App with ID: ${currentAppClient?.appId.toString()}.`,
  //       style: 'text-red-700 font-bold',
  //     })
  //   } finally {
  //     // Finally, update Buton state 'actionLoading' back to false
  //     updateBtnStates({
  //       actionLoading: false,
  //     })
  //   }
  // }

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
      await openBallotMethodManager.submitVote(activeAddress, currentAppClient.appId, choiceDecision)
      consoleLogger.info(`Submit Vote method successful on client with App ID: ${currentAppClient.appId.toString()}!`)
      consoleLogger.info(`Submit Vote method successful for account address: ${activeAddress}`)

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

      // Update currentAppClient with new values
      const updatedAppClient = {
        ...currentAppClient,
        hasVoted: 1,
        votedFor: Number(choiceDecision),
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

  // =====================
  // * POLL INPUTS LOGIC *
  // =====================

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

              <button className={button.setBtnStyle('join')} onClick={() => toggleModal('joinApp')}>
                Join
              </button>
              <JoinAppModal
                algorand={algorand}
                openModal={modals.joinApp}
                closeModal={() => toggleModal('joinApp')}
                onModalExe={handleJoinApp}
              />

              <button className={button.setBtnStyle('delete')} onClick={() => toggleModal('deleteApp')}>
                Delete
              </button>
              {/* <ClearStateModal
                algorand={algorand}
                openModal={openClearStateModal}
                closeModal={toggleClearStateModal}
                onModalExe={onClearState}
              /> */}
              <DeleteAppModal
                algorand={algorand}
                openModal={modals.deleteApp}
                closeModal={() => toggleModal('deleteApp')}
                onModalExe={handleDeleteApp}
              />
              <button className={button.setBtnStyle('wallet')} onClick={() => toggleModal('wallet')}>
                Tekvin
              </button>
              <ConnectWallet openModal={modals.wallet} closeModal={() => toggleModal('wallet')} />
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
                        className={`w-full p-3 border rounded-md focus:outline-none ${date.setTitleInputVisualAid(currentPollInputs.title)}`}
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
                          className={`w-full p-3 border rounded-md focus:outline-none ${date.setChoicesInputVisualAid(currentPollInputs.choices)[index]}`}
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
                      disabled={button.checkBtnState('create', btnStates)}
                      className={`btn w-36 h-14 justify-center rounded-md text-[24px] tracking-wide font-bold m-2 ${
                        btnStates.pollInputsValid
                          ? 'bg-yellow-300 hover:bg-green-500 border-[3px] border-black hover:border-[4px] hover:border-green-700'
                          : 'bg-gray-400 border-[3px] border-gray-600 cursor-not-allowed'
                      }`}
                      onClick={onCreatePollBtnClick}
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
                  {/* Refresh button */}
                  <button onClick={checkVotingStatus}>Refresh Voting Status</button>
                </p>
                {currentAppClient?.hasVoted === 1 && (
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
                  {currentAppClient?.hasVoted === 1 && (
                    <p className="text-[26px] font-bold text-gray-800">
                      You have voted for choice: <span className="font-bold text-green-700">{choiceDisplay.text}</span>
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-6 flex justify-center">
                <button
                  disabled={button.checkBtnState('requestBox', btnStates)}
                  onClick={onRequestBoxBtnClick}
                  className={button.setBtnStyle('requestBox')}
                >
                  Request Box
                </button>

                <button
                  disabled={button.checkBtnState('deleteBox', btnStates)}
                  onClick={onDeleteBoxBtnClick}
                  className={button.setBtnStyle('deleteBox')}
                >
                  Delete Box
                </button>

                <button
                  disabled={button.checkBtnState('submitVote', btnStates)}
                  onClick={onSubmitVoteBtnClick}
                  className={button.setBtnStyle('submitVote')}
                >
                  Submit Vote
                </button>

                <button
                  disabled={button.checkBtnState('purge', btnStates) || !currentAppClient?.creatorAddress || !currentAppClient?.appId}
                  onClick={onPurgeBoxBtnClick}
                  className={button.setBtnStyle('purge')}
                >
                  Purge
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
