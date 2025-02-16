//src/methods.ts

import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { decodeAddress, encodeAddress } from 'algosdk'
import { OpenBallotClient, OpenBallotFactory } from './contracts/OpenBallot'

/**
 * Class that acts as a wrapper for the OpenBallot smart contract methods, providing an interface
 * to interact with the contract and manage its functions.
 *
 * This class allows the user to interact with the OpenBallot smart contract deployed on the Algorand
 * blockchain. It wraps various smart contract methods to facilitate easier and more structured calls to
 * the contract, such as setting poll details, submitting votes, and managing app state.
 *
 * Key Responsibilities:
 * - Manages interactions with the OpenBallot contract via a factory and Algorand client.
 * - Provides methods for managing polls, voting, and other contract functions.
 * - Ensures the correct signer and sender are used for transactions.
 *
 * @export
 * @class OpenBallotMethodManager
 */
export class OpenBallotMethodManager {
  private readonly algorand: AlgorandClient
  private readonly factory: OpenBallotFactory

  /**
   * Constructs an instance of `OpenBallotMethodManager` that provides access to methods of the
   * OpenBallot smart contract.
   *
   * The constructor initializes the `OpenBallotMethodManager` by setting up the Algorand client
   * and the OpenBallot factory, which are used to interact with the smart contract. The creator's
   * account is also passed in to ensure that the correct sender and signer are used for contract
   * interactions.
   *
   * @param {AlgorandClient} algorand - The Algorand client used to interact with the blockchain.
   * @param {string} creator - The account address of the creator, which will be used as the default
   *                            sender and signer for contract interactions.
   *
   * Steps:
   * 1. Store the `AlgorandClient` instance for managing blockchain interactions.
   * 2. Initialize the OpenBallot factory using `algorand.client.getTypedAppFactory()`, passing the
   *    creator's account to ensure the correct sender and signer are set.
   * 3. The constructor sets up the manager with the proper context to interact with the OpenBallot
   *    smart contract.
   */
  constructor(algorand: AlgorandClient, creator: string) {
    // Store the Algorand client and initialize the OpenBallot factory with the creator's information.
    this.algorand = algorand
    this.factory = algorand.client.getTypedAppFactory(OpenBallotFactory, {
      defaultSender: creator,
      defaultSigner: this.getSigner(creator),
    })
  }

  /**
   * Retrieves an instance of the `OpenBallotClient` by providing the desired application client ID.
   *
   * This method allows access to a specific app client by passing the `appId`, which identifies the deployed
   * instance of the Open Ballot smart contract. The returned client is of type `OpenBallotClient` and can
   * be used to interact with the app’s methods and state.
   *
   * Important Notes:
   * - The app client returned is used to send transactions, read the app’s local storage, and invoke app methods.
   * - This method ensures that the client is correctly initialized based on the provided `appId`.
   *
   * @param appId - The unique ID of the deployed Open Ballot application.
   *
   * @returns appClient - The `OpenBallotClient` instance corresponding to the provided `appId`.
   *
   * Steps:
   * 1. Accept the `appId` as input, which represents the unique identifier of the deployed application.
   * 2. Call `this.factory.getAppClientById({ appId })` to retrieve the client associated with the given `appId`.
   * 3. Return the `OpenBallotClient` instance for use in interacting with the application.
   */
  private getAppClient(appId: bigint): OpenBallotClient {
    // Retrieve the client for the specified app ID.
    return this.factory.getAppClientById({ appId })
  }

  /**
   * Retrieves a signer of type `TransactionSigner` for a specified account address.
   *
   * This method accepts an Algorand account address as input and returns a signer object that can be
   * used to sign transactions on behalf of that account. The returned signer is of type `TransactionSigner`,
   * which is necessary for signing and sending transactions to the Algorand blockchain.
   *
   * Important Notes:
   * - The `getSigner` method is used when a transaction needs to be signed by the owner of the specified account.
   * - The returned signer can be used with various transaction types to authorize them with the account's private key.
   *
   * @param account - The Algorand account address for which the signer is being retrieved.
   *
   * @returns signer - The signer object that can be used to sign transactions on behalf of the specified account.
   *
   * Steps:
   * 1. Accept the `account` address as input.
   * 2. Call `this.algorand.account.getSigner(account)` to retrieve the signer for the given account.
   * 3. Return the `TransactionSigner` object for use in signing and sending transactions.
   */
  private getSigner(account: string) {
    // Retrieve the signer for the provided account address.
    return this.algorand.account.getSigner(account)
  }

