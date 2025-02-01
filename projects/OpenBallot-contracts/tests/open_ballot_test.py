# tests/open_ballot_test.py
import time
import base64
import pytest
from algokit_utils import TransactionParameters
from algokit_utils.beta.account_manager import AddressAndSigner
from algokit_utils.beta.algorand_client import AlgorandClient
from algosdk.encoding import decode_address, encode_address
from smart_contracts.artifacts.open_ballot.open_ballot_client import OpenBallotClient

from .test_utils import setup_logger, setup_stxn, read_box_key

# Setup the logging.Logger
logger = setup_logger()


# Generate Algorand client that points to the default local net port and token
@pytest.fixture(scope="session")
def algorand() -> AlgorandClient:
    return AlgorandClient.default_local_net()


# Generate a dispenser account as AddreessAndSigner object that will fund other accounts
@pytest.fixture(scope="session")
def dispenser(algorand: AlgorandClient) -> AddressAndSigner:
    return algorand.account.dispenser()


# Generate a creator account for testing and fund it with some ALGO via the dispenser account
@pytest.fixture(scope="session")
def creator(algorand: AlgorandClient, dispenser: AddressAndSigner) -> AddressAndSigner:
    # Create a random Algorand account for the creator
    creator = algorand.account.random()
    # Setup signed transaction that funds the creator account (Dispenser is funding 1.4 ALGO to creator account address)
    fund_creator_acc = setup_stxn(algorand, dispenser, creator.address, 1_400_000)  # 100_000 = 0.1 ALGO
    # Send the signed transaction using the Algorand client
    algorand.send.payment(fund_creator_acc)

    return creator


# Generate a random dummy account for testing and fund it with some ALGO via the dispenser account
@pytest.fixture(scope="session")
def dummy(algorand: AlgorandClient, dispenser: AddressAndSigner) -> AddressAndSigner:
    # Create a random Algorand account for the dummy
    dummy = algorand.account.random()
    # Setup signed transaction that funds the dummy account (Dispenser is funding 15 ALGO to dummy account address)
    fund_dummy_acc = setup_stxn(algorand, dispenser, dummy.address, 15_000_000)
    # Send the signed transaction using the Algorand client
    algorand.send.payment(fund_dummy_acc)

    return dummy


# Define a fixture that creates and returns several instances of the smart contract app client for testing
@pytest.fixture(scope="session")
def app_factory(
    algorand: AlgorandClient, creator: AddressAndSigner,  dummy: AddressAndSigner) -> dict:

    # Define template variables
    template_values = {
        "VERSION_UNIX": int(time.time()),  # Current UNIX timestamp
        "DELETABLE": 1
    }

    # Create first instance of the smart contract client via OpenBallotClient (creator is sender and signer)
    app_client1 = OpenBallotClient(
        algod_client=algorand.client.algod,
        sender=creator.address,
        signer=creator.signer,
        template_values=template_values
    )

    # Use app_client1 to send a transaction generating the contract by executing the 'create' on-completion abimethod
    creator_gen_client1_txn = app_client1.create_generate() #  app_client1.deploy()

    # Verify transaction was confirmed by the network
    assert creator_gen_client1_txn.confirmed_round, "creator_gen_client1_txn round successfully confirmed."

    # Log
    logger.info(f"APP CLIENT 1 ID: {app_client1.app_id}")  #  Check client 1 app ID
    logger.info(f"App Client 1 Global State: {vars(app_client1.get_global_state())}")  # Check client 1 Global State

    # # Create second instance of the smart contract client via OpenBallotClient (creator is sender and signer)
    app_client2 = OpenBallotClient(
        algod_client=algorand.client.algod,
        sender=creator.address,
        signer=creator.signer,
        template_values=template_values
    )

    creator_gen_client2_txn = app_client2.create_generate()

    # Verify transaction was confirmed by the network
    assert creator_gen_client2_txn.confirmed_round, "creator_gen_client2_txn round successfully confirmed."

    # Log
    logger.info(f"APP CLIENT 2 ID: {app_client2.app_id}")  #  Check client 2 app ID
    logger.info(f"App Client 2 Global State: {vars(app_client2.get_global_state())}")  # Check client 2 Global State

    # Create third instance of the smart contract client via OpenBallotClient (dummy is sender and signer)
    """OpenBallotClient can be created with an app_id to interact with an already existing application.
    Below, the 'Dummy' account is creating their own instance of the smart contract client where they are the sender
    and signer, while passing 'Creator' account app_client1 by its ID in order to interact with it."""
    app_client3 = OpenBallotClient(
        algod_client=algorand.client.algod,
        sender=dummy.address,  # Dummy is sender
        signer=dummy.signer,  # Dummy is signer
        app_id=app_client1.app_id,  # Dummy references app_client1 by its ID in order to interact with it
        template_values=template_values
    )

    # Return the instances of our app client in 'dict' type
    return {"app_client1": app_client1, "app_client2": app_client2, "app_client3": app_client3}


