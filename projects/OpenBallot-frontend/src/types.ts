//src/types.ts

//src/types.ts

import { AlgorandClient } from '@algorandfoundation/algokit-utils'

// Interfaces for types
export interface AppProps {
  appId: bigint
  appAddress: string
  creatorAddress: string
  pollTitle: string
  pollChoice1: string
  pollChoice2: string
  pollChoice3: string
  pollStartDate: string
  pollEndDate: string
} // define interface with the desired App properties

export interface PollProps {
  title: string
  choices: string[]
  startDate: string
  endDate: string
} // define interface with the desired poll properties

export interface JoinAppInterface {
  algorand: AlgorandClient
  openModal: boolean
  closeModal: () => void
  onAppJoin: (appId: bigint) => void
}

export interface AppInfoProps {
  algorand: AlgorandClient
  appId?: bigint // Allow appId to be undefined
  setUserMsg: (notification: { msg: string; style: string }) => void
}
