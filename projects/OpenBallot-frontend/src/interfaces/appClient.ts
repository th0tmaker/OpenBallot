//.src/interfaces/appClient.ts

// Interface type for App Client properties
export interface AppClientProps {
  appId: bigint
  appAddress: string
  creatorAddress: string
  pollTitle: string
  pollChoice1: string
  pollChoice2: string
  pollChoice3: string
  pollStartDate: string
  pollEndDate: string
  pollStartDateUnix: bigint
  pollEndDateUnix: bigint
  boxes: string[]
  // hasBoxStorage: boolean
  // pollVoteStatus: number | null
  // pollVoteChoice: number | null
  // isOptedIn: boolean
}