# Test case: Creator pays box storage mbr
def test_pay_box_storage_mbr(
    algorand: AlgorandClient,
    app_factory: dict[str, OpenBallotClient],
    creator: AddressAndSigner,
    dummy: AddressAndSigner,
    ) -> None:

    # Get desired App client from 'app_factory'
    app_client1 = app_factory["app_client1"]
    app_client3 = app_factory["app_client3"]

    # Prepare transaction with signer for creator global schema MBR payment
    creator_box_mbr_pay_stxn = setup_stxn(
        algorand,
        creator,
        app_client1.app_address,
        123_300,  # 100_000 (Global.min_balance) + 23_300 (Box fee)
    )

    creator_box1_name = b"vote_status_" + decode_address(creator.address)

    creator_box_mbr_pay_txn = app_client1.pay_box_storage_mbr(
        mbr_pay=creator_box_mbr_pay_stxn, transaction_parameters=TransactionParameters(boxes=[(0, creator_box1_name)]),
    )

    # Verify transaction was confirmed by the network
    assert creator_box_mbr_pay_txn.confirmed_round, "creator_box_mbr_pay_txn round successfully confirmed."

    # Read box key
    read_box_key(algorand, app_client1.app_id, creator_box1_name, logger)

    dummy_box_mbr_pay_stxn = setup_stxn(
        algorand,
        dummy,
        app_client3.app_address,
        123_300
    )

    dummy_box1_name = b"vote_status_" + decode_address(dummy.address)

    dummy_box_mbr_pay_txn = app_client3.pay_box_storage_mbr(
        mbr_pay=dummy_box_mbr_pay_stxn, transaction_parameters=TransactionParameters(boxes=[(0, dummy_box1_name)])
    )

    # Verify transaction was confirmed by the network
    assert dummy_box_mbr_pay_txn.confirmed_round, "dummy_box_mbr_pay_txn round successfully confirmed."

    # Read box key
    read_box_key(algorand, app_client3.app_id, dummy_box1_name, logger)


# Test case: Creator sets poll data (via default ["NoOp"] using the 'set_poll()' abimethod)
# def test_set_poll(
#     app_factory: dict[str, OpenBallotClient],
#     ) -> None:

#     # Get desired App client from 'app_factory'
#     app_client1 = app_factory["app_client1"]

#     # Poll data (title, choice1, choice2, choice3) is algopy.Bytes type and can be passed as byte literals
#     title = (
#         b"01234567890123456789012345678901234567890123456789012345678"
#         b"90123456789012345678901234567890123456789012345678901234567"
#     )  # 118 bytes in size

#     choice1 = (
#         b"0123456789012345678901234567890123456789012345678901234567"
#         b"8901234567890123456789012345678901234567890123456789012345"
#     )  # 116 bytes in size

#     choice2 = b"Twice"
#     choice3 = b""

#     # Define date format (second/minute/hour/day/month/year)
#     date_format = "%S/%M/%H/%d/%m/%Y"