  // private async getSuggestedParams() {
  //   // Retrieve and setup suggested params for a transaction.
  //   const sp = await this.algorand.getSuggestedParams()
  //   const status = await this.algorand.client.algod.status().do()
  //   // sp.firstRound = status['last-round']
  //   // sp.lastRound = sp.firstRound + 1000
  //   return sp
  // }

  /**
   * Generates a box name based on the sender's address.
   *
   * This method accepts an Algorand account address as input and returns a Uint8Array representing
   * the box name. The box name is generated by concatenating a prefix with the decoded public key
   * of the sender's address.
   *
   * @param sender - The Algorand account address for which the box name is being generated.
   *
   * @returns boxName - The generated box name as a Uint8Array.
   *
   * Steps:
   * 1. Decode the sender's address to get the public key.
   * 2. Concatenate the prefix 'a_' with the decoded public key.
   * 3. Return the resulting Uint8Array as the box name.
   */
  private getBoxName(sender: string): Uint8Array {
    return new Uint8Array([...Buffer.from('a_'), ...decodeAddress(sender).publicKey])
  }

  /**
   * Gets the current date and time in UTC, and converts it into a `bigint` type UNIX timestamp.
   *
   * This method retrieves the current time in UTC and returns it as a UNIX timestamp, which represents
   * the number of seconds that have passed since January 1, 1970 (the Unix epoch). The result is returned
   * as a `bigint` to ensure compatibility with Algorand's timestamp requirements.
   *
   * Important Notes:
   * - The UNIX timestamp is returned as a `bigint` type to prevent precision loss with large values.
   * - This method uses `Date.now()` to get the current time in milliseconds, which is then converted to seconds
   *   (by dividing by 1000) before being cast to `bigint`.
   *
   * @returns timestamp - The current UTC time as a `bigint` UNIX timestamp.
   *
   * Steps:
   * 1. Call `Date.now()` to get the current time in milliseconds.
   * 2. Divide the milliseconds by 1000 to convert to seconds (UNIX timestamp format).
   * 3. Convert the result to `bigint` to ensure proper handling of large values.
   */
  private getUTCUnixTimestamp(): bigint {
    // Get the current time in UTC, convert it to seconds, and cast it to `bigint`.
    return BigInt(Math.floor(Date.now() / 1000))
  }

  /**
   * Creates a new instance of the OpenBallot smart contract.
   *
   * This method calls the `generate()` ABI method to initialize a new instance of the OpenBallot
   * smart contract. It uses the factory client to send a transaction that creates the app,
   * assigning the creator account as the application owner. The method returns an `appClient`
   * instance for interacting with the newly created application.
   *
   * Important Notes:
   * - The creator account will be the owner of the new application and must have sufficient funds
   *   to cover the creation fees and the associated Minimum Balance Requirement (MBR).
   * - The application is initialized with no arguments.
   * - The method ensures the transaction is signed by the creator account.
   *
   * @param creator - The address of the account creating the new application.
   *
   * @returns appClient - An application client instance for interacting with the newly created application.
   *
   * Steps:
   * 1. Call the factory client’s `create.generate` method to initialize a new OpenBallot smart contract.
   * 2. Use the creator's account as the sender and signer for the transaction.
   * 3. Return the `appClient` instance for the created application.
   */
  async createApp(creator: string): Promise<OpenBallotClient> {
    // Call the factory client's `create.generate` method to create the app.
    const { appClient } = await this.factory.send.create.generate({
      sender: creator, // The address of the account creating the new application.
      signer: this.getSigner(creator), // The signer for the creator's transactions.
      args: [], // No args required to initialize the application, but empty array needs to be passed.
    })

    // Return the application client for interacting with the created app.
    return appClient
  }

