# smart_contracts/open_ballot/contract.py
from algopy import (
    Account,
    Application,
    ARC4Contract,
    Bytes,
    Global,
    LocalState,
    TemplateVar,
    Txn,
    UInt64,
    arc4,
    BoxMap,
    subroutine,
    gtxn,
    log,
)

# class User(arc4.Struct):
#     pass

class OpenBallot(ARC4Contract):
    # Global State type declarations
    poll_title: Bytes
    poll_choice1: Bytes
    poll_choice2: Bytes
    poll_choice3: Bytes

    poll_start_date_unix: UInt64
    poll_end_date_unix: UInt64
    poll_finalized: UInt64

    total_accounts_opted_in: UInt64

    choice1_total: UInt64
    choice2_total: UInt64
    choice3_total: UInt64
    total_votes: UInt64

    # Initializes the smart contract's local state for vote status and vote choice
    def __init__(self) -> None:
        super().__init__()
        # Local State type declarations
        # self.local_vote_status = LocalState(
        #     UInt64,
        #     key="vote_status",
        #     description="Account vote status ('0' = not voted, '1' = voted)",
        # )
        # self.local_vote_choice = LocalState(
        #     UInt64,
        #     key="vote_choice",
        #     description="Account vote choice (based on UInt64 corresponding w/ choice)",
        # )

        self.vote_status_box = BoxMap(Account, UInt64, key_prefix=b"vote_status_")
        # self.vote_choice = BoxMap(Account, UInt64, key_prefix=b"b_")

    # Calculates the minimum balance requirement total cost for the smart contract
    @subroutine
    def calc_schema_mbr(self, num_bytes: UInt64, num_uint: UInt64) -> UInt64:
        base_fee = UInt64(100_000)  # Base fee (100_000 * (1 + ExtraProgramPages))
        byte_fee = UInt64(50_000)  # Byte slice fee for key-value pair (25_000 + 25_000)
        uint_fee = UInt64(28_500)  # UInt64 fee for key-value pair (25_000 + 3_500)

        # Multiply respective fee cost with the number of key-value pairs in each schema to get total fee amount
        total_byte_fee = byte_fee * num_bytes
        total_uint_fee = uint_fee * num_uint

        # Return the minimum balance requirement total cost
        return base_fee + total_byte_fee + total_uint_fee

    @subroutine
    def calc_single_box_fee(self, key_size: arc4.UInt8, value_size: UInt64) -> UInt64:
        base_fee = arc4.UInt16(2_500)  # Base fee (2_500)
        size_fee = arc4.UInt16(400).native * (
            key_size.native + value_size)  # Size fee (400 per byte * (len(key)+len(value)))

        # Return single box fee
        return base_fee.native + size_fee

    @subroutine
    def calc_box_mbr(self) -> UInt64:
        box1 = self.calc_single_box_fee(arc4.UInt8(44), UInt64(8))  # fee: 0.0229 ALGO
        # box2 = self.calc_single_box_fee(arc4.UInt8(6), UInt64(100))

        return box1


    @arc4.abimethod()
    def pay_box_storage_mbr(self, mbr_pay: gtxn.PaymentTransaction) -> None:
        # Make necessary assertions to verify transaction requirements
        assert mbr_pay.amount >= self.calc_box_mbr(), "MBR payment must meet the minimum requirement amount."
        assert mbr_pay.sender == Txn.sender, "MBR payment sender address must match transaction sender address."
        assert (
            mbr_pay.receiver == Global.current_application_address
        ), "MBR payment reciever address must be the App address."

        status , exists = self.vote_status_box.maybe(Txn.sender)

        if not exists:
            self.vote_status_box[Txn.sender] = UInt64(666777888)

        log("MBR payment amount: ", mbr_pay.amount)

    # Creates the smart contract client
    @arc4.abimethod(create="require")
    def generate(self) -> None:
        # Make necessary assertions to verify transaction requirements
        assert (
            Txn.sender == Global.creator_address
        ), "Transaction sender must match creator address."

        assert Global.creator_address.balance >= (
            Global.min_balance
            + self.calc_schema_mbr(
                num_bytes=UInt64(4), num_uint=UInt64(8)
            )  # Global schema MBR: 0.528 ALGO
        ), "Creator address balance must be equal or greater than Global.min_balance + Global schema MBR amount."

        # Global storage variable value assignments
        self.poll_finalized = UInt64(0)

        self.total_accounts_opted_in = UInt64(0)

        self.choice1_total = UInt64(0)
        self.choice2_total = UInt64(0)
        self.choice3_total = UInt64(0)
        self.total_votes = UInt64(0)


    # Retrieves the version of the smart contract as a Unix timestamp
    @arc4.abimethod()
    def get_version_unix(self) -> UInt64:
        return TemplateVar[UInt64]("VERSION_UNIX")

    # Allows the creator to set up poll data values including title, choices, and dates
    @arc4.abimethod()
    def set_poll(
        self,
        title: Bytes,
        choice1: Bytes,
        choice2: Bytes,
        choice3: Bytes,
        start_date_unix: UInt64,
        end_date_unix: UInt64,
    ) -> None:
        # Make necessary assertions to verify transaction requirements
        assert Txn.sender == Global.creator_address, "Only App creator can set up poll."

        assert title.length <= UInt64(
            118
        ), "Poll title size can not exceed 118 bytes of data per key-value."

        assert (
            choice1.length <= UInt64(116)
            and choice2.length <= UInt64(116)
            and choice3.length <= UInt64(116)
        ), "Poll choice size cannot exceed 116 bytes of data per key-value."

        assert (
            start_date_unix >= Global.latest_timestamp
        ), "Start date must be not be earlier than current date."

        assert (
            end_date_unix >= Global.latest_timestamp
        ), "End date must not be earlier than the current timestamp."

        assert (
            start_date_unix < end_date_unix
        ), "Start date must be earlier than end date."

        assert end_date_unix >= start_date_unix + UInt64(
            3 * 24 * 60 * 60
        ), "End date must be at least 3 days later than the start date."

        assert end_date_unix - start_date_unix <= UInt64(
            14 * 24 * 60 * 60
        ), "Voting period can not exceed 14 days."

        assert self.poll_finalized == UInt64(0), "Poll can only be setup once."

        # Update global state keys with new values
        self.poll_title = title
        self.poll_choice1 = choice1
        self.poll_choice2 = choice2
        self.poll_choice3 = choice3
        self.poll_start_date_unix = start_date_unix
        self.poll_end_date_unix = end_date_unix

        # Finalize poll (ensures poll can only be set once)
        self.poll_finalized = UInt64(1)

    # Allows eligible accounts to opt in to the smart contract's local storage
    # @arc4.abimethod(allow_actions=["OptIn"])
    # def local_storage(self, account: Account) -> None:
    #     # Make necessary assertions to verify transaction requirements
    #     assert Txn.sender == account, "Transaction sender must match account address."

    #     assert account.balance >= (
    #         Global.min_balance
    #         + self.calc_schema_mbr(
    #             num_bytes=UInt64(0), num_uint=UInt64(2)
    #         )  # Local schema MBR: 0.157 ALGO
    #     ), "Account address balance must be equal or greater than Global.min_balance + Local schema MBR amount."

    #     # Change local state var 'self.local_vote_status' (specific to account) value from 'None' to '0'
    #     self.local_vote_status[account] = UInt64(0)

    #     # Change local state var 'self.local_vote_choice' (specific to account) value from 'None' to '0'
    #     self.local_vote_choice[account] = UInt64(0)

    #     # Increment count for total accounts opted in
    #     self.total_accounts_opted_in += UInt64(1)

    # Allows eligible accounts to opt out of the smart contract's local storage
    # @arc4.abimethod(allow_actions=["CloseOut"])
    # def opt_out(self, account: Account) -> None:
    #     # Make necessary assertions to verify transaction requirements
    #     assert account.is_opted_in(
    #         Application(Global.current_application_id.id)
    #     ), "Account must first be opted-in to App client in order to close out."

    #     # Delete account local storage keys and their corresponding values
    #     del self.local_vote_status[account]
    #     del self.local_vote_choice[account]

    #     # Decrement the total count of accounts that are opted in
    #     self.total_accounts_opted_in -= UInt64(1)

    # Allows an opted-in account to submit a vote during the active voting period
    # @arc4.abimethod()
    # def submit_vote(self, choice: UInt64) -> None:
    #     # Make necessary assertions to verify transaction requirements

    #     # assert self.vote_status[Txn.sender] == UInt64(0) and self.vote_choice[Txn.sender] == UInt64(0)

    #     # assert self.vote_status.maybe(Txn.sender)[1] == False, "This account already submitted a vote."

    #     # bla = self.vote_status.maybe(Txn.sender)[1]
    #     # bla[1]

    #     # assert account.is_opted_in(
    #     #     Application(Global.current_application_id.id)
    #     # ), "Account must be opted-in before voting."

    #     # assert (
    #     #     Global.latest_timestamp >= self.poll_start_date_unix
    #     # ), "Voting period has not started yet."

    #     # assert (
    #     #     Global.latest_timestamp <= self.poll_end_date_unix
    #     # ), "Voting period has ended."

    #     # assert (
    #     #     self.local_vote_status[account] == UInt64(0) and self.local_vote_choice[account] == UInt64(0)
    #     # ), "This account already submitted a vote or have not opted-in yet."

    #     assert (
    #         choice == UInt64(1) or choice == UInt64(2) or choice == UInt64(3)
    #     ), "Invalid choice. Can only choose between choices 1, 2, 3."

    #     self.vote_choice[Txn.sender] = choice
    #     self.vote_status[Txn.sender] = UInt64(1)

    #     # self.local_vote_choice[account] = choice  # Set account vote choice (choice selected)
    #     # self.local_vote_status[account] = UInt64(1)  # Set account vote status (has voted)

    #     # Update vote tally
    #     if choice == UInt64(1):
    #         self.choice1_total += UInt64(1)
    #     elif choice == UInt64(2):
    #         self.choice2_total += UInt64(1)
    #     else:
    #         self.choice3_total += UInt64(1)

    #     # Increment count for total votes
    #     self.total_votes += UInt64(1)

    # Allows the creator to delete the smart contract client
    @arc4.abimethod(create="disallow", allow_actions=["DeleteApplication"])
    def terminate(self) -> None:
        # Make necessary assertions to verify transaction requirements
        assert (
            Txn.sender == Global.creator_address
        ), "Only App creator can terminate the App."

        assert TemplateVar[UInt64](
            "DELETABLE"
        ), "Template variable 'DELETABLE' needs to be set to 'true' at deploy-time."