#     # Set start date as str within acceptable params of the smart contract 'set_poll()' abimethod
#     start_date_str = "00/00/00/10/01/2025"  # 00:00:00 on January 10, 2025
#     start_date_unix = int(
#         time.mktime(time.strptime(start_date_str, date_format))
#     )  # Obtain start date unix via time module by passing the start date string and the date format

#     # Set enddate as str within acceptable params
#     end_date_str =  "00/00/00/22/01/2025"  # 00:00:00 on January 22, 2025
#     end_date_unix = int(
#         time.mktime(time.strptime(end_date_str, date_format))
#     )  # Obtain end date unix via time module by passing the start date string and the date format

#     # Use App client to send a transaction that executes the 'set_poll()' abimethod
#     creator_set_poll_txn = app_client1.set_poll(
#         title=title,
#         choice1=choice1,
#         choice2=choice2,
#         choice3=choice3,
#         start_date_unix=1737451350,
#         end_date_unix=1738228590,
#     )

#     # Verify transaction was confirmed by the network
#     assert (
#         creator_set_poll_txn.confirmed_round
#     ), "creator_set_poll_txn round successfully confirmed."

#     # Log
#     logger.info("TEST SET POLL BELOW:")
#     # get_txn_logs(algorand, creator_set_poll_txn.tx_id, logger) <- uncomment to check log() if one available


# Test case: Account opts in to local storage (via ["OptIn"] using the 'opt_in_local_storage()' abimethod)
# def test_account_opt_in(
#     app_factory: dict[str, OpenBallotClient],
#     creator: AddressAndSigner,
#     dummy: AddressAndSigner,
#     ) -> None:

#     # Get desired App client from 'app_factory'
#     app_client1 = app_factory["app_client1"]
#     # app_client2 = app_clients["app_client2"]
#     app_client3 = app_factory["app_client3"]

#     # Send transaction
#     creator_opt_in_appclient1_txn = app_client1.opt_in_local_storage(
#         account=creator.address,
#         transaction_parameters=TransactionParameters(foreign_apps=[app_client1.app_id]),
#     )

#     # Verify transaction was confirmed by the network
#     assert (
#         creator_opt_in_appclient1_txn.confirmed_round
#     ), "creator_opt_in_appclient1_txn round successfully confirmed."

#     # Do the same for the dummy account by using app_client3 (which references app_client by ID)
#     dummy_opt_in_appclient3_txn = app_client3.opt_in_local_storage(
#         account=dummy.address,
#         transaction_parameters=TransactionParameters(foreign_apps=[app_client1.app_id]),
#     )

#     # Verify transaction was confirmed by the network
#     assert (
#         dummy_opt_in_appclient3_txn.confirmed_round
#     ), "dummy_opt_in_appclient3_txn round successfully confirmed."

#     # Log
#     log_local_state_info(app_client1, creator.address, logger)
#     log_local_state_info(app_client1, dummy.address, logger)


# Test case: Account submits vote (via default ["NoOp"] using the 'submit_vote()' abimethod)
# def test_submit_vote(
#     app_factory: dict[str, OpenBallotClient],
#     ) -> None:

#     # Get desired App client from 'app_factory'
#     app_client1 = app_factory["app_client1"]
#     # app_client2 = app_clients["app_client2"]
#     app_client3 = app_factory["app_client3"]

#     # Creator uses 'app_client1' to send a txn that executes the 'submit_vote()' abimethod
#     creator_submit_vote_appclient1_txn = app_client1.submit_vote(choice=1)

#     # Verify transaction was confirmed by the network
#     assert (
#         creator_submit_vote_appclient1_txn.confirmed_round
#     ), "creator_submit_vote_appclient1_txn round successfully confirmed."

#     # Dummy uses 'app_client3' (that references 'app_client1') to send a txn that executes the 'submit_vote()' abimethod
#     dummy_submit_vote_appclient1_txn = app_client3.submit_vote(choice=2)

