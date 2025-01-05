import * as algokit from '@algorandfoundation/algokit-utils'
import { consoleLogger } from '@algorandfoundation/algokit-utils/types/logging'
import { useWallet } from '@txnlab/use-wallet'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as method from './methods'
import { AppProps, PollProps, UIState, UserMessage } from './types'
import * as date from './utils/dates'
import { getAlgodConfigFromViteEnvironment } from './utils/network/getAlgoClientConfigs'

// Algorand client setup
const algodConfig = getAlgodConfigFromViteEnvironment()
const algorand = algokit.AlgorandClient.fromConfig({ algodConfig })

// Initialize logger
algokit.Config.configure({ debug: true, logger: consoleLogger })

// Initial states
const INITIAL_POLL_STATE: PollProps = {
  title: '',
  choices: ['', '', ''],
  startDate: '',
  endDate: '',
}

const INITIAL_UI_STATE: UIState = {
  openWalletModal: false,
  openJoinModal: false,
  isHomeActive: true,
  isPollActive: false,
  isVotingActive: false,
  isPollValid: false,
  userOptedIn: false,
}

const INITIAL_VOTING_STATUS = { isOpen: false, message: 'No' }

const Home: React.FC = () => {
  // Core state
  const [uiState, setUiState] = useState<UIState>(INITIAL_UI_STATE)
  const [userMsg, setUserMsg] = useState<UserMessage>({ msg: '', style: '' })
  const [pollParams, setPollParams] = useState<PollProps>(INITIAL_POLL_STATE)
  const [voteChoice, setVoteChoice] = useState<bigint | null>(null)
  const [currentAppId, setCurrentAppId] = useState<bigint | null>(null)
  const [currentApp, setCurrentApp] = useState<AppProps | null>(null)
  const [votingStatus, setVotingStatus] = useState(INITIAL_VOTING_STATUS)
  const hasLoadedApp = useRef<{ [key: string]: boolean }>({})

  // Wallet connection
  const { activeAddress, signer } = useWallet()

  // Set default signer
  useEffect(() => {
    if (signer) algorand.setDefaultSigner(signer)
  }, [signer])

  // UI state management
  const updateUiState = useCallback((updates: Partial<UIState>) => {
    setUiState((prev) => ({ ...prev, ...updates }))
  }, [])

  // Poll validation
  useEffect(() => {
    if (pollParams) {
      const isPollValid = date.processPollInputs(pollParams, uiState.isPollActive, setUserMsg)
      updateUiState({ isPollValid })
    }
  }, [pollParams, uiState.isPollActive, updateUiState])

  // App state management
  useEffect(() => {
    if (currentAppId && !hasLoadedApp.current[currentAppId.toString()]) {
      fetchAppGlobalState()
    }
  }, [currentAppId])

  useEffect(() => {
    if (currentApp) {
      const status = date.isVotingOpen(currentApp)
      setVotingStatus(status)
      logAppState()
    }
  }, [currentApp])

  // App state fetching
  const fetchAppGlobalState = useCallback(async () => {
    if (!currentAppId || hasLoadedApp.current[currentAppId.toString()]) return

    try {
      const app = await algorand.app.getById(currentAppId)
      const appGlobalState = app.globalState

      const newAppState: AppProps = {
        appId: app.appId,
        appAddress: app.appAddress,
        creatorAddress: app.creator,
        pollTitle: String(appGlobalState['poll_title']?.value ?? ''),
        pollChoice1: String(appGlobalState['poll_choice1']?.value ?? ''),
        pollChoice2: String(appGlobalState['poll_choice2']?.value ?? ''),
        pollChoice3: String(appGlobalState['poll_choice3']?.value ?? ''),
        pollStartDate: date.convertUnixToVoteDate(BigInt(appGlobalState['poll_start_date_unix']?.value ?? 0)),
        pollEndDate: date.convertUnixToVoteDate(BigInt(appGlobalState['poll_end_date_unix']?.value ?? 0)),
      }

      setCurrentApp(newAppState)
      hasLoadedApp.current[currentAppId.toString()] = true
    } catch (error) {
      consoleLogger.error('Failed to fetch app global state:', error)
    }
  }, [currentAppId])

  // Logging utility
  const logAppState = useCallback(() => {
    if (!currentApp) return
    consoleLogger.info('Current app state updated:', {
      pollTitle: currentApp.pollTitle,
      pollChoice1: currentApp.pollChoice1,
      startDate: currentApp.pollStartDate,
      endDate: currentApp.pollEndDate,
    })
  }, [currentApp])

  // Modal handlers
  const toggleWalletModal = useCallback(() => {
    updateUiState({ openWalletModal: !uiState.openWalletModal })
    setUserMsg(activeAddress ? { msg: 'Wallet connected successfully', style: 'text-green-700 font-bold' } : { msg: '', style: '' })
  }, [activeAddress, uiState.openWalletModal, updateUiState])

  const toggleJoinModal = useCallback(() => {
    updateUiState({ openJoinModal: !uiState.openJoinModal })
  }, [uiState.openJoinModal, updateUiState])

  // App interaction handlers
  const handleAppJoin = useCallback(
    async (appId: bigint) => {
      try {
        hasLoadedApp.current[appId.toString()] = false
        setCurrentAppId(appId)
        updateUiState({ isVotingActive: true })
        return true
      } catch (error) {
        consoleLogger.error('Error joining app:', error)
        return null
      }
    },
    [updateUiState],
  )

  const handleStartClick = useCallback(() => {
    if (!activeAddress) {
      setUserMsg({ msg: 'Please connect a wallet before starting', style: 'text-red-700 font-bold' })
      return
    }

    setUserMsg({ msg: '', style: '' })
    updateUiState({
      isHomeActive: false,
      isPollActive: true,
    })
  }, [activeAddress, updateUiState])

  const resetState = useCallback(() => {
    setPollParams(INITIAL_POLL_STATE)
    setVoteChoice(null)
    updateUiState({
      ...INITIAL_UI_STATE,
      openWalletModal: uiState.openWalletModal,
    })

    if (activeAddress) {
      setUserMsg({ msg: 'Wallet connected successfully', style: 'text-green-700 font-bold' })
    }
  }, [activeAddress, uiState.openWalletModal, updateUiState])

  // Vote submission
  const submitVote = useCallback(async () => {
    if (!activeAddress || !currentApp?.appId || voteChoice === null) {
      consoleLogger.error('Missing required data for vote submission')
      return
    }

    try {
      await method.submitVote(algorand, activeAddress, currentApp.appId, voteChoice)
      setUserMsg({
        msg: 'Your vote has been successfully submitted! Thank you for participating!',
        style: 'text-green-700 font-bold',
      })
      consoleLogger.info(`Vote successfully submitted for app ID: ${currentApp.appId.toString()}`)
      consoleLogger.info(`Vote successfully submitted for user address: ${activeAddress}`)
    } catch (error) {
      consoleLogger.error('Error submitting vote:', error)
    }
  }, [activeAddress, currentApp?.appId, voteChoice])

  // App initialization
  const initApp = useCallback(async () => {
    if (!activeAddress) {
      consoleLogger.info('Please connect a wallet!')
      return
    }

    try {
      const appClient = await method.createApp(algorand, activeAddress)
      await method.payGlobalMbrCost(algorand, activeAddress, appClient.appId)

      await method.setupPoll(
        algorand,
        activeAddress,
        appClient.appId,
        pollParams.title,
        pollParams.choices,
        date.formatVoteDateStrOnChain(pollParams.startDate),
        BigInt(date.convertVoteDateToUnix(pollParams.startDate)),
        date.formatVoteDateStrOnChain(pollParams.endDate),
        BigInt(date.convertVoteDateToUnix(pollParams.endDate)),
      )

      setCurrentAppId(appClient.appId)
    } catch (error) {
      consoleLogger.error('Error creating app:', error)
    }
  }, [activeAddress, pollParams])

  // Form handlers
  const handlePollSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      try {
        await initApp()
        updateUiState({
          isPollActive: false,
          isVotingActive: true,
        })
      } catch (error) {
        consoleLogger.error('Error submitting poll:', error)
      }
    },
    [initApp, updateUiState],
  )

  const handlePollParamChange = useCallback((field: keyof PollProps, value: string, index?: number) => {
    setPollParams((prev) => {
      if (field === 'choices' && typeof index === 'number') {
        const newChoices = [...prev.choices]
        newChoices[index] = value
        return { ...prev, choices: newChoices }
      }
      return { ...prev, [field]: value }
    })
  }, [])

  return {
    // State
    uiState,
    userMsg,
    pollParams,
    voteChoice,
    currentApp,
    votingStatus,
    activeAddress,

    // Handlers
    handleAppJoin,
    handleStartClick,
    resetState,
    submitVote,
    handlePollSubmit,
    handlePollParamChange,
    toggleWalletModal,
    toggleJoinModal,
    setVoteChoice,
    updateUiState,
  }
}

export default Home
