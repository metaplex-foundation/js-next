import { ConfirmOptions, PublicKey } from '@solana/web3.js';
import type { Metaplex } from '@/Metaplex';
import { TransactionBuilder } from '@/utils';
import {
  now,
  Operation,
  OperationHandler,
  Signer,
  toPublicKey,
  useOperation,
} from '@/types';
import { SendAndConfirmTransactionResponse } from '../../rpcModule';
import {
  AuctionHouse,
  Bid,
  LazyPurchase,
  Listing,
  Purchase,
} from '../models';
import { createBidBuilder } from './createBid';
import { executeSaleBuilder, ExecuteSaleBuilderContext } from './executeSale';
import { AuctioneerAuthorityRequiredError } from '../errors';

// -----------------
// Operation
// -----------------

const Key = 'DirectBuyOperation' as const;

/**
 * Creates a bid on a given asset and then executes a sale on the created bid and listing.
 *
 * ```ts
 * await metaplex
 *   .auctionHouse()
 *   .buy({ auctionHouse, listing, buyer })
 *   .run();
 * ```
 *
 * @group Operations
 * @category Constructors
 */
export const directBuyOperation = useOperation<DirectBuyOperation>(Key);

/**
 * @group Operations
 * @category Types
 */
export type DirectBuyOperation = Operation<
  typeof Key,
  DirectBuyInput,
  DirectBuyOutput
>;

/**
 * @group Operations
 * @category Inputs
 */
export type DirectBuyInput = {
  /** The Auction House in which to create a Bid and execute a Sale. */
  auctionHouse: AuctionHouse;

  /**
   * The Auction House authority.
   * If this is Signer the transaction fee
   * will be paid from the Auction House Fee Account
   *
   * @defaultValue `auctionHouse.authority`
   */
  authority?: PublicKey | Signer;

  /**
   * Creator of a bid.
   * Should not be the same as seller who creates a Listing
   *
   * @defaultValue `metaplex.identity()`
   */
  buyer?: Signer;

  /**
   * The Listing that is used in the sale.
   * We only need a subset of the `Listing` model but we
   * need enough information regarding its settings to know how
   * to execute the sale.
   *
   * This includes, its asset, auction house address, seller, receipt address etc.
   */
  listing: Pick<
    Listing,
    | 'asset'
    | 'auctionHouse'
    | 'canceledAt'
    | 'price'
    | 'sellerAddress'
    | 'tokens'
    | 'tradeStateAddress'
    | 'receiptAddress'
  >;

  /**
   * The Auctioneer authority key.
   * It is required when Auction House has Auctioneer enabled.
   *
   * @defaultValue No default value.
   */
  auctioneerAuthority?: Signer;

  /**
   * The address of the bookkeeper wallet responsible for the receipt.
   *
   * @defaultValue `metaplex.identity()`
   */
  bookkeeper?: Signer;

  /**
   * Prints the purchase receipt.
   * The receipt holds information about the purchase,
   * So it's important to print it if you want to use the `Purchase` model
   *
   * @defaultValue `true`
   */
  printReceipt?: boolean;

  /** A set of options to configure how the transaction is sent and confirmed. */
  confirmOptions?: ConfirmOptions;
};

/**
 * @group Operations
 * @category Outputs
 */
export type DirectBuyOutput = {
  /** A model that keeps information about the Bid. */
  bid: Bid;

  /** A model that keeps information about the Purchase. */
  purchase: Purchase;

  /** The blockchain response from sending and confirming the transaction. */
  response: SendAndConfirmTransactionResponse;
};

/**
 * @group Operations
 * @category Handlers
 */
export const directBuyOperationHandler: OperationHandler<DirectBuyOperation> = {
  handle: async (operation: DirectBuyOperation, metaplex: Metaplex) => {
    const { bid, response, lazyPurchase } = await (
      await directBuyBuilder(metaplex, operation.input)
    ).sendAndConfirm(metaplex, operation.input.confirmOptions);

    const purchase = await metaplex
      .auctionHouse()
      .loadPurchase({ lazyPurchase })
      .run();

    return { bid, purchase, response };
  },
};

// -----------------
// Builder
// -----------------

/**
 * @group Transaction Builders
 * @category Inputs
 */
export type DirectBuyBuilderParams = Omit<DirectBuyInput, 'confirmOptions'>;

/**
 * @group Transaction Builders
 * @category Contexts
 */
export type DirectBuyBuilderContext = Omit<
  DirectBuyOutput,
  'response' | 'purchase'
> & { lazyPurchase: LazyPurchase };

/**
 * Creates a bid on a given asset and executes a sale on the created bid and given listing.
 *
 * ```ts
 * const transactionBuilder = metaplex
 *   .auctionHouse()
 *   .builders()
 *   .buy({ auctionHouse, listing, buyer })
 * ```
 *
 * @group Transaction Builders
 * @category Constructors
 */
export const directBuyBuilder = async (
  metaplex: Metaplex,
  params: DirectBuyBuilderParams
): Promise<TransactionBuilder<DirectBuyBuilderContext>> => {
  // Data.
  const {
    auctionHouse,
    auctioneerAuthority,
    listing,
    buyer = metaplex.identity(),
    authority = auctionHouse.authorityAddress,
    bookkeeper = metaplex.identity(),
    ...rest
  } = params;
  const { hasAuctioneer } = auctionHouse;
  const { tokens, price, asset, sellerAddress } = listing;
  const printReceipt =
    (params.printReceipt ?? true) && Boolean(listing.receiptAddress);

  if (hasAuctioneer && !auctioneerAuthority) {
    throw new AuctioneerAuthorityRequiredError();
  }

  const bidBuilder = await createBidBuilder(metaplex, {
    auctionHouse,
    auctioneerAuthority,
    authority,
    tokens,
    price,
    mintAccount: asset.mint.address,
    seller: sellerAddress,
    buyer,
    printReceipt,
    bookkeeper,
    ...rest,
  });
  const { receipt, buyerTradeState } = bidBuilder.getContext();

  const bid: Bid = {
    model: 'bid',
    lazy: false,
    auctionHouse,
    asset,
    tradeStateAddress: buyerTradeState,
    bookkeeperAddress: bookkeeper.publicKey,
    buyerAddress: buyer.publicKey,
    receiptAddress: receipt,
    purchaseReceiptAddress: null,
    price,
    tokens,
    isPublic: false,
    canceledAt: null,
    createdAt: now(),
  };

  const saleBuilder: TransactionBuilder<ExecuteSaleBuilderContext> =
    await executeSaleBuilder(metaplex, {
      auctionHouse,
      auctioneerAuthority,
      bid,
      listing,
      printReceipt,
      bookkeeper,
      ...rest,
    });

  const { receipt: receiptAddress } = saleBuilder.getContext();

  const lazyPurchase: LazyPurchase = {
    auctionHouse,
    model: 'purchase',
    lazy: true,
    buyerAddress: toPublicKey(buyer),
    sellerAddress,
    metadataAddress: asset.metadataAddress,
    bookkeeperAddress: toPublicKey(bookkeeper),
    receiptAddress,
    price: listing.price,
    tokens: tokens.basisPoints,
    createdAt: now(),
  };

  return TransactionBuilder.make<DirectBuyBuilderContext>()
    .setContext({
      bid,
      lazyPurchase,
    })
    .add(bidBuilder)
    .add(saleBuilder);
};