  /**
   * Deploys a new instance of the Open Ballot smart contract idempotently.
   *
   * This method deploys a new instance of the Open Ballot smart contract using the factory client.
   * If an existing application with matching parameters already exists, it ensures no duplicate deployment occurs.
   * The deployment includes the creation parameters, deletion parameters, and template parameters for the app.
   * The method ensures the creator account is used as the sender and signer for all transactions and
   * returns an `appClient` instance for interacting with the deployed application.
   *
   * Important Notes:
   * - Idempotent Deployment: This method avoids creating duplicate applications by checking for an existing deployment
   *   with matching parameters.
   * - Configurable Deployment Behavior:
   *   - `onUpdate`: Determines the behavior when an update is detected (default is `append`).
   *   - `onSchemaBreak`: Determines the behavior when schema changes (default is `fail`).
   * - The application is deletable and initialized with a `TMPL_VERSION_UNIX` parameter representing the current UNIX timestamp.
   *
   * @param creator - The address of the account deploying the application.
   *
   * @returns appClient - An application client instance for interacting with the deployed application.
   *
   * Steps:
   * 1. Prepare `templateParams` with deployment-time parameters, including the current UNIX timestamp.
   * 2. Call the factory client's `deploy` method with the following configurations:
   *    - `appName`: The name of the application (e.g., 'Open Ballot').
   *    - `createParams`: Parameters for the creation transaction, including sender, signer, and `generate` method.
   *    - `deleteParams`: Parameters for the deletion transaction, including sender, signer, and `terminate` method.
   *    - `onUpdate`: Specifies behavior for updates (e.g., `append` new data).
   *    - `onSchemaBreak`: Specifies behavior for schema changes (e.g., `fail` to reject incompatible updates).
   *    - `deployTimeParams`: Dynamic parameters, such as `TMPL_VERSION_UNIX`.
   *    - `updatable`: Undefined, meaning the app is not explicitly set to be updatable or non-updatable.
   *    - `deletable`: True, allowing the app to be deleted if necessary.
   * 3. Return the `appClient` instance for interacting with the deployed application.
   */
  async deployApp(creator: string): Promise<OpenBallotClient> {
    // Define deployment-time parameters, including the current UNIX timestamp.
    const templateParams = {
      TMPL_VERSION_UNIX: this.getUTCUnixTimestamp(),
    } // Ensures a unique approval program, enforcing a fresh app instance on deployment

    // Deploy the application using the factory client with specified parameters.
    const { appClient } = await this.factory.deploy({
      appName: 'Open Ballot', // The name of the application being deployed.
      createParams: {
        sender: creator, // The address of the account deploying the application.
        signer: this.getSigner(creator), // The signer for the creator's transactions.
        args: [], // No args required to initialize the application, but empty array needs to be passed.
        method: 'generate', // The ABI method name for creating the application.
      },
      deleteParams: {
        sender: creator, // The address of the account authorized to delete the application.
        signer: this.getSigner(creator), // The signer for the creator's transactions.
        args: [], // No args required to initialize the application, but empty array needs to be passed.
        method: 'terminate', // The ABI method name for terminating the application.
      },
      onUpdate: 'append', // Behavior for updates (e.g., append new data if updates occur).
      onSchemaBreak: 'fail', // Behavior for schema changes (e.g., fail if incompatible changes occur).
      deployTimeParams: templateParams, // Dynamic parameters for deployment (e.g., `TMPL_VERSION_UNIX`).
      updatable: undefined, // No explicit setting for app updatability.
      deletable: true, // Allows the app to be deleted by the authorized account.
    })

    // Return the application client for interacting with the deployed app.
    return appClient
  }

