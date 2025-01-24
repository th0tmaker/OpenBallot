//src/methods.ts

import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { OpenBallotClient, OpenBallotFactory } from './contracts/OpenBallot'
import approvalTeal from '../../OpenBallot-contracts/smart_contracts/artifacts/open_ballot/OpenBallot.approval.teal?raw'
import clearTeal from '../../OpenBallot-contracts/smart_contracts/artifacts/open_ballot/OpenBallot.clear.teal?raw'

// Description
;`The 'OpenBallotMethodManager' class serves as a wrapper designed to manage the OpenBallot smart contract methods.
It uses the AlgorandClient to access '.getTypedAppFactory' in order to retrieve a factory
object that can generate an instance of the OpenBallot smart contract client. After a client
is created through factory, the smart contract client will have access to is underyling methods.`

// Define and export class that acts as a wrapper for the OpenBallot smart contract methods
export class OpenBallotMethodManager {
  // Declare immutable, private fields for the Algorand client and the OpenBallot factory.
  private readonly algorand: AlgorandClient
  private readonly factory: OpenBallotFactory

  constructor(algorand: AlgorandClient, creator: string) {
    this.algorand = algorand
    this.factory = algorand.client.getTypedAppFactory(OpenBallotFactory, {
      defaultSender: creator,
      defaultSigner: this.getSigner(creator),
    })
  }

  // Get client instance of type `OpenBallotClient` by passing desired app client ID
  private getAppClient(appId: bigint): OpenBallotClient {
    return this.factory.getAppClientById({ appId })
  }

  // Get signer of type `TransactionSigner` by passing desired account address
  private getSigner(account: string) {
    return this.algorand.account.getSigner(account)
  }

  // private getApprovalProgramTeal(): string {
  //   return fs.readFileSync(path.join(BASE_DIR, 'artifacts', 'open_ballot', 'OpenBallot.approval.teal'), 'utf-8')
  // }

  // private getClearProgramTeal(): string {
  //   return fs.readFileSync(path.join(BASE_DIR, 'artifacts', 'open_ballot', 'OpenBallot.clear.teal'), 'utf-8')
  // }

  // Create a new instance of the OpenBallot smart contract by calling generate() ABI method
  async createApp(creator: string) {
    const { appClient } = await this.factory.send.create.generate({
      sender: creator,
      signer: this.getSigner(creator),
      args: [],
    })

    return appClient
  }

  async deployApp(creator: string) {
    // Fetch the AppLookup using the Algorand appDeployer

    //const test2 = await this.algorand.app.compileTeal()
    // const test3 = await this.algorand.app.compileTealTemplate()

    // const templateParams = {
    //   DELETABLE_TEMPLATE_NAME: 1,
    // }

    // const deploymentMetadata = {
    //   deletable: true,
    // }

    // const compiledApprovalProgramTeal = await this.algorand.app.compileTealTemplate(approvalTeal, templateParams, deploymentMetadata)

    // const compiledClearProgramTeal = await this.factory.algorand.app.compileTealTemplate(clearTeal, templateParams, deploymentMetadata)

    // consoleLogger.info(compiledApprovalProgramTeal.teal)

    //AppManager

    // const test = await this.factory.algorand.appDeployer.deploy({
    //   metadata: {
    //     name: 'OpenBallot',
    //     version: '1.0.0',
    //     deletable: true,
    //   },
    //   createParams: {
    //     sender: creator,
    //     signer: this.getSigner(creator),
    //     approvalProgram: compiledApprovalProgramTeal.compiledBase64ToBytes,
    //     clearStateProgram: compiledClearProgramTeal.compiledBase64ToBytes,
    //     args: [],
    //     // onComplete: OnApplicationComplete.NoOpOC,
    //     // method: 'generate',
    //   },
    //   updateParams: {
    //     sender: creator,
    //     signer: this.getSigner(creator),
    //   },
    //   deleteParams: {
    //     sender: creator,
    //     signer: this.getSigner(creator),
    //   },

    //   onUpdate: 'append',
    // })

    // Extract the deployed app ID
    // const appId = test.appId
    // //test.operationPerformed
    // const client = this.getAppClient(appId)
    // consoleLogger.info('Deployed App ID:', test)
    // const lol = client.appSpec.templateVariables

    const { appClient } = await this.factory.deploy({
      createParams: {
        sender: creator,
        signer: this.getSigner(creator),
        args: [],
        method: 'generate',
      },

      deleteParams: {
        sender: creator,
        signer: this.getSigner(creator),
        args: [],
        method: 'terminate',
      },

      onUpdate: 'append',
      onSchemaBreak: 'append',

      updatable: undefined,
      deletable: undefined,
    })

    const tempVars = appClient.appSpec.templateVariables

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
    startDateUnix: bigint,
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
        startDateUnix,
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
