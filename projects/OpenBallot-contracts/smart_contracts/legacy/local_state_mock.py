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

        # assert account.is_opted_in(
        #     Application(Global.current_application_id.id)
        # ), "Account must be opted-in before voting."

        # assert (
        #     self.local_vote_status[account] == UInt64(0) and self.local_vote_choice[account] == UInt64(0)
        # ), "This account already submitted a vote or have not opted-in yet."

        # self.local_vote_choice[account] = choice  # Set account vote choice (choice selected)
        # self.local_vote_status[account] = UInt64(1)  # Set account vote status (has voted)