  /**
   * Retrieves the UNIX timestamp version of the deployed application.
   *
   * This method queries the deployed Open Ballot smart contract to retrieve the `TMPL_VERSION_UNIX`,
   * which represents the deployment time of the application in UNIX timestamp format. The `sender` account
   * initiates the request, and the method returns the timestamp representing the version of the application.
   *
   * Important Notes:
   * - The returned `TMPL_VERSION_UNIX` provides the timestamp of when the application was deployed, which is useful
   *   for tracking deployment history or verifying application versions.
   * - This method does not modify the application state; it only retrieves the version information.
   *
   * @param sender - The address of the account requesting the version information.
   * @param appId - The ID of the deployed application whose version is being queried.
   *
   * @returns versionUnix - The UNIX timestamp representing the deployment version of the application.
   *
   * Steps:
   * 1. Get the app client using the provided `appId`.
   * 2. Call the `getVersionUnix` method on the app client to fetch the version.
   * 3. Return the `TMPL_VERSION_UNIX` value, which is the deployment time of the app.
   */
  async getVersionUnix(sender: string, appId: bigint) {
    // Get the app client by ID to interact with the deployed application.
    const client = this.getAppClient(appId)

    // Retrieve the deployment version timestamp by calling the `getVersionUnix` method.
    const versionUnix = await client.send.getVersionUnix({
      sender: sender, // The account sending the request.
      signer: this.getSigner(sender), // The signer for the sender’s transactions.
      args: [], // No args required to initialize the application, but empty array needs to be passed.
    })

    // Return the UNIX timestamp representing the deployment version.
    return versionUnix.return
  }

  /**
   * Sets poll properties for the application (appId) specified by its unique identifier.
   *
   * This method can only be executed by the application creator. It uses the application client (`getAppClient`)
   * to send a `setPoll` transaction, which updates the poll settings such as title, choices, and poll duration.
   *
   * Important Notes:
   * - Only the app creator has permission to set the poll data.
   * - This method encodes the title and choices as bytes before sending them to the application.
   * - The poll's start and end times are specified in Unix timestamp format (seconds since epoch).
   *
   * @param creator - The address of the account that created the application. This account must set the poll.
   * @param appId - The unique identifier of the application for which the poll settings will be updated.
   * @param title - The title of the poll (e.g., "Favorite Color?").
   * @param choice1 - The first choice in the poll (e.g., "Red").
   * @param choice2 - The second choice in the poll (e.g., "Blue").
   * @param choice3 - The third choice in the poll (e.g., "Green").
   * @param startDateUnix - The poll's start date in Unix timestamp format (seconds since epoch).
   * @param endDateUnix - The poll's end date in Unix timestamp format (seconds since epoch).
   *
   * Steps:
   * 1. Retrieve the application client for the specified appId using `getAppClient`.
   * 2. Send a `setPoll` transaction using the creator's account, which:
   *    - Updates the poll title and choices (encoded as bytes).
   *    - Sets the start and end times for the poll.
   *    - Ensures only the creator has permission to perform this update.
   */
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
    // Retrieve the application client for the specified application ID.
    const client = this.getAppClient(appId)

