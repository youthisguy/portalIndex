# Portaldot metadata dump
- Chain: PortaldotV3 Test
- Endpoint: wss://test-node-v3.portaldot.dev
- Tokens: tPOT | Decimals: 14 | SS58: 42
- Spec version: 3002

## Pallets (69)
- [0] System
- [1] Utility
- [2] Babe
- [3] Timestamp
- [4] Authorship
- [5] Indices
- [6] Balances
- [7] TransactionPayment
- [9] AssetConversionTxPayment
- [10] ElectionProviderMultiPhase
- [11] Staking
- [12] Session
- [15] TechnicalCommittee
- [17] TechnicalMembership
- [18] Grandpa
- [19] Treasury
- [20] AssetRate
- [21] Contracts
- [22] Sudo
- [23] ImOnline
- [24] AuthorityDiscovery
- [25] Offences
- [26] Historical
- [28] Identity
- [30] Recovery
- [31] Vesting
- [32] Scheduler
- [34] Preimage
- [35] Proxy
- [36] Multisig
- [37] Bounties
- [39] Assets
- [40] PoolAssets
- [41] Beefy
- [42] Mmr
- [43] MmrLeaf
- [44] Lottery
- [46] Uniques
- [47] Nfts
- [48] NftFractionalization
- [51] TransactionStorage
- [52] VoterList
- [54] ChildBounties
- [56] Remark
- [62] NominationPools
- [65] AssetConversion
- [66] FastUnstake
- [67] MessageQueue
- [69] TxPause
- [70] SafeMode
- [71] Statement
- [72] MultiBlockMigrations
- [73] Broker
- [75] Mixnet
- [76] Parameters
- [77] SkipFeelessPayment
- [79] AssetConversionMigration
- [80] Revive
- [81] VerifySignature
- [82] DelegatedStaking
- [84] AssetsFreezer
- [85] Oracle
- [89] MetaTx
- [90] MultiAssetBounties
- [91] AssetsPrecompiles
- [92] AssetsPrecompilesPermit
- [93] VestingPrecompiles
- [95] RegistrarPara
- [96] RegistrarRelay

## Presence check
- assets: YES (Assets)
- uniques: YES (Uniques)
- nfts: YES (Nfts)
- revive: YES (Revive)
- balances: YES (Balances)

