//./utils/buttons.ts

import { useCallback, useState } from 'react'
import { UIButton } from '../types'

interface BtnStateFlags {
  actionLoading: boolean
  optedIn: boolean
  voteSubmitted: boolean
  pollInputsValid: boolean
  pollOpen: boolean
}

// Default state
const defautlBtnStates: BtnStateFlags = {
  actionLoading: false,
  optedIn: false,
  voteSubmitted: false,
  pollInputsValid: false,
  pollOpen: false,
}

// Base button styles
const baseBtnStyle =
  'btn w-36 h-14 justify-center rounded-md text-[24px] tracking-wide font-bold bg-yellow-300 m-2 border-[3px] border-black hover:border-[4px]'

// Button style generator
export const setBtnStyle = (type: UIButton): string => {
  if (type === 'cancel') {
    return `${baseBtnStyle} hover:bg-red-500 hover:border-red-700`
  }
  return `${baseBtnStyle} hover:bg-green-500 hover:border-green-700`
}

// Utility function to check disable conditions based on button type
export const checkBtnState = (type: UIButton, flag: BtnStateFlags): boolean => {
  switch (type) {
    case 'create':
      return flag.actionLoading || !flag.pollInputsValid
    case 'optIn':
      return flag.actionLoading || flag.optedIn || !flag.pollOpen
    case 'optOut':
      return flag.actionLoading || !flag.optedIn || !flag.pollOpen
    case 'submitVote':
      return flag.actionLoading || !flag.optedIn || flag.voteSubmitted || !flag.pollOpen
    case 'choices':
      return flag.actionLoading || !flag.optedIn || flag.voteSubmitted || !flag.pollOpen
    case 'delete':
      return flag.actionLoading
    default:
      return false
  }
}

// Hook for managing button states
export const setBtnState = () => {
  const [btnStates, setBtnState] = useState<BtnStateFlags>(defautlBtnStates)

  const updateBtnStates = useCallback((updates: Partial<BtnStateFlags>) => {
    setBtnState((prev) => ({ ...prev, ...updates }))
  }, [])

  return { btnStates, updateBtnStates }
}