    // Send the setPoll transaction using the creator's address.
    await client.send.setPoll({
      sender: creator, // Only the app creator can send this transaction.
      signer: this.getSigner(creator), // The signer for the creator's transactions.
      args: {
        title: new TextEncoder().encode(title), // Encode the title as bytes.
        choice1: new TextEncoder().encode(choice1), // Encode the first choice as bytes.
        choice2: new TextEncoder().encode(choice2), // Encode the second choice as bytes.
        choice3: new TextEncoder().encode(choice3), // Encode the third choice as bytes.
        startDateUnix, // Set the poll's start time (Unix timestamp).
        endDateUnix, // Set the poll's end time (Unix timestamp).
      },
    })
  }

  async fundAppMbr(creator: string, appId: bigint) {
    const client = this.getAppClient(appId)

    // Define the MBR payment transaction
    const mbrPay = await this.algorand.createTransaction.payment({
      sender: creator,
      signer: this.getSigner(creator),
      receiver: client.appAddress,
      amount: (116_900).microAlgos(), // App Global.minBalance + BoxStorageMBR
      note: 'Creator funding App account address MBR.',
    })

    // Send the fundAppMbr transaction using the sender's address.
    await client.send.fundAppMbr({
      sender: creator,
      signer: this.getSigner(creator),
      boxReferences: [{ appId, name: this.getBoxName(creator) }],
      args: { mbrPay: mbrPay },
    })
  }

  /**
   * Request box storage for the application (appId) specified by its unique identifier.
   *
   * This method allows a user to request storage for a box associated with their account in the application.
   * It uses the application client (`getAppClient`) to send a `requestBoxStorage` transaction, which:
   * - Creates a payment transaction to cover the Minimum Balance Requirement (MBR) for box storage.
   * - Defines a unique box name based on the sender's address.
   * - Submits the transaction to the Algorand network.
   *
   * Important Notes:
   * - Boxes are used to store application-specific data in a key-value format.
   * - Each box is uniquely identified by its name, which is derived from the sender's address.
   * - The sender must have sufficient funds in their account to cover the MBR payment and transaction fee.
   * - The MBR payment is sent to the application's address to reserve storage for the box.
   *
   * @param sender - The address of the account requesting box storage.
   * @param appId - The unique identifier of the application for which box storage is being requested.
   *
   * Steps:
   * 1. Retrieve the application client for the specified appId using `getAppClient`.
   * 2. Create a payment transaction to cover the MBR for box storage:
   *    - The payment is sent from the sender's account to the application's address.
   *    - The amount is set to 16,900 microAlgos (0.0169 Algos), which is the MBR for box storage.
   * 3. Define the box name:
   *    - The box name is derived from the sender's address by concatenating a prefix (`a_`) with the sender's address.
   *    - This ensures that the box name is unique for each user.
   * 4. Send the `requestBoxStorage` transaction using the sender's account, which:
   *    - Includes the MBR payment transaction.
   *    - References the box using the derived box name.
   *    - Ensures the transaction is signed by the sender.
   *    - Reserves storage for the box in the application's state.
   */
  async requestBoxStorage(sender: string, appId: bigint) {
    const client = this.getAppClient(appId)

    // Define the MBR payment transaction
    const mbrPay = await this.algorand.createTransaction.payment({
      sender,
      signer: this.getSigner(sender),
      receiver: client.appAddress,
      amount: (16_900).microAlgos(),
    })

    // Send the requestBoxStorage transaction using the sender's address.
    await client.send.requestBoxStorage({
      sender,
      signer: this.getSigner(sender),
      args: { mbrPay: mbrPay },
      boxReferences: [{ appId, name: this.getBoxName(sender) }],
    })
  }

  /**
   * Submits a vote for the application (appId) specified by its unique identifier.
   *
   * This method allows a user to vote by submitting their desired choice to the application. It uses the application client (`getAppClient`)
   * to send a `submitVote` transaction with the user's account and choice.
   *
   * Important Notes:
   * - Only accounts that have opted into the application can submit votes.
   * - Each vote corresponds to a specific choice, identified by an integer.
   * - The sender must have sufficient funds in their account to cover the transaction fee.
   *
   * @param sender - The address of the account submitting the vote. This account must be opted into the application.
   * @param appId - The unique identifier of the application to which the vote is being submitted.
   * @param choice - The desired choice for the vote, represented as a bigint (e.g., 1, 2, 3 for specific options).
   *
   * Steps:
   * 1. Retrieve the application client for the specified appId using `getAppClient`.
   * 2. Send a `submitVote` transaction using the sender's account, which:
   *    - Includes the sender's account address and their selected choice.
   *    - Ensures the transaction is signed by the sender.
   *    - Records the vote in the application's state.
   */
  async submitVote(sender: string, appId: bigint, choice: bigint) {
    // Retrieve the application client for the specified application ID.
    const client = this.getAppClient(appId)

    // Send the submitVote transaction using the sender's account.
    await client.send.submitVote({
      sender, // The address of the account submitting the vote.
      signer: this.getSigner(sender), // The signer for the sender's transactions.
      args: {
        choice, // The sender's selected choice for the vote.
      },
    })
  }

  async deleteBoxStorage(sender: string, appId: bigint) {
    const client = this.getAppClient(appId)

    // Send the deleteBoxStorage transaction using the sender's address.
    await client.send.deleteBoxStorage({
      sender,
      signer: this.getSigner(sender),
      boxReferences: [{ appId, name: this.getBoxName(sender) }],
      args: [], // No args required to delete box storage, but empty array needs to be passed.
    })
  }

  async purgeBoxStorage(creator: string, appId: bigint) {
    const client = this.getAppClient(appId)
    const appBoxes = await this.algorand.client.algod.getApplicationBoxes(Number(appId)).do()

    // Declare array to hold string box keys associated with non-creator addresses
    const boxKeysAddresses: string[] = []
    // Iterate over all the boxes retrieved from the algosdk Algod API
    for (const box of appBoxes.boxes) {
      // Ensure the box has a name property
      if (box.name) {
        // Extract last 32 bytes and encode them to get valid Algorand account address in Base32 format
        const addr = encodeAddress(box.name.slice(-32))
        console.log(addr)
        // If address does not match the creator's address, put it in `boxKeysAddresses` array
        if (addr !== creator) {
          boxKeysAddresses.push(addr)
        }
      }
    }

    // Declare array to store batches of up to 8 Uint8Array box keys each
    const boxKeyBatches: Uint8Array[][] = []
    // Iterate over `boxKeysAddresses` in steps of 8 (i = start index for each batch of 8 box keys)
    for (let i = 0; i < boxKeysAddresses.length; i += 8) {
      // Decode addresses and convert them to Uint8Array
      const batchPromises = boxKeysAddresses.slice(i, i + 8).map(async (key) => {
        return decodeAddress(key).publicKey
      })

      // Wait for all promises in the batch to resolve
      const batch = await Promise.all(batchPromises)
      console.log(batch)
      boxKeyBatches.push(batch)
    }

    console.log('box keys batches:', JSON.parse(JSON.stringify(boxKeyBatches)))

    // Process batches in parallel
    await Promise.all(
      boxKeyBatches.map(async (batch) => {
        console.log('Processing batch:', batch)
        // Proceed only if the batch is not empty
        if (batch) {
          const boxNames = batch.map((boxKey) => new Uint8Array([...Buffer.from('a_'), ...boxKey]))

          // Send transaction that calls the purgeBoxStorage method and purge current batch of box keys
          await client.send.purgeBoxStorage({
            sender: creator,
            signer: this.getSigner(creator),
            boxReferences: boxNames.map((name) => ({ appId, name })),
            args: { boxKeys: batch.map((key) => encodeAddress(key)) }, // Pass the batch of box keys as an array of strings
          })
        }
      }),
    )
  }

  /**
   * Deletes the application (appId) specified by its unique identifier.
   *
   * This method can only be executed by the application creator. It uses the application client (`getAppClient`)
   * to send a `delete` transaction, which deactivates the application and removes its global state.
   *
   * Important Notes:
   * - Deleting an application reclaims the Minimum Balance Requirement (MBR) for the application's global state schema.
   * - The application is removed from the blockchain's **current state** and becomes non-functional.
   * - Historical records of the application (e.g., creation and interaction transactions) are pruned after a certain number
   *   of rounds unless retained by archival nodes.
   *
   * @param creator - The address of the account that created the application. This account must delete the app.
   * @param appId - The unique identifier of the application to be deleted.
   *
   * Steps:
   * 1. Retrieve the application client for the specified appId using `getAppClient`.
   * 2. Send a `delete` transaction using the creator's account, which:
   *    - Deactivates the application.
   *    - Deletes its global state and reclaims the associated MBR.
   *    - Removes the application from the blockchain's current state.
   *    - Does not retain the app data permanently in most nodes (pruned after a certain amount of rounds passed).
   */
  async deleteApp(creator: string, appId: bigint) {
    // Retrieve the application client for the specified application ID.
    const client = this.getAppClient(appId)

    // Send the delete transaction using the creator's address.
    await client.appClient.send.delete({
      sender: creator, // Only the app creator can send this delete transaction.
      signer: this.getSigner(creator), // The signer for the creator's transactions.
      boxReferences: [{ appId, name: this.getBoxName(creator) }],
      method: 'terminate', // The ABI method name for creating the application.
    })
  }

  /**
   * Clears the local state associated with the given application (appId) for the specified sender account.
   *
   * This method uses the application client (`getAppClient`) to send a `clearState` transaction.
   * Clearing the local state allows the sender to reclaim the Minimum Balance Requirement (MBR) associated with
   * the application's local state from their account, effectively removing any application-specific data stored for them.
   *
   * @param sender - The address of the account that is clearing the local state for the specified application.
   * @param appId - The unique identifier of the application whose local state is being cleared for the sender.
   *
   * Steps:
   * 1. Retrieve the application client for the specified appId using `getAppClient`.
   * 2. Send a `clearState` transaction using the sender's account, which:
   *    - Removes the application's local state data from the sender's account.
   *    - Frees up the associated MBR, reducing the sender's minimum balance requirement.
   */
  async clearState(sender: string, appId: bigint) {
    // Retrieve the application client for the specified application ID.
    const client = this.getAppClient(appId)

    // Send the clearState transaction using the specified sender's address.
    await client.send.clearState({
      sender, // Sender account clears the local state for the application.
      signer: this.getSigner(sender), // The signer for the sender's transactions.
    })
  }
}

