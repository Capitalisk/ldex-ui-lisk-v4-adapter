const {Mnemonic} = require('@liskhq/lisk-passphrase');
const liskCryptography = require('@liskhq/lisk-cryptography');
const liskTransactions = require('@liskhq/lisk-transactions');
const liskCodec = require('@liskhq/lisk-codec');

const crypto = require('crypto');
const axios = require('axios');
const LiskServiceRepository = require('./lisk-service/repository');

const DEFAULT_API_MAX_PAGE_SIZE = 100;
const DEFAULT_CHAIN_ID = '00000000';
const DEFAULT_TOKEN_ID = '0000000000000000';

class LiskAdapter {
  constructor(options) {
    this.apiMaxPageSize = options.apiMaxPageSize || DEFAULT_API_MAX_PAGE_SIZE;
    this.liskServiceRepo = new LiskServiceRepository({config: options});
    this.transactionSchema = {
      $id: '/lisk/transferParams',
      title: 'Transfer transaction params',
      type: 'object',
      required: ['tokenID', 'amount', 'recipientAddress', 'data'],
      properties: {
        tokenID: {
          dataType: 'bytes',
          fieldNumber: 1,
          minLength: 8,
          maxLength: 8,
        },
        amount: {
          dataType: 'uint64',
          fieldNumber: 2,
        },
        recipientAddress: {
          dataType: 'bytes',
          fieldNumber: 3,
          format: 'lisk32',
        },
        data: {
          dataType: 'string',
          fieldNumber: 4,
          minLength: 0,
          maxLength: 64,
        },
      },
    };
    this.tokenId = Buffer.from(options.tokenId || DEFAULT_TOKEN_ID, 'hex');
    this.chainId = Buffer.from(options.chainId || DEFAULT_CHAIN_ID, 'hex');
  }

  async connect({passphrase}) {
    this.passphrase = passphrase;
    let {publicKey} = liskCryptography.legacy.getPrivateAndPublicKeyFromPassphrase(passphrase);
    this.address = liskCryptography.address.getLisk32AddressFromPublicKey(publicKey);
    this.publicKey = publicKey;
    await this.updateNonce();
  }

  async disconnect() {}

  async updateNonce() {
    try {
      let auth = await this.liskServiceRepo.getAuthByAddress(this.address);
      let accountNonce = BigInt(auth.nonce);
      if (this.nonce == null || accountNonce > this.nonce) {
        this.nonce = accountNonce;
      }
    } catch (error) {
      if (error.response && error.response.status === 404) {
        this.nonce = 0n;
      } else {
        throw error;
      }
    }
  }

  async createTransfer({amount, fee, recipientAddress, message}) {
    await this.updateNonce();

    const transactionData = {
      module: 'token',
      command: 'transfer',
      nonce: this.nonce,
      fee: BigInt(fee),
      senderPublicKey: this.publicKey,// TODO 0000 should this be string or buffer format????
      signatures: [],
      params: {
        tokenID: this.tokenId,
        recipientAddress: liskCryptography.address.getAddressFromLisk32Address(recipientAddress),
        amount: BigInt(amount),
        data: message
      }
    };

    let {privateKey} = liskCryptography.legacy.getPrivateAndPublicKeyFromPassphrase(this.passphrase);
    // let {publicKey: signerPublicKey, privateKey} = liskCryptography.legacy.getPrivateAndPublicKeyFromPassphrase(this.passphrase);// TODO 000

    let transfer = liskTransactions.signTransaction(
      transactionData,
      this.chainId,
      privateKey,
      this.transactionSchema
    );

    transfer.id = crypto.createHash('sha256')
      .update(`${this.address}-${transfer.nonce.toString()}`)
      .digest('hex')
      .slice(0, 44);

    return transfer;
  }

  createWallet() {
    let passphrase = Mnemonic.generateMnemonic();
    let address = this.getAddressFromPassphrase({passphrase});
    return {
      address,
      passphrase,
    };
  }

  validatePassphrase({passphrase}) {
    return Mnemonic.validateMnemonic(passphrase, Mnemonic.wordlists.english);
  }

  getAddressFromPassphrase({passphrase}) {
    let {publicKey} = liskCryptography.legacy.getPrivateAndPublicKeyFromPassphrase(passphrase);
    return liskCryptography.address.getLisk32AddressFromPublicKey(publicKey);
  }

  async postTransaction({transaction}) {
    try {
      let binaryTxn = liskTransactions.getBytes(transaction, this.transactionSchema);
      let payloadTxn = binaryTxn.toString('hex');

      let response = await this.liskServiceRepo.postTransaction(payloadTxn);
      if (!response || !response.transactionID) {
        throw new Error('Invalid transaction response');
      }
    } catch (err) {
      throw new Error(`Error broadcasting transaction to the lisk network - Failed with error ${err.message}`);
    }
  }

  async getLatestOutboundTransactions({address, limit}) {
    try {
      return await this.liskServiceRepo.getOutboundTransactions(address, limit || this.apiMaxPageSize);
    } catch (err) {
      throw new Error(`Failed to get transactions for address ${address} - ${err.message}`);
    }
  }

  async getAccountBalance({address}) {
    try {
      const balance = await this.liskServiceRepo.getBalanceByAddress(address);
      if (balance == null) {
        throw `Account balance not found with address - ${address}`;
      }
      return balance;
    } catch (err) {
      throw new Error(
        `Failed to fetch account balance for wallet address ${
          address
        } - Could not find any balance records for that account - ${
          err.message
        }`,
      );
    }
  }

  async getAccountNextKeyIndex({address}) {
    const auth = await this.liskServiceRepo.getAuthByAddress(address);
    if (!auth) {
      throw `Account not found with address - ${address}`;
    }
    return auth.nonce;
  }
}

module.exports = LiskAdapter;
