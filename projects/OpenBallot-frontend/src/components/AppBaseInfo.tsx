import { consoleLogger } from '@algorandfoundation/algokit-utils/types/logging'
import { useCallback, useEffect, useState, useRef } from 'react'
import { AppBaseInfoProps } from '../interfaces/appBaseInfo'
import { convertUnixToDate } from '../utils/dates'

export const AppBaseInfo = ({ algorand, appId, setUserMsg }: AppBaseInfoProps) => {
  const [appClientBaseInfo, setAppClientBaseInfo] = useState<{
    appId: string
    appAddress: string
    creatorAddress: string
    pollStartDate: string
    pollEndDate: string
  } | null>(null)

  const hasLoadedApp = useRef<{ [key: string]: boolean }>({})

  // Reset `hasLoadedApp` anytime appId or appClientBaseInfo is different
  useEffect(() => {
    if (!appId) return

    if (!hasLoadedApp.current[appId.toString()] || appClientBaseInfo?.appId !== appId.toString()) {
      hasLoadedApp.current = { ...hasLoadedApp.current, [appId.toString()]: false }
    }
  }, [appId, appClientBaseInfo])

  const loadAppClientBaseInfo = useCallback(async () => {
    // Return and escape method if no appId found or if app with current appId as value has already been loaded
    if (!appId || hasLoadedApp.current[appId.toString()]) return

    // Proceed
    try {
      const appClient = await algorand.app.getById(appId) // Get client by it appId

      // Return and escape if no appClient was found, notify user and raise error
      if (!appClient) {
        consoleLogger.error('Broke out loadAppClientBaseInfo: appClient not found!')
        setUserMsg({
          msg: `App with ID ${appId.toString()} not found.`,
          style: 'text-red-700 font-bold',
        })
        return
      }

      // client with passed appId successfully loaded
      hasLoadedApp.current[appId.toString()] = true

      // If appClient found, use client appId to access its Global State
      const appGlobalState = await algorand.app.getGlobalState(appClient.appId)

      // Extract poll start and end date unix values (default to 0 if none found)
      const pollStartDateUnixRaw = BigInt(appGlobalState['poll_start_date_unix']?.['value'] ?? 0)
      const pollEndDateUnixRaw = BigInt(appGlobalState['poll_end_date_unix']?.['value'] ?? 0)

      // Convert the extracted dates (in unix timestamp format) to human readable date format
      const pollStartDateStr = convertUnixToDate(pollStartDateUnixRaw)
      const pollEndDateStr = convertUnixToDate(pollEndDateUnixRaw)

      // Populate appClientBaseInfo hook with the extracted data
      setAppClientBaseInfo({
        appId: appId.toString(),
        appAddress: appClient.appAddress,
        creatorAddress: appClient.creator,
        pollStartDate: pollStartDateStr,
        pollEndDate: pollEndDateStr,
      })

      // Notify user client with queried appID has been successfully loaded
      setUserMsg({
        msg: `Successfully loaded client with App ID: ${appId.toString()}`,
        style: 'text-green-700 font-bold',
      })
    } catch (error) {
      // Handle error case
      consoleLogger.error(`Error loading client with App ID: ${appId.toString()}!`, error)
      setUserMsg({
        msg: `Failed to fetch app details for ID ${appId.toString()}.`,
        style: 'text-red-700 font-bold',
      })
    }
  }, [algorand, appId, hasLoadedApp, setUserMsg])

  useEffect(() => {
    if (appId) loadAppClientBaseInfo()
  }, [appId, loadAppClientBaseInfo])

  if (!appClientBaseInfo) {
    return null // Return null and avoid rendering if App client base informatin isn't available
  }

  return (
    <div className="mt-4">
      <div className="text-left">
        <div>
          <span className="text-black text-[18px] font-bold italic">App ID: </span>
          <span className="text-green-800 text-[18px] font-bold">{appClientBaseInfo.appId}</span>
        </div>
        <div>
          <span className="text-black text-[18px] font-bold italic">App Address: </span>
          <span className="text-green-800 text-[18px] font-bold">{appClientBaseInfo.appAddress}</span>
        </div>
        <div>
          <span className="text-black text-[18px] font-bold italic">App Creator: </span>
          <span className="text-green-800 text-[18px] font-bold">{appClientBaseInfo.creatorAddress}</span>
        </div>
        <div>
          <span className="text-black text-[18px] font-bold italic">Vote Start Date: </span>
          <span className="text-green-800 text-[18px] font-bold">{appClientBaseInfo.pollStartDate}</span>
        </div>
        <div>
          <span className="text-black text-[18px] font-bold italic">Vote End Date: </span>
          <span className="text-green-800 text-[18px] font-bold">{appClientBaseInfo.pollEndDate}</span>
        </div>
      </div>
    </div>
  )
}