// /**
//  * Opts the sender account into the application's local storage (appId).
//  *
//  * This method allows an account to opt into the application's local state, enabling the account
//  * to participate in the application's operations, such as voting or accessing other app features.
//  * It uses the application client (`getAppClient`) to send an `optIn.localStorage` transaction.
//  *
//  * Important Notes:
//  * - Opting in increases the sender's Minimum Balance Requirement (MBR) due to the allocation of local storage.
//  * - The sender must have sufficient funds to meet the MBR increase after opting in.
//  * - The app creator does not need to opt in to their own application.
//  *
//  * @param sender - The address of the account opting into the application.
//  * @param appId - The unique identifier of the application to which the sender is opting in.
//  *
//  * Steps:
//  * 1. Retrieve the application client for the specified appId using `getAppClient`.
//  * 2. Send an `optIn.localStorage` transaction using the sender's account, which:
//  *    - Allocates local storage for the application in the sender's account.
//  *    - Ensures the transaction is signed by the sender.
//  */
// async optIn(sender: string, appId: bigint) {
//   // Retrieve the application client for the specified application ID.
//   const client = this.getAppClient(appId)

//   // Send the opt-in transaction using the sender's account.
//   await client.send.optIn.localStorage({
//     sender, // The address of the account opting into the application's local state.
//     signer: this.getSigner(sender), // The signer for the sender's transactions.
//     args: { account: sender }, // Includes the sender's account address.
//   })
// }

