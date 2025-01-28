//./utils/dates.ts

// Convert date string representation into a unix timestamp representation
export const convertDateToUnix = (date: string): number => {
  // Split the date string into seperate chunks
  const [dateChunk, timeChunk] = date.split('T') // Example input of dateStr: "2025-01-17T 14:30:45"

  // Further split the date and time into components
  const [year, month, day] = dateChunk.split('-').map(Number)
  const [hours, minutes, seconds] = timeChunk ? timeChunk.split(':').map(Number) : [0, 0, 0] // Default to 0 if time is missing
  const newDate = new Date(year, month - 1, day, hours, minutes, seconds) // Create a new Date object

  // Return the Unix timestamp of the date object
  return Math.floor(newDate.getTime() / 1000)
}

// Convert date unix timestamp representation into a string representation
export const convertUnixToDate = (dateUnix: bigint): string => {
  const unixMilis = Number(dateUnix) * 1000 // Convert Unix timestamp to milliseconds
  const localDate = new Date(unixMilis) // Create a new Date object (automatically uses the local timezone)

  // Format the adjusted date as DD/MM/YYYY HH:mm:ss
  const day = String(localDate.getDate()).padStart(2, '0')
  const month = String(localDate.getMonth() + 1).padStart(2, '0') // Month is zero-indexed
  const year = localDate.getFullYear()
  const hours = String(localDate.getHours()).padStart(2, '0')
  const minutes = String(localDate.getMinutes()).padStart(2, '0')
  const seconds = String(localDate.getSeconds()).padStart(2, '0')

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`
}

// Check for validity of poll dates
export const validateDates = (startUnix: number, endUnix: number): string => {
  const currentUnix = Math.floor(Date.now() / 1000) // Get the current unix timestamp in seconds
  const votingPeriod = endUnix - startUnix // Define voting period
  const minVotingInterval = 3 * 24 * 60 * 60 // 3 days in seconds
  const maxVotingInterval = 14 * 24 * 60 * 60 // 14 days in seconds

  // Check validation requirements and return response containing the corresponding validation error
  if (startUnix < currentUnix) return 'Invalid dates! Start date must not be earlier than current date.'
  if (endUnix <= currentUnix) return 'Invalid dates! End date must not be earlier than current date.'
  if (startUnix > endUnix) return 'Invalid dates! Start date must be earlier than end date.'
  if (votingPeriod < minVotingInterval) return 'Invalid dates! End date must be at least 3 days later than start date.'
  if (votingPeriod > maxVotingInterval) return 'Invalid dates! Voting period must not exceed a maximum of 14 days.'

  // If poll dates are valid
  return 'Valid dates!'
}

// Check for validity of poll title
export const validateTitle = (title: string): string => {
  const max_title_bytes = 118
  const getStrByteSize = (str: string): number => new TextEncoder().encode(str).length

  // Validate title length
  if (getStrByteSize(title) > max_title_bytes) return 'Invalid title! Title is too long.'

  return 'Valid title!'
}

// Check for validity of poll choice
export const validateChoice = (choice: string): string => {
  const max_choice_bytes = 116
  const getStrByteSize = (str: string): number => new TextEncoder().encode(str).length

  // Check if the choice exceeds byte limit
  if (getStrByteSize(choice) > max_choice_bytes) return 'Invalid choice! This choice is too long.'

  return 'Valid choice!'
}

// Check if voting period is open or closed
export const checkVotingPeriod = (startUnix: bigint, endUnix: bigint): { open: boolean; msg: string } => {
  const currentUnix = Math.floor(Date.now() / 1000) // Get the current unix timestamp in seconds

  if (currentUnix >= startUnix && currentUnix <= endUnix) {
    return { open: true, msg: 'Yes' }
  } else {
    return { open: false, msg: 'No' }
  }
}

// Set up visual aid to notify user if their inputed date is valid or not
export const setDateInputsVisualAid = (startDate: string, endDate: string): string => {
  // If either startDate or endDate is missing, return red border
  if (!startDate || !endDate) {
    return 'border-2 border-red-500'
  }

  // Convert dates to Unix timestamps
  const startUnix = convertDateToUnix(startDate)
  const endUnix = convertDateToUnix(endDate)

  // Validate the Unix timestamps and return the corresponding border class
  return validateDates(startUnix, endUnix) === 'Valid dates!' ? 'border-2 border-green-500' : 'border-2 border-red-500'
}

export const setTitleInputVisualAid = (title: string): string => {
  if (!title) {
    return 'border-2 border-red-500'
  }

  return validateTitle(title) == 'Valid title!' ? 'border-2 border-green-500' : 'border-2 border-red-500'
}

export const setChoicesInputVisualAid = (choices: string[]): string[] => {
  return choices.map((choice) => {
    // If the choice is empty, return a red border immediately
    if (choice.trim() === '') {
      return 'border-2 border-red-500'
    }
    return validateChoice(choice) === 'Valid choice!' ? 'border-2 border-green-500' : 'border-2 border-red-500'
  })
}
