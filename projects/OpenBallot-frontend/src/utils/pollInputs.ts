//./utils/pollInputs.ts

import { AppPollProps } from '../interfaces/appPoll'
import { UISectionState } from '../types/index'
import { convertDateToUnix, validateDates } from './dates'

// Process user provided poll inputs, check their validity and notify user accordingly
export const processPollInputs = (
  pollInputs: AppPollProps,
  activeSection: UISectionState,
  setUserMsg: (notification: { msg: string; style: string }) => void,
): boolean => {
  // Don't process Poll inputs if UISection is not equal to 'CREATION'
  if (activeSection !== 'CREATION') return false

  // Encapsulated constants
  const MAX_TITLE_BYTES = 118
  const MAX_CHOICE_BYTES = 116

  // Helper function to get a string byte size and return a number
  const getStrByteSize = (str: string): number => new TextEncoder().encode(str).length

  // Extract 'pollInputs' properties
  const { title, choices, startDate, endDate } = pollInputs

  // Validate title
  if (!title) {
    setUserMsg({ msg: 'Attention! Poll title is missing, please provide one.', style: 'text-red-700 font-bold' })
    return false
  }

  if (getStrByteSize(title) > MAX_TITLE_BYTES) {
    setUserMsg({ msg: 'Attention! Poll title too long, please shorten it.', style: 'text-red-700 font-bold' })
    return false
  }

  // Validate choices
  for (let i = 0; i < choices.length; i++) {
    const choice = choices[i]
    if (!choice || choice.trim() === '') {
      setUserMsg({ msg: `Attention! Poll choice #${i + 1} is missing, please provide one.`, style: 'text-red-700 font-bold' })
      return false
    }
    if (getStrByteSize(choice) > MAX_CHOICE_BYTES) {
      setUserMsg({ msg: `Attention! Poll choice #${i + 1} too long, please shorten it.`, style: 'text-red-700 font-bold' })
      return false
    }
  }

  // Validate poll start date
  if (!startDate) {
    setUserMsg({ msg: 'Attention! Poll start date is missing, please provide one.', style: 'text-red-700 font-bold' })
    return false
  }

  // Validate poll end date
  if (!endDate) {
    setUserMsg({ msg: 'Attention! Poll end date is missing, please provide one.', style: 'text-red-700 font-bold' })
    return false
  }

  // Convert poll start and end date provided through inputs into unix timestamps
  const startDateUnix = convertDateToUnix(startDate)
  const endDateUnix = convertDateToUnix(endDate)

  // Validate unix timestamps
  const response = validateDates(startDateUnix, endDateUnix)
  if (response !== 'Valid dates!') {
    setUserMsg({ msg: response, style: 'text-red-700 font-bold' })
    return false
  }

  // All validations passed (Notify user)
  setUserMsg({ msg: "All information valid, click 'Create' to initialize poll.", style: 'text-green-700 font-bold' })
  return true
}