// /**
//  * Opts the sender account out of the application's local storage (appId).
//  *
//  * This method allows an account to opt out of the application's local state, releasing the allocated
//  * local storage and reducing the sender's Minimum Balance Requirement (MBR). It uses the application client
//  * (`getAppClient`) to send a `closeOut.optOut` transaction.
//  *
//  * Important Notes:
//  * - Opting out will remove any local state data associated with the sender's account for the application.
//  * - The sender must not have any pending interactions with the app (e.g., locked funds or active operations).
//  * - Opting out reduces the sender's MBR, effectively freeing up the associated balance.
//  *
//  * @param sender - The address of the account opting out of the application.
//  * @param appId - The unique identifier of the application from which the sender is opting out.
//  *
//  * Steps:
//  * 1. Retrieve the application client for the specified appId using `getAppClient`.
//  * 2. Send a `closeOut.optOut` transaction using the sender's account, which:
//  *    - Removes the application's local state from the sender's account.
//  *    - Reduces the sender's MBR, freeing up the previously allocated balance.
//  *    - Ensures the transaction is signed by the sender.
//  */
// async optOut(sender: string, appId: bigint) {
//   // Retrieve the application client for the specified application ID.
//   const client = this.getAppClient(appId)

//   // Send the opt-out transaction using the sender's account.
//   await client.send.closeOut.optOut({
//     sender, // The address of the account opting out of the application's local state.
//     signer: this.getSigner(sender), // The signer for the sender's transactions.
//     args: { account: sender }, // Includes the sender's account address.
//   })
// }
