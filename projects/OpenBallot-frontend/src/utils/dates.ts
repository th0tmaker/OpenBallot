//./utils/dates.ts

import { PollProps } from '../types'

export const convertVoteDateToUnix = (dateStr: string): number => {
  const [year, month, day] = dateStr.split('-')
  const date = new Date(Number(year), Number(month) - 1, Number(day))

  return Math.floor(date.getTime() / 1000)
}

export const convertUnixToVoteDate = (unixTimestamp: bigint): string => {
  // Convert Unix timestamp to milliseconds
  const timestamp = Number(unixTimestamp) * 1000

  // Create a Date object
  const date = new Date(timestamp)

  // Adjust for your timezone (GMT+1 is +60 minutes)
  const offsetInMs = 60 * 60 * 1000 // 1 hour in milliseconds
  const localDate = new Date(date.getTime() + offsetInMs)

  // Format the adjusted date as DD/MM/YYYY
  const day = String(localDate.getUTCDate()).padStart(2, '0')
  const month = String(localDate.getUTCMonth() + 1).padStart(2, '0') // Month is zero-indexed
  const year = localDate.getUTCFullYear()

  return `${day}/${month}/${year}`
}

export const formatVoteDateStrOnChain = (dateStr: string): string => {
  const [year, month, day] = dateStr.split('-') // Expected input: "YYYY-MM-DD"
  return `${day}/${month}/${year}` // Expected output: "DD/MM/YYYY"
}

export const validateVoteDates = (startUnix: number, endUnix: number): string => {
  // const normalizeToStartOfDay = (timestamp: number): number => Math.floor(new Date(timestamp * 1000).setHours(0, 0, 0, 0) / 1000)
  // const currentUnix = Math.floor(Date.now() / 1000) // current unix timestamp
  const minVotePeriod = 3 * 24 * 60 * 60 // 3 days in seconds
  const maxVotePeriod = 14 * 24 * 60 * 60 // 14 days in seconds

  // if (normalizeToStartOfDay(startUnix) < normalizeToStartOfDay(currentUnix)) {
  //   return 'Invalid dates! Start date must not be earlier than current date.'
  // }

  const votePeriod = endUnix - startUnix

  // if (startUnix < currentUnix) return 'Invalid dates! Start date must not be earlier than current date'
  // if (endUnix <= currentUnix) return 'Invalid dates! End date must not be earlier than current date'
  if (startUnix > endUnix) return 'Invalid dates! Start date must be earlier than end date'
  if (votePeriod < minVotePeriod) return 'Invalid dates! End date must be at least 3 days later than start date'
  if (votePeriod > maxVotePeriod) return 'Invalid dates! Voting period must not exceed a maximum of 14 days'

  return 'vote dates valid!'
}

export const processPollInputs = (
  pollParams: PollProps,
  isPollActive: boolean,
  setUserMsg: (notification: { msg: string; style: string }) => void,
): boolean => {
  if (!isPollActive) return false

  const { title, choices, startDate, endDate } = pollParams

  // Validate title
  if (!title) {
    setUserMsg({ msg: 'Poll title required', style: 'text-red-700 font-bold' })
    return false
  }

  // Validate choices
  const missingChoice = choices.findIndex((choice) => !choice || choice.trim() === '') + 1
  if (missingChoice) {
    setUserMsg({ msg: `Choice #${missingChoice} is required`, style: 'text-red-700 font-bold' })
    return false
  }

  // Validate dates
  if (!startDate || !endDate) {
    setUserMsg({ msg: 'Start and end date required', style: 'text-red-700 font-bold' })
    return false
  }

  const startDateUnix = convertVoteDateToUnix(startDate)
  const endDateUnix = convertVoteDateToUnix(endDate)
  const validationError = validateVoteDates(startDateUnix, endDateUnix)
  if (validationError !== 'vote dates valid!') {
    setUserMsg({ msg: validationError, style: 'text-red-700 font-bold' })
    return false
  }

  // All validations passed
  setUserMsg({ msg: "All information valid, click 'Create' to initialize poll", style: 'text-green-700 font-bold' })
  return true
}

export const isVotingOpen = (pollStartDateUnix: bigint, pollEndDateUnix: bigint): { isOpen: boolean; message: string } => {
  // Get the current Unix time
  const currentUnix = Math.floor(Date.now() / 1000)

  // Determine if voting is open
  if (currentUnix >= pollStartDateUnix && currentUnix <= pollEndDateUnix) {
    return { isOpen: true, message: 'Yes' }
  } else {
    return { isOpen: false, message: 'No' }
  }
}

export const setUserVisualAidForDates = (date: string, pollInputs: PollProps) => {
  if (date === pollInputs.startDate || date === pollInputs.endDate) {
    const { startDate, endDate } = pollInputs

    if (!startDate || !endDate) {
      return 'border-2 border-red-500' // Dates are missing
    }

    const startUnix = convertVoteDateToUnix(startDate)
    const endUnix = convertVoteDateToUnix(endDate)

    const validationMessage = validateVoteDates(startUnix, endUnix)
    return validationMessage === 'vote dates valid!' ? 'border-2 border-green-500' : 'border-2 border-red-500' // Valid or invalid dates
  }

  return 'border-2 border-gray-300' // Default for other fields
}

export const confirmPollValidityyy = (pollParams: PollProps, setUserMsg: (notification: { msg: string; style: string }) => void) => {
  const { title, choices, startDate, endDate } = pollParams

  // Ensure all fields are populated
  if (!title || choices.some((choice) => !choice) || !startDate || !endDate) {
    return false // One or more fields are incomplete
  }

  // Ensure start date is before end date and within the valid range
  const startUnix = convertVoteDateToUnix(startDate)
  const endUnix = convertVoteDateToUnix(endDate)

  const validationMessage = validateVoteDates(startUnix, endUnix)
  if (validationMessage !== 'vote dates valid!') {
    setUserMsg({ msg: validationMessage, style: 'text-red-700 font-bold' }) // Log the validation failure message
    return false // Return false if the validation fails
  }

  return true // Return true if the poll is valid
}
