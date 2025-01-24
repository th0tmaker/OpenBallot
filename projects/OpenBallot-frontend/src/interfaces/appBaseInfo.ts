//.src/interfaces/appInfo.ts

import { AlgorandClient } from '@algorandfoundation/algokit-utils'

export interface AppBaseInfoProps {
  algorand: AlgorandClient
  appId?: bigint // Allow appId to be undefined
  setUserMsg: (notification: { msg: string; style: string }) => void
}