#     # Verify transaction was confirmed by the network
#     assert (
#         dummy_submit_vote_appclient1_txn.confirmed_round
#     ), "dummy_submit_vote_appclient1_txn round successfully confirmed."

#     # Log
#     logger.info(f"Global State attributes: {vars(app_client1.get_global_state())}")
    # log_local_state_info(app_client1, creator.address, logger)
    # log_local_state_info(app_client1, dummy.address, logger)

    # get_txn_logs(algorand, creator_submit_vote_appclient1_txn.tx_id, logger)
    # get_txn_logs(algorand, dummy_submit_vote_appclient1_txn.tx_id, logger)

# Test case: Account opts out of local storage (via ["CloseOut"] using the 'opt_out()' abimethod)
# def test_account_opt_out(
#     algorand: AlgorandClient,
#     app_factory: dict[str, OpenBallotClient],
#     creator: AddressAndSigner,
#     dummy: AddressAndSigner,
#     ) -> None:

#     # Get desired App client from 'app_factory'
#     app_client1 = app_factory["app_client1"]
#     # app_client2 = app_clients["app_client2"]
#     app_client3 = app_factory["app_client3"]

#     # Get creator account balance before close out method is called
#     creator_before_balance = algorand.account.get_information(creator.address)["amount"]
#     logger.info(f"Creator account balance before close out: {creator_before_balance}")

#     # Use App client to send a transaction that executes the 'out-out' close out abimethod for creator
#     creator_opt_out_appclient1_txn = app_client1.close_out_opt_out(account=creator.address)

#     # Verify transaction was confirmed by the network
#     assert (
#         creator_opt_out_appclient1_txn.confirmed_round
#     ), "creator_opt_out_appclient1_txn round successfully confirmed."

#     # Get creator account balance after close out method is called
#     creator_after_balance = algorand.account.get_information(creator.address)["amount"]

#     # Log
#     logger.info(f"Creator account balance after close out: {creator_after_balance}")
#     logger.info(f"Global State attributes: {vars(app_client1.get_global_state())}")
#     get_txn_logs(algorand, creator_opt_out_appclient1_txn.tx_id, logger)

#     # Do the same test for dummy account
#     dummy_before_balance = algorand.account.get_information(dummy.address)["amount"]
#     logger.info(f"Dummy account balance before close out: {dummy_before_balance}")

#     dummy_opt_out_appclient1_txn = app_client3.close_out_opt_out(account=dummy.address)

#     assert (
#         dummy_opt_out_appclient1_txn.confirmed_round
#     ), "dummy_opt_out_appclient1_txn round successfully confirmed."

#     dummy_after_balance = algorand.account.get_information(dummy.address)["amount"]

#     # Log
#     logger.info(f"Dummy account balance after close out: {dummy_after_balance}")
#     logger.info(f"Global State attributes: {vars(app_client3.get_global_state())}")
#     get_txn_logs(algorand, dummy_opt_out_appclient1_txn.tx_id, logger)

# Test case: Creator deletes app client (via ["DeleteApplication"] using the 'terminate()' abimethod)
# def test_delete_app(
#     algorand: AlgorandClient,
#     app_factory: dict[str, OpenBallotClient],
#     creator: AddressAndSigner
#     ) -> None:

#     # Get desired App client from 'app_factory'
#     app_client1 = app_factory["app_client1"]

#     # Get creator account balance before delete method is called
#     creator_before_balance = algorand.account.get_information(creator.address)["amount"]
#     logger.info(f"Creator account balance before deletion: {creator_before_balance}")

#     # Use App client to send a transaction that executes the 'terminate' delete application abimethod
#     creator_delete_appclient1_txn = app_client1.delete_terminate()

#     # Verify transaction was confirmed by the network
#     assert (
#         creator_delete_appclient1_txn.confirmed_round
#     ), "Terminate App delete transaction round successfully confirmed."

#     # Get creator account balance after delete method is called
#     creator_after_balance = algorand.account.get_information(creator.address)["amount"]

#     # Log
#     logger.info(f"Creator account balance after deletion: {creator_after_balance}")
