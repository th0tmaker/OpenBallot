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
    subroutine,
)


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

    def __init__(self) -> None:
        super().__init__()
        # Local State type declarations
        self.local_vote_status = LocalState(
            UInt64,
            key="vote_status",
            description="Account vote status ('0' = not voted, '1' = voted)",
        )

        self.local_vote_choice = LocalState(
            UInt64,
            key="vote_choice",
            description="Account vote choice (based on UInt64 corresponding w/ choice)",
        )

    # Define subroutine that calculates the minimum balance requirement total cost
    @subroutine
    def calc_mbr(self, num_bytes: UInt64, num_uint: UInt64) -> UInt64:
        base_fee = UInt64(100_000)  # Base fee (100_000 * (1 + ExtraProgramPages (if Global base fee)))
        byte_fee = UInt64(50_000)  # Byte slice fee for key-value pair (25_000 + 25_000)
        uint_fee = UInt64(28_500)  # UInt64 fee for key-value pair (25_000 + 3_500)

        # Multiply respective fee cost with the number of key-value pairs in each schema to get total fee amount
        total_byte_fee = byte_fee * num_bytes
        total_uint_fee = uint_fee * num_uint

        # Return the minimum balance requirement total cost
        return base_fee + total_byte_fee + total_uint_fee

    # Define arc4.abimethod that generates the smart contract client
    @arc4.abimethod(create="require")
    def generate(self) -> None:
        # Make necessary assertions to verify transaction requirements
        assert (
            Txn.sender == Global.creator_address
        ), "Transaction sender must match creator address."

        assert Global.creator_address.balance >= (
            Global.min_balance + self.calc_mbr(num_bytes=UInt64(4), num_uint=UInt64(8))  # Global schema MBR: 0.528 ALGO
        ), "Creator address balance must be equal or greater than Global.min_balance + Global schema MBR amount."

        # Global storage variable value assignments
        self.total_accounts_opted_in = UInt64(0)

        self.poll_finalized = UInt64(0)

        self.choice1_total = UInt64(0)
        self.choice2_total = UInt64(0)
        self.choice3_total = UInt64(0)
        self.total_votes = UInt64(0)

        # Testing log() via 'event emitting'
        # arc4.emit("View(uint64)", Global.current_application_id.id)
        # log(
        #     "Generation method successful for App ID: ",
        #     Global.current_application_id.id,
        # )


    # Define arc4.abimethod that allows any eligible account to opt in to the smart contract's local storage
    @arc4.abimethod(allow_actions=["OptIn"])
    def local_storage(self, account: Account) -> None:
        # Make necessary assertions to verify transaction requirements
        assert Txn.sender == account, "Transaction sender must match account address."

        assert account.balance >= (
            Global.min_balance + self.calc_mbr(num_bytes=UInt64(0), num_uint=UInt64(2))  # Local schema MBR: 0.157 ALGO
        ), "Account address balance must be equal or greater than Global.min_balance + Local schema MBR amount."

        # Change local state var 'self.local_vote_status' (specific to account) value from 'None' to '0'
        self.local_vote_status[account] = UInt64(0)

        # Change local state var 'self.local_vote_choice' (specific to account) value from 'None' to '0'
        self.local_vote_choice[account] = UInt64(0)

        # Increment count for total accounts opted in
        self.total_accounts_opted_in += UInt64(1)


    # Define arc4.abimethod that allows any eligible account to opt out of the smart contract's local storage
    @arc4.abimethod(allow_actions=["CloseOut"])
    def opt_out(self, account: Account) -> None:
        # Make necessary assertions to verify transaction requirements
        assert account.is_opted_in(
            Application(Global.current_application_id.id)
        ), "Account must first be opted-in to App client in order to close out."

        # Delete account local storage keys and their corresponding values
        del self.local_vote_status[account]
        del self.local_vote_choice[account]

        # Decrement the total count of accounts that are opted in
        self.total_accounts_opted_in -= UInt64(1)


    # Define arc4.abimethod that allows the creator of the smart contract to set the poll data values
    @arc4.abimethod
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

    # Define arc4.abimethod that allows any eligible account to submit their vote
    @arc4.abimethod
    def submit_vote(self, account: Account, choice: UInt64) -> None:
        # Make necessary assertions to verify transaction requirements
        assert account.is_opted_in(
            Application(Global.current_application_id.id)
        ), "Account must be opted-in before voting."

        assert (
            Global.latest_timestamp >= self.poll_start_date_unix
        ), "Voting period has not started yet."

        assert (
            Global.latest_timestamp <= self.poll_end_date_unix
        ), "Voting period has ended."

        assert self.local_vote_choice[account] == UInt64(
            0
        ), "This account already submitted a vote."

        assert (
            choice == UInt64(1) or choice == UInt64(2) or choice == UInt64(3)
        ), "Invalid choice. Can only choose between choices 1, 2, 3."

        # Mark the account as having voted
        self.local_vote_status[account] = UInt64(1)

        # Increment count for total votes
        self.total_votes += UInt64(1)

        # Update vote tally
        if choice == UInt64(1):
            self.choice1_total += UInt64(1)
            self.local_vote_choice[account] = UInt64(1)
        elif choice == UInt64(2):
            self.choice2_total += UInt64(1)
            self.local_vote_choice[account] = UInt64(2)
        else:
            self.choice3_total += UInt64(1)
            self.local_vote_choice[account] = UInt64(3)


    # Define arc4.abimethod that allows the creator of the smart contract to delete its client
    @arc4.abimethod(create="disallow", allow_actions=["DeleteApplication"])
    def terminate(self) -> None:
        # Make necessary assertions to verify transaction requirements
        assert (
            Txn.sender == Global.creator_address
        ), "Only App creator can terminate the App."

        # assert TemplateVar[UInt64]("DELETABLE"), "Template variable 'DELETABLE' needs to be specified."
