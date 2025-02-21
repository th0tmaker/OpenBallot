import { useCallback, useState } from 'react'
import { UIButton } from '../types'
import { BtnStateFlags } from '../interfaces/btnState'

// Default state
const defaultBtnStates: BtnStateFlags = {
  actionLoading: false,
  isCreator: false,
  hasBoxStorage: false,
  ableToPurgeBoxA_: false,
  voteSubmitted: false,
  pollInputsValid: false,
  pollVotingPeriodOpen: false,
}

// Base button styles
const baseBtnStyle =
  'btn w-36 h-14 justify-center rounded-md text-[24px] tracking-wide font-bold bg-yellow-300 m-2 border-[3px] border-black hover:border-[4px]'

// Button style generator
export const setBtnStyle = (type: UIButton): string => {
  switch (type) {
    case 'cancel':
      return `${baseBtnStyle} hover:bg-red-500 hover:border-red-700`
    default:
      return `${baseBtnStyle} hover:bg-green-500 hover:border-green-700`
  }
}

// Utility function to check disable conditions based on button type
const btnDisableConditions: Record<UIButton, (flag: BtnStateFlags) => boolean> = {
  create: (flag) => flag.actionLoading || !flag.pollInputsValid,
  requestBox: (flag) => flag.actionLoading || flag.isCreator || flag.hasBoxStorage,
  deleteBox: (flag) => flag.actionLoading || flag.isCreator || !flag.hasBoxStorage,
  choices: (flag) => flag.actionLoading || !flag.hasBoxStorage || flag.voteSubmitted || !flag.pollVotingPeriodOpen,
  submitVote: (flag) => flag.actionLoading || !flag.hasBoxStorage || flag.voteSubmitted || !flag.pollVotingPeriodOpen,
  purge: (flag) => flag.actionLoading || !flag.isCreator || !flag.ableToPurgeBoxA_,
  delete: (flag) => flag.actionLoading,
  start: (flag) => flag.actionLoading,
  join: (flag) => flag.actionLoading,
  wallet: (flag) => flag.actionLoading,
  cancel: (flag) => flag.actionLoading,
}

export const checkBtnState = (type: UIButton, flag: BtnStateFlags): boolean => {
  return btnDisableConditions[type]?.(flag) ?? false
}

// Hook for managing button states
export const useBtnState = () => {
  const [btnStates, setBtnState] = useState<BtnStateFlags>(defaultBtnStates)

  const updateBtnStates = useCallback((updates: Partial<BtnStateFlags>) => {
    setBtnState((prev) => ({ ...prev, ...updates }))
  }, [])

  return { btnStates, updateBtnStates }
}