## Events
### assetConversion (7 events)
- PoolCreated
- PoolFeeSet
- LiquidityAdded
- LiquidityRemoved
- SwapExecuted
- SwapCreditExecuted
- Touched
### assetConversionMigration (1 events)
- MigratedToNewAccount
### assetConversionTxPayment (2 events)
- AssetTxFeePaid
- AssetRefundFailed
### assetRate (3 events)
- AssetRateCreated
- AssetRateRemoved
- AssetRateUpdated
### assets (32 events)
- Created(asset_id: T::AssetId, creator: T::AccountId, owner: T::AccountId)
- Issued(asset_id: T::AssetId, owner: T::AccountId, amount: T::Balance)
- Transferred(asset_id: T::AssetId, from: T::AccountId, to: T::AccountId, amount: T::Balance)
- Burned(asset_id: T::AssetId, owner: T::AccountId, balance: T::Balance)
- TeamChanged(asset_id: T::AssetId, issuer: T::AccountId, admin: T::AccountId, freezer: T::AccountId)
- OwnerChanged(asset_id: T::AssetId, owner: T::AccountId)
- Frozen(asset_id: T::AssetId, who: T::AccountId)
- Thawed(asset_id: T::AssetId, who: T::AccountId)
- AssetFrozen(asset_id: T::AssetId)
- AssetThawed(asset_id: T::AssetId)
- AccountsDestroyed(asset_id: T::AssetId, accounts_destroyed: u32, accounts_remaining: u32)
- ApprovalsDestroyed(asset_id: T::AssetId, approvals_destroyed: u32, approvals_remaining: u32)
- DestructionStarted(asset_id: T::AssetId)
- Destroyed(asset_id: T::AssetId)
- ForceCreated(asset_id: T::AssetId, owner: T::AccountId)
- MetadataSet(asset_id: T::AssetId, name: Vec<u8>, symbol: Vec<u8>, decimals: u8, is_frozen: bool)
- MetadataCleared(asset_id: T::AssetId)
- ApprovedTransfer(asset_id: T::AssetId, source: T::AccountId, delegate: T::AccountId, amount: T::Balance)
- ApprovalCancelled(asset_id: T::AssetId, owner: T::AccountId, delegate: T::AccountId)
- TransferredApproved(asset_id: T::AssetId, owner: T::AccountId, delegate: T::AccountId, destination: T::AccountId, amount: T::Balance)
- AssetStatusChanged(asset_id: T::AssetId)
- AssetMinBalanceChanged(asset_id: T::AssetId, new_min_balance: T::Balance)
- Touched(asset_id: T::AssetId, who: T::AccountId, depositor: T::AccountId)
- Blocked(asset_id: T::AssetId, who: T::AccountId)
- Deposited(asset_id: T::AssetId, who: T::AccountId, amount: T::Balance)
- Withdrawn(asset_id: T::AssetId, who: T::AccountId, amount: T::Balance)
- ReservesUpdated(asset_id: T::AssetId, reserves: Vec<T::ReserveData>)
- ReservesRemoved(asset_id: T::AssetId)
- IssuedCredit(asset_id: T::AssetId, amount: T::Balance)
- BurnedCredit(asset_id: T::AssetId, amount: T::Balance)
- IssuedDebt(asset_id: T::AssetId, amount: T::Balance)
- BurnedDebt(asset_id: T::AssetId, amount: T::Balance)
### assetsFreezer (2 events)
- Frozen
- Thawed
### balances (30 events)
- Endowed(account: T::AccountId, free_balance: T::Balance)
- DustLost(account: T::AccountId, amount: T::Balance)
- Transfer(from: T::AccountId, to: T::AccountId, amount: T::Balance)
- BalanceSet(who: T::AccountId, free: T::Balance)
- Reserved(who: T::AccountId, amount: T::Balance)
- Unreserved(who: T::AccountId, amount: T::Balance)
- ReserveRepatriated(from: T::AccountId, to: T::AccountId, amount: T::Balance, destination_status: Status)
- Deposit(who: T::AccountId, amount: T::Balance)
- Withdraw(who: T::AccountId, amount: T::Balance)
- Slashed(who: T::AccountId, amount: T::Balance)
- Minted(who: T::AccountId, amount: T::Balance)
- MintedCredit(amount: T::Balance)
- Burned(who: T::AccountId, amount: T::Balance)
- BurnedDebt(amount: T::Balance)
- Suspended(who: T::AccountId, amount: T::Balance)
- Restored(who: T::AccountId, amount: T::Balance)
- Upgraded(who: T::AccountId)
- Issued(amount: T::Balance)
- Rescinded(amount: T::Balance)
- Locked(who: T::AccountId, amount: T::Balance)
- Unlocked(who: T::AccountId, amount: T::Balance)
- Frozen(who: T::AccountId, amount: T::Balance)
- Thawed(who: T::AccountId, amount: T::Balance)
- TotalIssuanceForced(old: T::Balance, new: T::Balance)
- Held(reason: T::RuntimeHoldReason, who: T::AccountId, amount: T::Balance)
- BurnedHeld(reason: T::RuntimeHoldReason, who: T::AccountId, amount: T::Balance)
- TransferOnHold(reason: T::RuntimeHoldReason, source: T::AccountId, dest: T::AccountId, amount: T::Balance)
- TransferAndHold(reason: T::RuntimeHoldReason, source: T::AccountId, dest: T::AccountId, transferred: T::Balance)
- Released(reason: T::RuntimeHoldReason, who: T::AccountId, amount: T::Balance)
- Unexpected(: UnexpectedKind)
### bounties (13 events)
- BountyProposed
- BountyRejected
- BountyBecameActive
- BountyAwarded
- BountyClaimed
- BountyCanceled
- BountyExtended
- BountyApproved
- CuratorProposed
- CuratorUnassigned
- CuratorAccepted
- DepositPoked
- BountyFundsReclaimed
### broker (37 events)
- Purchased
- Renewable
- Renewed
- Transferred
- Partitioned
- Interlaced
- Assigned
- AssignmentRemoved
- Pooled
- CoreCountRequested
- CoreCountChanged
- ReservationMade
- ReservationCancelled
- SaleInitialized
- Leased
- LeaseRemoved
- LeaseEnding
- SalesStarted
- RevenueClaimBegun
- RevenueClaimItem
- RevenueClaimPaid
- CreditPurchased
- RegionDropped
- ContributionDropped
- RegionUnpooled
- HistoryInitialized
- HistoryDropped
- HistoryIgnored
- ClaimsReady
- CoreAssigned
- PotentialRenewalDropped
- AutoRenewalEnabled
- AutoRenewalDisabled
- AutoRenewalFailed
- AutoRenewalLimitReached
- ForceReservationFailed
- PotentialRenewalRemoved
### childBounties (4 events)
- Added
- Awarded
- Claimed
- Canceled
### contracts (10 events)
- Instantiated
- Terminated
- CodeStored
- ContractEmitted
- CodeRemoved
- ContractCodeUpdated
- Called
- DelegateCalled
- StorageDepositTransferredAndHeld
- StorageDepositTransferredAndReleased
### delegatedStaking (4 events)
- Delegated
- Released
- Slashed
- MigratedDelegation
### electionProviderMultiPhase (6 events)
- SolutionStored
- ElectionFinalized
- ElectionFailed
- Rewarded
- Slashed
- PhaseTransitioned
### fastUnstake (5 events)
- Unstaked
- Slashed
- BatchChecked
- BatchFinished
- InternalError
### grandpa (3 events)
- NewAuthorities
- Paused
- Resumed
### historical (2 events)
- RootStored
- RootsPruned
### identity (23 events)
- IdentitySet
- IdentityCleared
- IdentityKilled
- JudgementRequested
- JudgementUnrequested
- JudgementGiven
- RegistrarAdded
- RegistrarRemoved
- SubIdentityAdded
- SubIdentitiesSet
- SubIdentityRenamed
- SubIdentityRemoved
- SubIdentityRevoked
- AuthorityAdded
- AuthorityRemoved
- UsernameSet
- UsernameQueued
- PreapprovalExpired
- PrimaryUsernameSet
- DanglingUsernameRemoved
- UsernameUnbound
- UsernameRemoved
- UsernameKilled
### imOnline (3 events)
- HeartbeatReceived
- AllGood
- SomeOffline
### indices (4 events)
- IndexAssigned
- IndexFreed
- IndexFrozen
- DepositPoked
### lottery (4 events)
- LotteryStarted
- CallsUpdated
- Winner
- TicketBought
### messageQueue (4 events)
- ProcessingFailed
- Processed
- OverweightEnqueued
- PageReaped
### metaTx (1 events)
- Dispatched
### multiAssetBounties (13 events)
- BountyCreated
- ChildBountyCreated
- BountyBecameActive
- BountyAwarded
- BountyPayoutProcessed
- BountyFundingProcessed
- BountyRefundProcessed
- BountyCanceled
- CuratorUnassigned
- CuratorProposed
- PaymentFailed
- Paid
- BountyValueIncreased
### multiBlockMigrations (8 events)
- UpgradeStarted
- UpgradeCompleted
- UpgradeFailed
- MigrationSkipped
- MigrationAdvanced
- MigrationCompleted
- MigrationFailed
- HistoricCleared
### multisig (5 events)
- NewMultisig
- MultisigApproval
- MultisigExecuted
- MultisigCancelled
- DepositPoked
### nftFractionalization (2 events)
- NftFractionalized
- NftUnified
### nfts (38 events)
- Created(collection: T::CollectionId, creator: T::AccountId, owner: T::AccountId)
- ForceCreated(collection: T::CollectionId, owner: T::AccountId)
- Destroyed(collection: T::CollectionId)
- Issued(collection: T::CollectionId, item: T::ItemId, owner: T::AccountId)
- Transferred(collection: T::CollectionId, item: T::ItemId, from: T::AccountId, to: T::AccountId)
- Burned(collection: T::CollectionId, item: T::ItemId, owner: T::AccountId)
- ItemTransferLocked(collection: T::CollectionId, item: T::ItemId)
- ItemTransferUnlocked(collection: T::CollectionId, item: T::ItemId)
- ItemPropertiesLocked(collection: T::CollectionId, item: T::ItemId, lock_metadata: bool, lock_attributes: bool)
- CollectionLocked(collection: T::CollectionId)
- OwnerChanged(collection: T::CollectionId, new_owner: T::AccountId)
- TeamChanged(collection: T::CollectionId, issuer: Option<T::AccountId>, admin: Option<T::AccountId>, freezer: Option<T::AccountId>)
- TransferApproved(collection: T::CollectionId, item: T::ItemId, owner: T::AccountId, delegate: T::AccountId, deadline: Option<BlockNumberFor<T, I>>)
- ApprovalCancelled(collection: T::CollectionId, item: T::ItemId, owner: T::AccountId, delegate: T::AccountId)
- AllApprovalsCancelled(collection: T::CollectionId, item: T::ItemId, owner: T::AccountId)
- CollectionConfigChanged(collection: T::CollectionId)
- CollectionMetadataSet(collection: T::CollectionId, data: BoundedVec<u8, T::StringLimit>)
- CollectionMetadataCleared(collection: T::CollectionId)
- ItemMetadataSet(collection: T::CollectionId, item: T::ItemId, data: BoundedVec<u8, T::StringLimit>)
- ItemMetadataCleared(collection: T::CollectionId, item: T::ItemId)
- Redeposited(collection: T::CollectionId, successful_items: Vec<T::ItemId>)
- AttributeSet(collection: T::CollectionId, maybe_item: Option<T::ItemId>, key: BoundedVec<u8, T::KeyLimit>, value: BoundedVec<u8, T::ValueLimit>, namespace: AttributeNamespace<T::AccountId>)
- AttributeCleared(collection: T::CollectionId, maybe_item: Option<T::ItemId>, key: BoundedVec<u8, T::KeyLimit>, namespace: AttributeNamespace<T::AccountId>)
- ItemAttributesApprovalAdded(collection: T::CollectionId, item: T::ItemId, delegate: T::AccountId)
- ItemAttributesApprovalRemoved(collection: T::CollectionId, item: T::ItemId, delegate: T::AccountId)
- OwnershipAcceptanceChanged(who: T::AccountId, maybe_collection: Option<T::CollectionId>)
- CollectionMaxSupplySet(collection: T::CollectionId, max_supply: u32)
- CollectionMintSettingsUpdated(collection: T::CollectionId)
- NextCollectionIdIncremented(next_id: Option<T::CollectionId>)
- ItemPriceSet(collection: T::CollectionId, item: T::ItemId, price: ItemPrice<T, I>, whitelisted_buyer: Option<T::AccountId>)
- ItemPriceRemoved(collection: T::CollectionId, item: T::ItemId)
- ItemBought(collection: T::CollectionId, item: T::ItemId, price: ItemPrice<T, I>, seller: T::AccountId, buyer: T::AccountId)
- TipSent(collection: T::CollectionId, item: T::ItemId, sender: T::AccountId, receiver: T::AccountId, amount: DepositBalanceOf<T, I>)
- SwapCreated(offered_collection: T::CollectionId, offered_item: T::ItemId, desired_collection: T::CollectionId, desired_item: Option<T::ItemId>, price: Option<PriceWithDirection<ItemPrice<T, I>>>, deadline: BlockNumberFor<T, I>)
- SwapCancelled(offered_collection: T::CollectionId, offered_item: T::ItemId, desired_collection: T::CollectionId, desired_item: Option<T::ItemId>, price: Option<PriceWithDirection<ItemPrice<T, I>>>, deadline: BlockNumberFor<T, I>)
- SwapClaimed(sent_collection: T::CollectionId, sent_item: T::ItemId, sent_item_owner: T::AccountId, received_collection: T::CollectionId, received_item: T::ItemId, received_item_owner: T::AccountId, price: Option<PriceWithDirection<ItemPrice<T, I>>>, deadline: BlockNumberFor<T, I>)
- PreSignedAttributesSet(collection: T::CollectionId, item: T::ItemId, namespace: AttributeNamespace<T::AccountId>)
- PalletAttributeSet(collection: T::CollectionId, item: Option<T::ItemId>, attribute: PalletAttributes<T::CollectionId>, value: BoundedVec<u8, T::ValueLimit>)
### nominationPools (23 events)
- Created
- Bonded
- PaidOut
- Unbonded
- Withdrawn
- Destroyed
- StateChanged
- MemberRemoved
- RolesUpdated
- PoolSlashed
- UnbondingPoolSlashed
- PoolCommissionUpdated
- PoolMaxCommissionUpdated
- PoolCommissionChangeRateUpdated
- PoolCommissionClaimPermissionUpdated
- PoolCommissionClaimed
- MinBalanceDeficitAdjusted
- MinBalanceExcessAdjusted
- MemberClaimPermissionUpdated
- MetadataUpdated
- PoolNominationMade
- PoolNominatorChilled
- GlobalParamsUpdated
### offences (1 events)
- Offence
### oracle (1 events)
- NewFeedData
### parameters (1 events)
- Updated
### poolAssets (32 events)
- Created
- Issued
- Transferred
- Burned
- TeamChanged
- OwnerChanged
- Frozen
- Thawed
- AssetFrozen
- AssetThawed
- AccountsDestroyed
- ApprovalsDestroyed
- DestructionStarted
- Destroyed
- ForceCreated
- MetadataSet
- MetadataCleared
- ApprovedTransfer
- ApprovalCancelled
- TransferredApproved
- AssetStatusChanged
- AssetMinBalanceChanged
- Touched
- Blocked
- Deposited
- Withdrawn
- ReservesUpdated
- ReservesRemoved
- IssuedCredit
- BurnedCredit
- IssuedDebt
- BurnedDebt
### preimage (3 events)
- Noted
- Requested
- Cleared
### proxy (7 events)
- ProxyExecuted
- PureCreated
- PureKilled
- Announced
- ProxyAdded
- ProxyRemoved
- DepositPoked
### recovery (9 events)
- AttemptApproved
- AttemptCanceled
- AttemptInitiated
- AttemptFinished
- AttemptDiscarded
- AttemptSlashed
- FriendGroupsChanged
- InheritorRevoked
- RecoveredAccountControlled
### registrarPara (6 events)
- Reserved
- RegisterRequested
- Registered
- RegistrationFailed
- CancelRequested
- RegistrationCancelled
### registrarRelay (6 events)
- RegistrationPending
- RegistrationRejected
- Registered
- AuthorizationCancelled
- CancellationRefused
- ReportFailed
### remark (1 events)
- Stored
### revive (3 events)
- ContractEmitted(contract: H160, data: Vec<u8>, topics: Vec<H256>)
- Instantiated(deployer: H160, contract: H160)
- EthExtrinsicRevert(dispatch_error: DispatchError)
### safeMode (8 events)
- Entered
- Extended
- Exited
- DepositPlaced
- DepositReleased
- DepositSlashed
- CannotDeposit
- CannotRelease
### scheduler (10 events)
- Scheduled
- Canceled
- Dispatched
- RetrySet
- RetryCancelled
- CallUnavailable
- PeriodicFailed
- RetryFailed
- PermanentlyOverweight
- AgendaIncomplete
### session (4 events)
- NewSession
- NewQueued
- ValidatorDisabled
- ValidatorReenabled
### skipFeelessPayment (1 events)
- FeeSkipped
### staking (19 events)
- EraPaid
- Rewarded
- Slashed
- SlashReported
- OldSlashingReportDiscarded
- StakersElected
- Bonded
- Unbonded
- Withdrawn
- Kicked
- StakingElectionFailed
- Chilled
- PayoutStarted
- ValidatorPrefsSet
- SnapshotVotersSizeExceeded
- SnapshotTargetsSizeExceeded
- ForceEra
- ControllerBatchDeprecated
- CurrencyMigrated
### statement (1 events)
- NewStatement
### sudo (4 events)
- Sudid
- KeyChanged
- KeyRemoved
- SudoAsDone
### system (8 events)
- ExtrinsicSuccess
- ExtrinsicFailed
- CodeUpdated
- NewAccount
- KilledAccount
- Remarked
- UpgradeAuthorized
- RejectedInvalidAuthorizedUpgrade
### technicalCommittee (10 events)
- Proposed
- Voted
- Approved
- Disapproved
- Executed
- MemberExecuted
- Closed
- Killed
- ProposalCostBurned
- ProposalCostReleased
### technicalMembership (6 events)
- MemberAdded
- MemberRemoved
- MembersSwapped
- MembersReset
- KeyChanged
- Dummy
### transactionPayment (1 events)
- TransactionFeePaid
### transactionStorage (9 events)
- Stored
- Renewed
- ProofChecked
- AccountAuthorized
- AccountAuthorizationRefreshed
- PreimageAuthorized
- PreimageAuthorizationRefreshed
- ExpiredAccountAuthorizationRemoved
- ExpiredPreimageAuthorizationRemoved
### treasury (12 events)
- Spending
- Awarded
- Burnt
- Rollover
- Deposit
- SpendApproved
- UpdatedInactive
- AssetSpendApproved
- AssetSpendVoided
- Paid
- PaymentFailed
- SpendProcessed
### txPause (2 events)
- CallPaused
- CallUnpaused
### uniques (27 events)
- Created(collection: T::CollectionId, creator: T::AccountId, owner: T::AccountId)
- ForceCreated(collection: T::CollectionId, owner: T::AccountId)
- Destroyed(collection: T::CollectionId)
- Issued(collection: T::CollectionId, item: T::ItemId, owner: T::AccountId)
- Transferred(collection: T::CollectionId, item: T::ItemId, from: T::AccountId, to: T::AccountId)
- Burned(collection: T::CollectionId, item: T::ItemId, owner: T::AccountId)
- Frozen(collection: T::CollectionId, item: T::ItemId)
- Thawed(collection: T::CollectionId, item: T::ItemId)
- CollectionFrozen(collection: T::CollectionId)
- CollectionThawed(collection: T::CollectionId)
- OwnerChanged(collection: T::CollectionId, new_owner: T::AccountId)
- TeamChanged(collection: T::CollectionId, issuer: T::AccountId, admin: T::AccountId, freezer: T::AccountId)
- ApprovedTransfer(collection: T::CollectionId, item: T::ItemId, owner: T::AccountId, delegate: T::AccountId)
- ApprovalCancelled(collection: T::CollectionId, item: T::ItemId, owner: T::AccountId, delegate: T::AccountId)
- ItemStatusChanged(collection: T::CollectionId)
- CollectionMetadataSet(collection: T::CollectionId, data: BoundedVec<u8, T::StringLimit>, is_frozen: bool)
- CollectionMetadataCleared(collection: T::CollectionId)
- MetadataSet(collection: T::CollectionId, item: T::ItemId, data: BoundedVec<u8, T::StringLimit>, is_frozen: bool)
- MetadataCleared(collection: T::CollectionId, item: T::ItemId)
- Redeposited(collection: T::CollectionId, successful_items: Vec<T::ItemId>)
- AttributeSet(collection: T::CollectionId, maybe_item: Option<T::ItemId>, key: BoundedVec<u8, T::KeyLimit>, value: BoundedVec<u8, T::ValueLimit>)
- AttributeCleared(collection: T::CollectionId, maybe_item: Option<T::ItemId>, key: BoundedVec<u8, T::KeyLimit>)
- OwnershipAcceptanceChanged(who: T::AccountId, maybe_collection: Option<T::CollectionId>)
- CollectionMaxSupplySet(collection: T::CollectionId, max_supply: u32)
- ItemPriceSet(collection: T::CollectionId, item: T::ItemId, price: ItemPrice<T, I>, whitelisted_buyer: Option<T::AccountId>)
- ItemPriceRemoved(collection: T::CollectionId, item: T::ItemId)
- ItemBought(collection: T::CollectionId, item: T::ItemId, price: ItemPrice<T, I>, seller: T::AccountId, buyer: T::AccountId)
### utility (8 events)
- BatchInterrupted
- BatchCompleted
- BatchCompletedWithErrors
- ItemCompleted
- ItemFailed
- DispatchedAs
- IfElseMainSuccess
- IfElseFallbackCalled
### vesting (3 events)
- VestingCreated
- VestingUpdated
- VestingCompleted
### voterList (2 events)
- Rebagged
- ScoreUpdated

