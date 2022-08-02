import {
  ConfirmOptions,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from '@solana/web3.js';
import type { Metaplex } from '@/Metaplex';
import { TransactionBuilder, Option, DisposableScope } from '@/utils';
import {
  BuyInstructionAccounts,
  createAuctioneerBuyInstruction,
  createAuctioneerPublicBuyInstruction,
  createBuyInstruction,
  createPrintBidReceiptInstruction,
  createPublicBuyInstruction,
} from '@metaplex-foundation/mpl-auction-house';
import {
  useOperation,
  Operation,
  OperationHandler,
  Signer,
  toPublicKey,
  token,
  lamports,
  isSigner,
  amount,
  SolAmount,
  SplTokenAmount,
  Pda,
} from '@/types';
import { SendAndConfirmTransactionResponse } from '../rpcModule';
import { findAssociatedTokenAccountPda } from '../tokenModule';
import { findMetadataPda } from '../nftModule';
import { AuctionHouse } from './AuctionHouse';
import {
  findAuctioneerPda,
  findAuctionHouseBuyerEscrowPda,
  findAuctionHouseTradeStatePda,
  findBidReceiptPda,
} from './pdas';
import { AuctioneerAuthorityRequiredError } from './errors';

// -----------------
// Operation
// -----------------

const Key = 'CreateBidOperation' as const;
export const createBidOperation = useOperation<CreateBidOperation>(Key);
export type CreateBidOperation = Operation<
  typeof Key,
  CreateBidInput,
  CreateBidOutput
>;

export type CreateBidInput = {
  auctionHouse: AuctionHouse;
  buyer?: PublicKey | Signer; // Default: identity
  authority?: PublicKey | Signer; // Default: auctionHouse.authority
  auctioneerAuthority?: Signer; // Use Auctioneer ix when provided
  mintAccount: PublicKey; // Required for checking Metadata
  seller?: Option<PublicKey>; // Default: null (i.e. public bid unless token account is provided)
  tokenAccount?: Option<PublicKey>; // Default: null (i.e. public bid unless seller is provided).
  price?: SolAmount | SplTokenAmount; // Default: 0 SOLs or tokens.
  tokens?: SplTokenAmount; // Default: token(1)
  bookkeeper?: Signer; // Default: identity
  printReceipt?: boolean; // Default: true

  // Options.
  confirmOptions?: ConfirmOptions;
};

export type CreateBidOutput = {
  response: SendAndConfirmTransactionResponse;
  buyerTradeState: Pda;
  tokenAccount: Option<PublicKey>;
  metadata: Pda;
  buyer: PublicKey;
  receipt: Option<Pda>;
  bookkeeper: Option<PublicKey>;
  price: SolAmount | SplTokenAmount;
  tokens: SplTokenAmount;
};

// -----------------
// Handler
// -----------------

export const createBidOperationHandler: OperationHandler<CreateBidOperation> = {
  handle: async (
    operation: CreateBidOperation,
    metaplex: Metaplex,
    scope: DisposableScope
  ) => {
    const builder = await createBidBuilder(metaplex, operation.input);
    scope.throwIfCanceled();
    return builder.sendAndConfirm(metaplex, operation.input.confirmOptions);
  },
};

// -----------------
// Builder
// -----------------

export type CreateBidBuilderParams = Omit<CreateBidInput, 'confirmOptions'> & {
  instructionKey?: string;
};

export type CreateBidBuilderContext = Omit<CreateBidOutput, 'response'>;

export const createBidBuilder = async (
  metaplex: Metaplex,
  params: CreateBidBuilderParams
): Promise<TransactionBuilder<CreateBidBuilderContext>> => {
  // Data.
  const auctionHouse = params.auctionHouse;
  const tokens = params.tokens ?? token(1);
  const priceBasisPoint = params.price?.basisPoints ?? 0;
  const price = auctionHouse.isNative
    ? lamports(priceBasisPoint)
    : amount(priceBasisPoint, auctionHouse.treasuryMint.currency);

  if (auctionHouse.hasAuctioneer && !params.auctioneerAuthority) {
    throw new AuctioneerAuthorityRequiredError();
  }

  // Accounts.
  const buyer = params.buyer ?? (metaplex.identity() as Signer);
  const authority = params.authority ?? auctionHouse.authorityAddress;
  const metadata = findMetadataPda(params.mintAccount);
  const escrowPayment = findAuctionHouseBuyerEscrowPda(
    auctionHouse.address,
    toPublicKey(buyer)
  );
  const tokenAccount =
    params.tokenAccount ??
    (params.seller
      ? findAssociatedTokenAccountPda(params.mintAccount, params.seller)
      : null);
  const buyerTokenAccount = findAssociatedTokenAccountPda(
    params.mintAccount,
    toPublicKey(buyer)
  );

  const buyerTradeState = findAuctionHouseTradeStatePda(
    auctionHouse.address,
    toPublicKey(buyer),
    auctionHouse.treasuryMint.address,
    params.mintAccount,
    price.basisPoints,
    tokens.basisPoints,
    tokenAccount
  );

  const accounts: Omit<BuyInstructionAccounts, 'tokenAccount'> = {
    wallet: toPublicKey(buyer),
    paymentAccount: toPublicKey(buyer),
    transferAuthority: toPublicKey(buyer),
    treasuryMint: auctionHouse.treasuryMint.address,
    metadata,
    escrowPaymentAccount: escrowPayment,
    authority: toPublicKey(authority),
    auctionHouse: auctionHouse.address,
    auctionHouseFeeAccount: auctionHouse.feeAccountAddress,
    buyerTradeState,
  };

  // Args.
  const args = {
    tradeStateBump: buyerTradeState.bump,
    escrowPaymentBump: escrowPayment.bump,
    buyerPrice: price.basisPoints,
    tokenSize: tokens.basisPoints,
  };

  // Sell Instruction.
  let buyInstruction;
  if (params.auctioneerAuthority) {
    const ahAuctioneerPda = findAuctioneerPda(
      auctionHouse.address,
      params.auctioneerAuthority.publicKey
    );

    const accountsWithAuctioneer = {
      ...accounts,
      auctioneerAuthority: params.auctioneerAuthority.publicKey,
      ahAuctioneerPda,
    };

    buyInstruction = tokenAccount
      ? createAuctioneerBuyInstruction(
          { ...accountsWithAuctioneer, tokenAccount },
          args
        )
      : createAuctioneerPublicBuyInstruction(
          {
            ...accountsWithAuctioneer,
            tokenAccount: buyerTokenAccount,
          },
          args
        );
  } else {
    buyInstruction = tokenAccount
      ? createBuyInstruction({ ...accounts, tokenAccount }, args)
      : createPublicBuyInstruction(
          { ...accounts, tokenAccount: buyerTokenAccount },
          args
        );
  }

  // Signers.
  const buySigners = [buyer, authority, params.auctioneerAuthority].filter(
    (input): input is Signer => !!input && isSigner(input)
  );

  // Receipt.
  // Since createPrintBidReceiptInstruction can't deserialize createAuctioneerBuyInstruction due to a bug
  // Don't print Auctioneer Bid receipt for the time being.
  const shouldPrintReceipt =
    (params.printReceipt ?? true) && !params.auctioneerAuthority;
  const bookkeeper = shouldPrintReceipt
    ? params.bookkeeper ?? metaplex.identity()
    : null;
  const receipt = shouldPrintReceipt
    ? findBidReceiptPda(buyerTradeState)
    : null;

  const builder = TransactionBuilder.make<CreateBidBuilderContext>().setContext(
    {
      buyerTradeState,
      tokenAccount,
      metadata,
      buyer: toPublicKey(buyer),
      receipt,
      bookkeeper: bookkeeper ? bookkeeper.publicKey : null,
      price,
      tokens,
    }
  );

  // Create a TA for public bid if it doesn't exist
  if (!tokenAccount) {
    const account = await metaplex.rpc().getAccount(buyerTokenAccount);
    if (!account.exists) {
      builder.add(
        await metaplex
          .tokens()
          .builders()
          .createToken({
            mint: params.mintAccount,
            owner: toPublicKey(buyer),
          })
      );
    }
  }

  return (
    builder
      // Create bid.
      .add({
        instruction: buyInstruction,
        signers: buySigners,
        key: 'buy',
      })

      // Print the Bid Receipt.
      .when(shouldPrintReceipt, (builder) =>
        builder.add({
          instruction: createPrintBidReceiptInstruction(
            {
              receipt: receipt as Pda,
              bookkeeper: (bookkeeper as Signer).publicKey,
              instruction: SYSVAR_INSTRUCTIONS_PUBKEY,
            },
            { receiptBump: (receipt as Pda).bump }
          ),
          signers: [bookkeeper as Signer],
          key: 'printBidReceipt',
        })
      )
  );
};
