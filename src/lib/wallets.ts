// Custodial EVM wallets for credit deposits + (optional) custodial staking.
//
// Direct port of the Solana custodial-wallet pattern: each user gets a per-user
// wallet whose private key the server holds, encrypted with AES-256-GCM under
// DEPOSIT_WALLET_KEY (format ivHex:tagHex:cipherHex). The only change vs Solana
// is the key type — a 32-byte secp256k1 private key instead of an ed25519
// Keypair. Funds (USDC) sit in the user's deposit wallet until the keeper sweeps
// them to the treasury; no ATAs to derive, balances are plain erc20.balanceOf.

import crypto from 'node:crypto';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import type { Address } from 'viem';

function encKey(): Buffer {
  const k = process.env.DEPOSIT_WALLET_KEY;
  if (!k) throw new Error('[wallets] DEPOSIT_WALLET_KEY not set');
  return Buffer.from(k, 'hex'); // 32-byte hex = AES-256 key
}

export function encryptSecret(privateKey: `0x${string}`): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
  const data = Buffer.concat([cipher.update(Buffer.from(privateKey.slice(2), 'hex')), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${data.toString('hex')}`;
}

export function decryptSecret(encrypted: string): `0x${string}` {
  const [ivHex, tagHex, dataHex] = encrypted.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return `0x${dec.toString('hex')}` as `0x${string}`;
}

export interface CustodialWallet {
  address: Address;
  encryptedSecret: string;
}

/** Mint a fresh custodial wallet (caller persists encryptedSecret + address). */
export function createCustodialWallet(): CustodialWallet {
  const pk = generatePrivateKey();
  const account = privateKeyToAccount(pk);
  return { address: account.address, encryptedSecret: encryptSecret(pk) };
}

/** Recover the signer for a stored custodial wallet (server-side only). */
export function accountFromEncrypted(encrypted: string) {
  return privateKeyToAccount(decryptSecret(encrypted));
}
