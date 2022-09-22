import type { Metaplex } from '@/Metaplex';
import {
  deserialize,
  deserializeFeatureFlags,
  PublicKey,
  serialize,
  Signer,
} from '@/types';
import { assert, Option, padEmptyChars, removeEmptyChars } from '@/utils';
import * as beet from '@metaplex-foundation/beet';
import { AccountMeta } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { CANDY_GUARD_LABEL_SIZE } from './constants';
import { UnregisteredCandyGuardError } from './errors';
import {
  CandyGuardManifest,
  CandyGuardsMintSettings,
  CandyGuardsSettings,
  DefaultCandyGuardSettings,
} from './guards';
import { CandyGuardProgram } from './programs';

/**
 * TODO
 *
 * @see {@link CandyGuardClient}
 * @group Module
 */
export class CandyMachineGuardsClient {
  readonly guards: CandyGuardManifest<any, any>[] = [];

  constructor(protected readonly metaplex: Metaplex) {}

  /** TODO */
  register(...guard: CandyGuardManifest<any, any>[]) {
    this.guards.push(...guard);
  }

  /** TODO */
  get(name: string): CandyGuardManifest<any, any> {
    const guard = this.guards.find((guard) => guard.name === name);

    if (!guard) {
      throw new UnregisteredCandyGuardError(name);
    }

    return guard;
  }

  /** TODO */
  all(): CandyGuardManifest<any, any>[] {
    return this.guards;
  }

  /** TODO */
  forProgram(
    program: string | PublicKey | CandyGuardProgram = 'CandyGuardProgram'
  ): CandyGuardManifest<any, any>[] {
    const candyGuardProgram =
      typeof program === 'object' && 'availableGuards' in program
        ? program
        : this.metaplex.programs().get<CandyGuardProgram>(program);

    return candyGuardProgram.availableGuards.map((name) => this.get(name));
  }

  /** TODO */
  serializeSettings<T extends CandyGuardsSettings = DefaultCandyGuardSettings>(
    guards: Partial<T>,
    groups: { label: string; guards: Partial<T> }[] = [],
    program: string | PublicKey | CandyGuardProgram = 'CandyGuardProgram'
  ): Buffer {
    const availableGuards = this.forProgram(program);
    const serializeSet = (set: Partial<T>): Buffer => {
      return availableGuards.reduce((acc, guard) => {
        const value = set[guard.name] ?? null;
        const optionPrefix = Buffer.from([value ? 1 : 0]);
        const newBuffer = value
          ? serialize(value, guard.settingsSerializer)
          : Buffer.from([]);
        acc = Buffer.concat([acc, optionPrefix, newBuffer]);
        return acc;
      }, Buffer.from([]));
    };

    let buffer = serializeSet(guards);

    if (groups.length > 0) {
      const groupCountBuffer = Buffer.alloc(5);
      beet.u8.write(groupCountBuffer, 0, 1);
      beet.u32.write(groupCountBuffer, 1, groups.length);
      buffer = Buffer.concat([buffer, groupCountBuffer]);
    } else {
      buffer = Buffer.concat([buffer, Buffer.from([0])]);
    }

    groups.forEach((group) => {
      const labelBuffer = Buffer.alloc(4 + CANDY_GUARD_LABEL_SIZE);
      beet
        .fixedSizeUtf8String(CANDY_GUARD_LABEL_SIZE)
        .write(
          labelBuffer,
          0,
          padEmptyChars(group.label, CANDY_GUARD_LABEL_SIZE)
        );
      buffer = Buffer.concat([buffer, labelBuffer, serializeSet(group.guards)]);
    });

    return buffer;
  }

  /** TODO */
  deserializeSettings<
    T extends CandyGuardsSettings = DefaultCandyGuardSettings
  >(
    buffer: Buffer,
    program: string | PublicKey | CandyGuardProgram = 'CandyGuardProgram'
  ): { guards: T; groups: { label: string; guards: T }[] } {
    const availableGuards = this.forProgram(program);
    const deserializeSet = () => {
      const serializedFeatures = buffer.slice(0, 8);
      const features = deserializeFeatureFlags(serializedFeatures, 64)[0];
      buffer = buffer.slice(8);

      return availableGuards.reduce((acc, guard, index) => {
        const isEnabled = features[index] ?? false;
        acc[guard.name] = null;
        if (!isEnabled) return acc;

        const [settings] = deserialize(buffer, guard.settingsSerializer);
        buffer = buffer.slice(guard.settingsBytes);
        acc[guard.name] = settings;
        return acc;
      }, {} as CandyGuardsSettings) as T;
    };

    const guards: T = deserializeSet();
    const groups: { label: string; guards: T }[] = [];
    const groupsCount = beet.u32.read(buffer, 0);
    buffer = buffer.slice(4);

    for (let i = 0; i < groupsCount; i++) {
      const label = removeEmptyChars(
        buffer.slice(0, CANDY_GUARD_LABEL_SIZE).toString('utf8')
      );
      buffer = buffer.slice(CANDY_GUARD_LABEL_SIZE);
      groups.push({ label, guards: deserializeSet() });
    }

    return { guards, groups };
  }

  /** TODO */
  resolveGroupSettings<
    T extends CandyGuardsSettings = DefaultCandyGuardSettings
  >(
    guards: T,
    groups: { label: string; guards: T }[] = [],
    label: Option<string>
  ): T {
    if (!label) {
      // TODO(loris): proper Metaplex errors.
      assert(groups.length === 0, 'Group label is required');
      return guards;
    }

    // TODO(loris): proper Metaplex errors.
    assert(groups.length > 0, 'Group label must be null');
    const activeGroup = groups.find((group) => group.label === label);
    assert(!!activeGroup, 'Group label does not match any group');

    const activeGroupGuardsWithoutNullGuards = Object.fromEntries(
      Object.entries(activeGroup.guards).filter(([_, v]) => v != null)
    ) as Partial<T>;

    return {
      ...guards,
      ...activeGroupGuardsWithoutNullGuards,
    };
  }

  /** TODO */
  parseMintSettings<
    Settings extends CandyGuardsSettings = DefaultCandyGuardSettings,
    MintSettings extends CandyGuardsMintSettings = {}
  >(
    guardSettings: Settings,
    guardMintSettings: Partial<MintSettings>,
    program: string | PublicKey | CandyGuardProgram = 'CandyGuardProgram'
  ): {
    arguments: Buffer;
    accountMetas: AccountMeta[];
    signers: Signer[];
  } {
    const availableGuards = this.forProgram(program);
    const initialAccumulator = {
      arguments: Buffer.from([]),
      accountMetas: [] as AccountMeta[],
      signers: [] as Signer[],
    };

    return availableGuards.reduce((acc, guard) => {
      const settings = guardSettings[guard.name] ?? null;
      const mintSettings = guardMintSettings[guard.name] ?? null;
      if (!guard.mintSettingsParser || !settings) return acc;

      // TODO(loris): fail if missing settings and mint settings are not empty object.

      const parsedSettings = guard.mintSettingsParser(mintSettings, settings);
      acc.arguments = Buffer.concat([acc.arguments, parsedSettings.arguments]);

      const remainingAccounts = parsedSettings.remainingAccounts;
      const accountMetas: AccountMeta[] = remainingAccounts.map((account) => ({
        ...account,
        pubkey: account.isSigner ? account.address.publicKey : account.address,
      }));
      const signers = remainingAccounts
        .filter((account) => account.isSigner)
        .map((account) => account.address as Signer);

      acc.accountMetas.push(...accountMetas);
      acc.signers.push(...signers);
      return acc;
    }, initialAccumulator);
  }
}
