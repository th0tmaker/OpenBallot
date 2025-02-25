//src/methods.ts

import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { AtomicTransactionComposer, decodeAddress, encodeAddress, ABIMethod } from 'algosdk'
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
   * Executes a composite atomic transaction that sets up a new poll and funds the application account.
   *
   * This method bundles two separate ABI method calls into a single atomic transaction:
   * 1. `set_poll` - Initializes a new poll by setting its title, choices, and voting period (start and end dates).
   * 2. `fund_app_mbr` - Sends a minimum balance funding payment to the application account, which is used
   *    to ensure sufficient funds to cover Global minimum balance and creator box storage allocation.
   *
   * Important Notes:
   * - Both method calls are executed atomically. This means that either both calls succeed or neither
   *   does, ensuring consistent application state.
   * - The `set_poll` method encodes textual inputs (poll title and choices) using UTF-8 encoding.
   * - The `fund_app_mbr` method wraps a payment transaction (mbrPay) in a TransactionWithSigner format.
   * - The application creator's account is used to sign both transactions.
   * - The method relies on the `AtomicTransactionComposer` to bundle the two ABI calls and execute them
   *   together. Confirmation of the atomic transaction round is required; otherwise, an error is thrown.
   *
   * @param creator - The address of the application creator and sender of the transactions.
   * @param appId - The unique ID of the deployed application.
   * @param title - The title of the poll.
   * @param choice1 - The first poll choice.
   * @param choice2 - The second poll choice.
   * @param choice3 - The third poll choice.
   * @param startDateUnix - The UNIX timestamp for the start of the voting period.
   * @param endDateUnix - The UNIX timestamp for the end of the voting period.
   *
   * @returns Void. Throws an error if the atomic transaction round confirmation fails.
   *
   * Steps:
   * 1. Retrieve the application client for the given appId.
   * 2. Create an AtomicTransactionComposer instance.
   * 3. Construct a payment transaction (`mbrPay`) for funding the application account.
   * 4. Add a method call for `set_poll` with UTF-8 encoded poll title and choices, and the specified voting period.
   * 5. Add a method call for `fund_app_mbr` using the payment transaction wrapped in a TransactionWithSigner object.
   * 6. Execute the atomic transaction.
   * 7. Await transaction confirmation and throw an error if confirmation is not received.
   */
  async setPollFundAppMbrAtxn(
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
    const appID = Number(appId)

    const atxn = new AtomicTransactionComposer()

    // Define the MBR payment transaction
    const mbrPay = await this.algorand.createTransaction.payment({
      sender: creator,
      signer: this.getSigner(creator),
      receiver: client.appAddress,
      amount: (116_900).microAlgos(), // App Global.minBalance + BoxStorageMBR
    })

    atxn.addMethodCall({
      appID: appID,
      method: ABIMethod.fromSignature(client.appClient.getABIMethod('set_poll').getSignature()),
      methodArgs: [
        new TextEncoder().encode(title),
        new TextEncoder().encode(choice1),
        new TextEncoder().encode(choice2),
        new TextEncoder().encode(choice3),
        startDateUnix,
        endDateUnix,
      ],
      sender: creator,
      suggestedParams: await this.algorand.getSuggestedParams(),
      signer: this.getSigner(creator),
    })

    atxn.addMethodCall({
      appID: appID,
      method: ABIMethod.fromSignature(client.appClient.getABIMethod('fund_app_mbr').getSignature()),
      methodArgs: [{ txn: mbrPay, signer: this.getSigner(creator) }],
      sender: creator,
      suggestedParams: await this.algorand.getSuggestedParams(),
      boxes: [{ appIndex: appID, name: this.getBoxName(creator) }],
      signer: this.getSigner(creator),
    })

    const atxnRes = atxn.execute(this.algorand.client.algod, 2)

    if (!(await atxnRes).confirmedRound) {
      throw new Error('atxn_res atomic transaction round needs confirmation.')
    }
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
      boxReferences: [{ appId, name: this.getBoxName(sender) }],
      args: {
        choice, // The sender's selected choice for the vote.
      },
    })
  }

  /**
   * Deletes the box storage for the specified application.
   *
   * This method allows the sender (typically the application creator or an authorized account)
   * to delete the box storage associated with the deployed application. Box storage in this
   * context refers to the off-chain or on-chain data storage that is maintained for the application.
   *
   * Important Notes:
   * - The method sends a delete transaction that targets a specific box, identified by the appId and a box name.
   * - The box name is derived from the sender’s address using the helper function `getBoxName`.
   * - No additional arguments are required for this operation.
   *
   * @param sender - The address of the account executing the deletion of box storage.
   * @param appId - The unique ID of the deployed application whose box storage is to be deleted.
   *
   * @returns Void. This method completes after successfully sending the deleteBoxStorage transaction.
   *
   * Steps:
   * 1. Retrieve the application client using the provided appId.
   * 2. Construct a box reference using the appId and the box name obtained from `getBoxName(sender)`.
   * 3. Call the `deleteBoxStorage` method on the client, providing the sender, signer, box reference, and an empty arguments array.
   * 4. Await the transaction execution to ensure the deletion is processed.
   */
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

  /**
   * Executes an atomic transaction that purges non-creator box storage entries.
   *
   * This method is designed for the application creator to delete box storage entries
   * associated with non-creator accounts. Box storage is stored as keyed data on the
   * application, and this method purges these entries in batches (up to max 8 boxes per batch).
   *
   * Important Notes:
   * - Only non-creator boxes are purged. The method filters out boxes whose keys correspond
   *   to the creator’s address.
   * - The method groups the box keys into batches of 8, and then processes these batches using
   *   multiple AtomicTransactionComposer instances. The composers are used to bundle and execute
   *   the purge calls atomically.
   * - The `purge_box_storage` ABI method is called with a dynamic array of box keys (addresses)
   *   to be purged. Box names are constructed by prefixing the decoded box key with "a_".
   * - The method executes every two batches (or the final batch if there is an odd number) and
   *   confirms the transaction round. An error is thrown if confirmation fails.
   *
   * @param creator - The address of the application creator (only the creator is allowed to purge boxes).
   * @param appId - The unique ID of the deployed application.
   *
   * @returns Void. The method throws an error if the atomic transaction round confirmation fails.
   *
   * Steps:
   * 1. Retrieve the application client and application boxes for the given appId.
   * 2. Iterate over the retrieved boxes to filter out those that belong to the creator and decode
   *    the box keys into addresses.
   * 3. Split the resulting box key addresses into batches of up to 8 keys each.
   * 4. Initialize a set of AtomicTransactionComposer instances, one for every two batches.
   * 5. For each batch:
   *    a. Determine the corresponding composer ID.
   *    b. Construct the box name by concatenating the prefix "a_" with the decoded box key.
   *    c. Add a method call to the composer for the `purge_box_storage` ABI method using the batch.
   *    d. Execute the composer when two batches have been processed (or at the end if there's an odd number).
   *    e. Check for transaction confirmation and throw an error if confirmation is not received.
   */
  async purgeBoxStorageAtxn(creator: string, appId: bigint) {
    const client = this.getAppClient(appId)
    const appID = Number(appId)

    // Fetch application boxes
    const appBoxes = await this.algorand.client.algod.getApplicationBoxes(appID).do()

    // Filter and decode box keys
    const boxKeysAddresses: string[] = []
    for (const box of appBoxes.boxes) {
      if (box.name) {
        const address = encodeAddress(box.name.slice(-32))
        if (address !== creator) {
          boxKeysAddresses.push(address)
        }
      }
    }

    // Create batches of 8 box keys
    const boxKeyBatches: Uint8Array[][] = []
    for (let i = 0; i < boxKeysAddresses.length; i += 8) {
      const batchPromises = boxKeysAddresses.slice(i, i + 8).map(async (key) => decodeAddress(key).publicKey)

      // Wait for all promises in the batch to resolve
      const batch = await Promise.all(batchPromises)
      boxKeyBatches.push(batch)
    }

    // Initialize AtomicTransactionComposer instances
    const atxnFactory: { [key: string]: AtomicTransactionComposer } = {}
    const numComposers = Math.ceil(boxKeyBatches.length / 2)
    for (let i = 0; i < numComposers; i++) {
      atxnFactory[`atxn_${i + 1}`] = new AtomicTransactionComposer()
    }

    // Process batches
    let batchCounter = 0
    for (const batch of boxKeyBatches) {
      const atxnId = Math.floor(batchCounter / 2) + 1
      const boxNames = batch.map((boxKey) => new Uint8Array([...Buffer.from('a_'), ...boxKey]))

      // Add method call to AtomicTransactionComposer
      atxnFactory[`atxn_${atxnId}`].addMethodCall({
        appID,
        method: ABIMethod.fromSignature(client.appClient.getABIMethod('purge_box_storage').getSignature()),
        methodArgs: [batch],
        sender: creator,
        suggestedParams: await this.algorand.getSuggestedParams(),
        boxes: boxNames.map((name) => ({ appIndex: appID, name })),
        signer: this.getSigner(creator),
      })

      // Execute every 2 batches or at the end
      if (batchCounter % 2 === 1 || batchCounter === boxKeyBatches.length - 1) {
        const atxnRes = await atxnFactory[`atxn_${atxnId}`].execute(this.algorand.client.algod, 5)
        if (!atxnRes.confirmedRound) {
          throw new Error('Atomic transaction round confirmation failed.')
        }
      }

      batchCounter++
    }
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
}