## Runtime APIs
- accountNonceApi: accountNonce
- assetConversionApi: quotePriceTokensForExactTokens, quotePriceExactTokensForTokens, getReserves
- assetsApi: accountBalances
- authorityDiscoveryApi: authorities
- babeApi: configuration, currentEpochStart, currentEpoch, nextEpoch, generateKeyOwnershipProof, submitReportEquivocationUnsignedExtrinsic
- beefyApi: beefyGenesis, validatorSet, submitReportDoubleVotingUnsignedExtrinsic, submitReportForkVotingUnsignedExtrinsic, submitReportFutureBlockVotingUnsignedExtrinsic, generateKeyOwnershipProof
- blockBuilder: applyExtrinsic, finalizeBlock, inherentExtrinsics, checkInherents
- contractsApi: call, instantiate, uploadCode, getStorage
- core: version, executeBlock, initializeBlock
- genesisBuilder: buildState, getPreset, presetNames
- grandpaApi: grandpaAuthorities, submitReportEquivocationUnsignedExtrinsic, generateKeyOwnershipProof, currentSetId
- metadata: metadata, metadataAtVersion, metadataVersions
- mixnetApi: sessionStatus, prevMixnodes, currentMixnodes, maybeRegister
- mmrApi: mmrRoot, mmrLeafCount, generateProof, generateAncestryProof, verifyProof, verifyProofStateless
- nftsApi: owner, collectionOwner, attribute, customAttribute, systemAttribute, collectionAttribute
- nominationPoolsApi: pendingRewards, pointsToBalance, balanceToPoints, poolPendingSlash, memberPendingSlash, poolNeedsDelegateMigration, memberNeedsDelegateMigration, memberTotalBalance, poolBalance, poolAccounts
- offchainWorkerApi: offchainWorker
- oracleApi: getValue, getAllValues
- reviveApi: ethBlock, ethBlockHash, ethReceiptData, blockGasLimit, maxExtrinsicWeightInGas, balance, gasPrice, nonce, call, instantiate, ethTransact, ethTransactWithConfig, ethEstimateGas, ethPreDispatchWeight, uploadCode, getStorage, getStorageVarKey, traceBlock, traceTx, traceCall, traceCallWithConfig, blockAuthor, address, accountId, runtimePalletsAddress, code, newBalanceWithDust, versionDeclarations, ethBlockVersioned, ethBlockHashVersioned, ethReceiptDataVersioned, blockGasLimitVersioned, maxExtrinsicWeightInGasVersioned, balanceVersioned, gasPriceVersioned, nonceVersioned, callVersioned, instantiateVersioned, ethTransactVersioned, ethEstimateGasVersioned, ethPreDispatchWeightVersioned, uploadCodeVersioned, getStorageVersioned, runtimePalletsAddressVersioned, codeVersioned, accountIdVersioned, newBalanceWithDustVersioned, blockAuthorVersioned, addressVersioned, traceBlockVersioned, traceTxVersioned, traceCallVersioned
- runtimeViewFunction: executeViewFunction
- sessionKeys: generateSessionKeys, decodeSessionKeys
- stakingApi: nominationsQuota, erasStakersPageCount, pendingRewards
- taggedTransactionQueue: validateTransaction
- transactionPaymentApi: queryInfo, queryFeeDetails, queryWeightToFee, queryLengthToFee
- transactionPaymentCallApi: queryCallInfo, queryCallFeeDetails, queryWeightToFee, queryLengthToFee
- transactionStorageApi: retentionPeriod, indexedTransactions

## Latest finalized block #71088 (0xf22ab9ed060d34f6b30ca658e9ec9bd543277df63aec030391c1a3289e0c6e9f)
- Extrinsics: 1 | Events: 1
- system.ExtrinsicSuccess {"dispatchInfo":{"weight":{"refTime":"261,973,000","proofSize":"1,493"},"class":"Mandatory","paysFee":"Yes"}}