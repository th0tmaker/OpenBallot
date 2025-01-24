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

  // Extract 'pollInputs' properties
  const { title, choices, startDate, endDate } = pollInputs

  // Validate title
  if (!title) {
    setUserMsg({ msg: 'Attention! Poll title is missing, please provide one.', style: 'text-red-700 font-bold' })
    return false
  }

  // Validate choices
  const missingChoice = choices.findIndex((choice) => !choice || choice.trim() === '') + 1
  if (missingChoice) {
    setUserMsg({ msg: `Attention! Poll choice #${missingChoice} is missing, please provide one.`, style: 'text-red-700 font-bold' })
    return false
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
