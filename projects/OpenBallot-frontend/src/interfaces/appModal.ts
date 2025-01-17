//.src/interfaces/appModal.ts

import { AlgorandClient } from '@algorandfoundation/algokit-utils'

// Interface type for App Modal properties
export interface AppModalInterface {
  algorand: AlgorandClient
  openModal: boolean
  closeModal: () => void
  onModalExe: (appId: bigint) => void
}
