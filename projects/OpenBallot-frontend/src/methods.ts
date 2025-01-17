//src/methods.ts

import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { OpenBallotClient, OpenBallotFactory } from './contracts/OpenBallot'

// Description
;`The 'OpenBallotMethods' class serves as a wrapper designed to manage the OpenBallot smart contract methods.
It uses the AlgorandClient to access '.getTypedAppFactory' in order to retrieve a factory
object that can generate an instance of the OpenBallot smart contract client. After a client
is created through factory, the smart contract client will have access to is underyling methods.`

// Define and export class that acts as a wrapper for the OpenBallot smart contract methods
export class OpenBallotMethods {
  // Declare immutable, private fields for the Algorand client and the OpenBallot factory.
  private readonly algorand: AlgorandClient
  private readonly factory: OpenBallotFactory

  constructor(algorand: AlgorandClient) {
    this.algorand = algorand // `AlgorandClient` provides utility methods to interact with the blockchain
    // `getTypedAppFactory` returns a factory object to manage apps of a specific type (OpenBallot in this case)
    this.factory = algorand.client.getTypedAppFactory(OpenBallotFactory) // Pass the `OpenBallotFactory` as arg
  }

  // Get client instance of type `OpenBallotClient` by passing desired app client ID
  private getAppClient(appId: bigint): OpenBallotClient {
    return this.factory.getAppClientById({ appId })
  }

  // Get signer of type `TransactionSigner` by passing desired account address
  private getSigner(account: string) {
    return this.algorand.account.getSigner(account)
  }

  // Create a new instance of the OpenBallot smart contract by calling generate()void ABI method
  async createApp(creator: string) {
    const { appClient } = await this.factory.send.create.generate({
      sender: creator,
      signer: this.getSigner(creator),
      args: [],
    })
    return appClient
  }

  // Deploy a new instance of the OpenBallot smart contract idempotently
  async deployApp() {
    const { appClient } = await this.factory.deploy()

    return appClient
  }

  // Get app client by ID and opt in to its local storage
  async optIn(sender: string, appId: bigint) {
    const client = this.getAppClient(appId)
    await client.send.optIn.localStorage({
      sender,
      signer: this.getSigner(sender),
      args: { account: sender },
    })
  }

  // Get app client by ID and opt out of its local storage
  async optOut(sender: string, appId: bigint) {
    const client = this.getAppClient(appId)
    await client.send.closeOut.optOut({
      sender,
      signer: this.getSigner(sender),
      args: { account: sender },
    })
  }

  // Get app client by ID and set its poll properites (can only be done by app creator)
  async setPoll(
    creator: string,
    appId: bigint,
    title: string,
    choice1: string,
    choice2: string,
    choice3: string,
    startDateStr: string,
    startDateUnix: bigint,
    endDateStr: string,
    endDateUnix: bigint,
  ) {
    const client = this.getAppClient(appId)
    await client.send.setPoll({
      sender: creator,
      signer: this.getSigner(creator),
      args: {
        title: new TextEncoder().encode(title),
        choice1: new TextEncoder().encode(choice1),
        choice2: new TextEncoder().encode(choice2),
        choice3: new TextEncoder().encode(choice3),
        startDateStr,
        startDateUnix,
        endDateStr,
        endDateUnix,
      },
    })
  }

  // Get app client by ID and submit a vote with desired choice
  async submitVote(sender: string, appId: bigint, choice: bigint) {
    const client = this.getAppClient(appId)
    await client.send.submitVote({
      sender,
      signer: this.getSigner(sender),
      args: {
        account: sender,
        choice,
      },
    })
  }

  // Get app client by ID and delete it (can only be done by app creator)
  async deleteApp(creator: string, appId: bigint) {
    const client = this.getAppClient(appId)
    await client.appClient.send.delete({
      sender: creator,
      signer: this.getSigner(creator),
      method: 'terminate',
    })
  }

  // Get app client by ID and call the clear state method
  async clearState(sender: string, appId: bigint) {
    const client = this.getAppClient(appId)
    await client.send.clearState({
      sender, // sender account clears the local schema mbr from their account min balance without fail
      signer: this.getSigner(sender),
    })
  }
}
