# smart_contracts/open_ballot/contract.py
from algopy import (
    Account,
    ARC4Contract,
    BoxMap,
    Bytes,
    Global,
    TemplateVar,
    Txn,
    UInt64,
    arc4,
    gtxn,
    itxn,
    subroutine,
)


class VoterData(arc4.Struct):
    voted: arc4.UInt8  # Description="VoterData.voted ('0' = not voted, '1' = voted)",
    choice: (
        arc4.UInt8
    )  # Description="VoterData.choice (based on arc4.UInt8 value corresponding w/ choice)"


class OpenBallot(ARC4Contract):
    # Global State type declarations
    poll_title: Bytes
    poll_choice1: Bytes
    poll_choice2: Bytes
    poll_choice3: Bytes

    poll_start_date_unix: UInt64
    poll_end_date_unix: UInt64
    poll_finalized: UInt64

    total_purged_box_a_: UInt64

    total_choice1: UInt64
    total_choice2: UInt64
    total_choice3: UInt64
    total_votes: UInt64

    # Initializes the smart contract's box and local storage variables if any
    def __init__(self) -> None:
        super().__init__()
        # Box Storage type declarations
        self.box_a_voter_data = BoxMap(Account, VoterData, key_prefix=b"a_")

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

    # Calculate the Global and Local schema minimum balance requirement total cost for the smart contract
    @subroutine
    def calc_schema_mbr(self, num_bytes: UInt64, num_uint: UInt64) -> UInt64:

        # Schema individual fees
        base_fee = UInt64(100_000)  # Base fee (100_000 * (1 + ExtraProgramPages))
        byte_fee = UInt64(50_000)  # Byte slice fee for key-value pair (25_000 + 25_000)
        uint_fee = UInt64(28_500)  # UInt64 fee for key-value pair (25_000 + 3_500)

        # Multiply respective fee cost with the number of key-value pairs in each schema to get total fee amount
        total_byte_fee = byte_fee * num_bytes
        total_uint_fee = uint_fee * num_uint

        # Return the minimum balance requirement total cost
        return base_fee + total_byte_fee + total_uint_fee

    # Calculate box fee for single box unit
    @subroutine
    def calc_single_box_fee(
        self, key_size: arc4.UInt8, value_size: arc4.UInt8
    ) -> UInt64:

        # Formula for calculating single box fee
        base_fee = arc4.UInt16(2_500)  # Base fee (2_500)
        size_fee = arc4.UInt16(400).native * (
            key_size.native + value_size.native
        )  # Size fee (400 per byte * (len(key)+len(value)))

        # Return single box fee
        return base_fee.native + size_fee

    # Calculate the Box storage minimum balance requirement total cost for the smart contract
    @subroutine
    def calc_box_storage_mbr(self) -> UInt64:

        # Calculate Box A fee
        box_a_ = self.calc_single_box_fee(
            arc4.UInt8(34), arc4.UInt8(2)
        )  # fee: 0.0169 ALGO

        # Return the minimum balance requirement total cost
        return box_a_

    # Call the 'Create' abimethod that generates the smart contract client and initializes global storage int variables
    @arc4.abimethod(create="require")
    def generate(self) -> None:
        # Make necessary assertions to verify transaction requirements
        assert (
            Txn.sender == Global.creator_address
        ), "Transaction sender address must match application creator address."

        assert Global.creator_address.balance >= (
            Global.min_balance
            + self.calc_schema_mbr(
                num_bytes=UInt64(4), num_uint=UInt64(8)
            )  # Global schema MBR: 0.1 (Global.min_balance) + 0.428 ALGO (Global schema)
        ), "Application creator address balance must be equal or greater than Global.min_balance + Global schema MBR."

        # Initialize Global storage with default value assignments
        self.poll_finalized = UInt64(0)

        self.total_choice1 = UInt64(0)
        self.total_choice2 = UInt64(0)
        self.total_choice3 = UInt64(0)
        self.total_votes = UInt64(0)

        self.total_purged_box_a_ = UInt64(0)

    # Retrieve the version of the smart contract in an Unix format timestamp
    @arc4.abimethod
    def get_version_unix(self) -> UInt64:
        return TemplateVar[UInt64]("VERSION_UNIX")

    # Enable application creator to set up poll data values including title, choices, and dates
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
        assert (
            Txn.sender == Global.creator_address
        ), "Only application creator can set up poll."

        assert title.length <= UInt64(
            118
        ), "Poll title size can not exceed 118 bytes of data per key-value."

        assert (
            choice1.length <= UInt64(116)
            and choice2.length <= UInt64(116)
            and choice3.length <= UInt64(116)
        ), "Poll choice size cannot exceed 116 bytes of data per key-value."

        # assert (
        #     start_date_unix >= Global.latest_timestamp
        # ), "Start date must be not be earlier than current date."

        # assert (
        #     end_date_unix >= Global.latest_timestamp
        # ), "End date must not be earlier than the current timestamp."

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

    # Enable application creator to fund App address and covers its Global minimum balance and Box storage MBR
    @arc4.abimethod
    def fund_app_mbr(self, mbr_pay: gtxn.PaymentTransaction) -> None:
        # Make necessary assertions to verify transaction requirements
        assert (
            Txn.sender == Global.creator_address
        ), "Transaction sender address must match application creator address."

        assert (
            Txn.sender not in self.box_a_voter_data
        ), "Transaction sender address already present in box a_."

        assert (
            mbr_pay.sender == Global.creator_address
        ), "MBR payment sender address must match appplication creator address."

        assert (
            mbr_pay.receiver == Global.current_application_address
        ), "MBR payment reciever address must match application address."

        assert (
            mbr_pay.amount
            >= self.calc_box_storage_mbr()  # Box Storage MBR: 0.0169 ALGO
        ), "MBR payment for box storage must meet the minimum requirement amount."

        assert Global.current_application_address.balance >= (
            Global.min_balance + self.calc_box_storage_mbr()
        ), "Application address balance must be equal or greater than Global.min_balance + Box storage fee."

        assert (
            Global.latest_timestamp <= self.poll_end_date_unix
        ), "Unable to fund app mbr if voting period is over."

        # Check if voter data box doesn't already exist, if not (False) then create new one
        # if not self.box_a_voter_data.maybe(Txn.sender)[1]: <- This works too if copy() used
        if Global.creator_address not in self.box_a_voter_data:
            self.box_a_voter_data[Global.creator_address] = VoterData(
                arc4.UInt8(0), arc4.UInt8(0)
            )

    # Enable any eligible account to request box storage by paying a MBR cost
    @arc4.abimethod
    def request_box_storage(self, mbr_pay: gtxn.PaymentTransaction) -> None:
        # Make necessary assertions to verify transaction requirements
        assert (
            Txn.sender != Global.creator_address
        ), "Invalid sender address! Application creator address can not use request box storage method."

        assert (
            Txn.sender not in self.box_a_voter_data
        ), "Transaction sender address must not be present in box a_."

        assert (
            mbr_pay.sender not in self.box_a_voter_data
        ), "Box storage MBR payment sender address must not be present in box a_."

        assert (
            mbr_pay.receiver == Global.current_application_address
        ), "Box storage MBR payment reciever address must match application address."

        assert (
            mbr_pay.amount >= self.calc_box_storage_mbr()  # Box a_ fee: 0.0169 ALGO
        ), "Box storage MBR payment amount must be equal or greater than box _a fee."

        assert (
            Global.latest_timestamp <= self.poll_end_date_unix
        ), "Unable to request box storage if voting period is over."

        # Check if voter data box doesn't already exist, if not (False) then create new one
        # if not self.box_a_voter_data.maybe(Txn.sender)[1]: <- This works too if copy() used
        if Txn.sender not in self.box_a_voter_data:
            self.box_a_voter_data[Txn.sender] = VoterData(arc4.UInt8(0), arc4.UInt8(0))

    # Enable any eligible account to submit a vote
    @arc4.abimethod
    def submit_vote(self, choice: arc4.UInt8) -> None:
        # Make necessary assertions to verify transaction requirements
        assert (
            Txn.sender in self.box_a_voter_data
        ), "Transaction sender address must be present in box a_."

        assert (
            self.box_a_voter_data[Txn.sender].voted,
            self.box_a_voter_data[Txn.sender].choice,
        ) == (
            arc4.UInt8(0),
            arc4.UInt8(0),
        ), "Transaction sender address already submitted a vote."

        assert (
            choice == arc4.UInt8(1)
            or choice == arc4.UInt8(2)
            or choice == arc4.UInt8(3)
        ), "Invalid choice. Can only select choices 1, 2, 3."

        # assert (
        #     Global.latest_timestamp >= self.poll_start_date_unix
        # ), "Voting period has not started yet."

        # assert (
        #     Global.latest_timestamp <= self.poll_end_date_unix
        # ), "Voting period has ended."

        # assert account.is_opted_in(
        #     Application(Global.current_application_id.id)
        # ), "Account must be opted-in before voting."

        # assert (
        #     self.local_vote_status[account] == UInt64(0) and self.local_vote_choice[account] == UInt64(0)
        # ), "This account already submitted a vote or have not opted-in yet."

        # self.local_vote_choice[account] = choice  # Set account vote choice (choice selected)
        # self.local_vote_status[account] = UInt64(1)  # Set account vote status (has voted)

        # Set account voter data
        self.box_a_voter_data[Txn.sender] = VoterData(arc4.UInt8(1), choice)

        # Update vote tally
        if choice == UInt64(1):
            self.total_choice1 += UInt64(1)
        elif choice == UInt64(2):
            self.total_choice2 += UInt64(1)
        else:
            self.total_choice3 += UInt64(1)

        # Increment count for total votes
        self.total_votes += UInt64(1)

    # Enable any eligble account to delete their box storage and get their MBR payment refunded
    @arc4.abimethod
    def delete_box_storage(self) -> None:
        # Make necessary assertions to verify transaction requirements
        assert (
            Txn.sender != Global.creator_address
        ), "Invalid sender address! Application creator must delete smart contract to free up their box storage MBR."

        assert (
            Txn.sender in self.box_a_voter_data
        ), "Transaction sender address must be present in box a_."

        # assert (
        #     Global.latest_timestamp >= self.poll_end_date_unix and
        #     Global.latest_timestamp <= (self.poll_end_date_unix + UInt64(7 * 24 * 60 * 60))
        # ), "Box storage can only be deleted within a 7-day window after voting period is over."

        # Delete box key (address) from box storage and decrement box 'a_' total amount
        del self.box_a_voter_data[Txn.sender]

        # Submit inner transaction (transaction sender gets their Box storage MBR refunded)
        min_txn_fee = arc4.UInt16(1000).native
        box_storage_del_refund_itxn = itxn.Payment(
            sender=Global.current_application_address,
            receiver=Txn.sender,
            amount=self.calc_box_storage_mbr() - min_txn_fee,
            fee=min_txn_fee,
            note="Account gets app box storage MBR (0.0169 ALGO) refunded.",
        ).submit()

        assert (
            box_storage_del_refund_itxn.sender == Global.current_application_address
        ), "box_storage_del_refund_itxn sender address must match application address."

        assert (
            box_storage_del_refund_itxn.receiver == Txn.sender
        ), "box_storage_del_refund_itxn reciever address must match transaction sender address."

    # Enable application creator to execute box storage purge, this deletes any boxes not deleted by other accounts
    @arc4.abimethod  # NOTE: Can also use arc4.StaticArray[arc4.Address, t.Literal[8]] to enforce strict size of 8
    def purge_box_storage(self, box_keys: arc4.DynamicArray[arc4.Address]) -> None:
        # Make necessary assertions to verify transaction requirements
        assert (
            Txn.sender == Global.creator_address
        ), "Unauthorized address! Only application creator can purge box storage."

        # assert (
        #     Global.latest_timestamp >= (self.poll_end_date_unix + UInt64(7 * 24 * 60 * 60))
        # ), "Box storage purge only possible after voting period + 7-day box storage deletion window is over."

        assert (
            box_keys.length > 0 and box_keys.length < 9
        ), "The number of addresses represented by box keys array must be greater than 0 and lesser than 9."

        # Iterate through the dynamic array of addresses representing the box key
        for box_key in box_keys:
            # Make necessary assertions to verify transaction requirements
            assert (
                box_key.native in self.box_a_voter_data
            ), "Account address represented in box key must be present in box a_."

            assert (
                box_key.native != Global.creator_address
            ), "Account address represented in box key must not match application creator address."

            del self.box_a_voter_data[
                box_key.native
            ]  # Delete box key (address) from box storage
            self.total_purged_box_a_ += UInt64(
                1
            )  # Increment box 'a_' purged total amount

    # Allow application creator to delete the smart contract client, decrease their MBR balance + any remaining box MBR
    @arc4.abimethod(create="disallow", allow_actions=["DeleteApplication"])
    def terminate(self) -> None:
        # Make necessary assertions to verify transaction requirements
        assert TemplateVar[UInt64](
            "DELETABLE"
        ), "Template variable 'DELETABLE' needs to be 'True' at deploy-time."

        assert (
            Txn.sender == Global.creator_address
        ), "Unauthorized address! Only application creator can delete the smart contract."

        assert (
            Global.creator_address in self.box_a_voter_data
        ), "Transaction sender address must be present in box a_."

        # assert (
        #     Global.latest_timestamp >= (self.poll_end_date_unix + UInt64(7 * 24 * 60 * 60))
        # ), "App can only be deleted after voting period + 7-day box storage deletion window is over."

        del self.box_a_voter_data[
            Global.creator_address
        ]  # Delete box key (creator address) from box storage

        # Define final closing app balance refund transaction
        min_txn_fee = arc4.UInt16(1000).native  # Minimum acceptable fee for transaction
        if self.total_purged_box_a_ > UInt64(0):
            # Execute inner transaction payment with purge refund and close remainder
            del_app_refund_itxn = itxn.Payment(
                sender=Global.current_application_address,
                receiver=Global.creator_address,
                amount=(
                    self.total_purged_box_a_ * self.calc_box_storage_mbr() - min_txn_fee
                ),
                fee=min_txn_fee,
                close_remainder_to=Global.creator_address,
                note=(
                    "Closed remainder of app balance + purged box storage amount to Creator after deletion method."
                ),
            ).submit()
        else:
            # Execute inner transaction that only closes app remainder balance to the creator
            del_app_refund_itxn = itxn.Payment(
                sender=Global.current_application_address,
                receiver=Global.creator_address,
                amount=UInt64(0),  # Send zero amount
                fee=min_txn_fee,
                close_remainder_to=Global.creator_address,
                note="Closing remainder of app balance to Creator after deletion method.",
            ).submit()

        assert (
            del_app_refund_itxn.sender == Global.current_application_address
        ), "del_app_refund_itxn 'sender' address must match Application address."

        assert (
            del_app_refund_itxn.receiver
            and del_app_refund_itxn.close_remainder_to == Global.creator_address
        ), "del_app_refund_itxn 'reciever' and 'close_remainder_to' address must match application Creator address."

    # Allow any eligible account to opt in to the smart contract's local storage
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

    # Allow any eligible account to opt out of the smart contract's local storage
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
