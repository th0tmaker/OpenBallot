import { consoleLogger } from '@algorandfoundation/algokit-utils/types/logging'
import { useCallback, useEffect, useState } from 'react'
import { AppInfoProps } from '../interfaces/appInfo'
import { convertUnixToVoteDate } from '../utils/dates'

export const AppInfo = ({ algorand, appId, setUserMsg }: AppInfoProps) => {
  const [appDetails, setAppDetails] = useState<{
    appId: string
    appAddress: string
    creatorAddress: string
    pollStartDate: string
    pollEndDate: string
  } | null>(null)

  const fetchAppDetails = useCallback(async () => {
    if (!appId) return

    try {
      const appClient = await algorand.app.getById(appId)
      if (!appClient) {
        setUserMsg({
          msg: `App with ID ${appId.toString()} not found.`,
          style: 'text-red-700 font-bold',
        })
        return
      }

      const appGlobalState = await algorand.app.getGlobalState(appId)

      const pollStartDateUnixRaw = BigInt(appGlobalState['poll_start_date_unix']['value'])
      const pollEndDateUnixRaw = BigInt(appGlobalState['poll_end_date_unix']['value'])

      const pollStartDateStr = convertUnixToVoteDate(pollStartDateUnixRaw)
      const pollEndDateStr = convertUnixToVoteDate(pollEndDateUnixRaw)

      setAppDetails({
        appId: appId.toString(),
        appAddress: appClient.appAddress,
        creatorAddress: appClient.creator,
        pollStartDate: pollStartDateStr,
        pollEndDate: pollEndDateStr,
      })

      setUserMsg({
        msg: `Successfully loaded client with App ID: ${appId.toString()}`,
        style: 'text-green-700 font-bold',
      })
    } catch (error) {
      setUserMsg({
        msg: `Failed to fetch app details for ID ${appId.toString()}.`,
        style: 'text-red-700 font-bold',
      })
      consoleLogger.error('Error fetching app details:', error)
    }
  }, [algorand, appId, setUserMsg])

  useEffect(() => {
    if (appId) fetchAppDetails()
  }, [appId, fetchAppDetails])

  if (!appDetails) {
    return null // Avoid rendering if no app details are available
  }

  return (
    <div className="mt-4">
      <div className="text-left">
        <div>
          <span className="text-black text-[18px] font-bold italic">App ID: </span>
          <span className="text-green-800 text-[18px] font-bold">{appDetails.appId}</span>
        </div>
        <div>
          <span className="text-black text-[18px] font-bold italic">App Address: </span>
          <span className="text-green-800 text-[18px] font-bold">{appDetails.appAddress}</span>
        </div>
        <div>
          <span className="text-black text-[18px] font-bold italic">App Creator: </span>
          <span className="text-green-800 text-[18px] font-bold">{appDetails.creatorAddress}</span>
        </div>
        <div>
          <span className="text-black text-[18px] font-bold italic">Vote Start Date: </span>
          <span className="text-green-800 text-[18px] font-bold">{appDetails.pollStartDate}</span>
        </div>
        <div>
          <span className="text-black text-[18px] font-bold italic">Vote End Date: </span>
          <span className="text-green-800 text-[18px] font-bold">{appDetails.pollEndDate}</span>
        </div>
      </div>
    </div>
  )
}
