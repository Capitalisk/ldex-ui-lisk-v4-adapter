const {Mnemonic} = require('@liskhq/lisk-passphrase');
const liskCryptography = require('@liskhq/lisk-cryptography');
const liskTransactions = require('@liskhq/lisk-transactions');
const liskCodec = require('@liskhq/lisk-codec');

const crypto = require('crypto');
const axios = require('axios');
const LiskServiceRepository = require('./lisk-service/repository');

const DEFAULT_API_MAX_PAGE_SIZE = 100;
const DEFAULT_NETWORK_IDENTIFIER = '4c09e6a781fc4c7bdb936ee815de8f94190f8a7519becd9de2081832be309a99';

class LiskAdapter {
  constructor(options) {
    this.apiMaxPageSize = options.apiMaxPageSize || DEFAULT_API_MAX_PAGE_SIZE;
    this.liskServiceRepo = new LiskServiceRepository({config: options});
    this.transactionSchema = {
      '$id': 'lisk/transaction',
      type: 'object',
      required: [
        'moduleID',
        'assetID',
        'nonce',
        'fee',
        'senderPublicKey',
        'asset'
      ],
      properties: {
        moduleID: {
          dataType: 'uint32',
          fieldNumber: 1,
          minimum: 2
        },
        assetID: {
          dataType: 'uint32',
          fieldNumber: 2
        },
        nonce: {
          dataType: 'uint64',
          fieldNumber: 3
        },
        fee: {
          dataType: 'uint64',
          fieldNumber: 4
        },
        senderPublicKey: {
          dataType: 'bytes',
          fieldNumber: 5,
          minLength: 32,
          maxLength: 32
        },
        asset: {
          dataType: 'bytes',
          fieldNumber: 6
        },
        signatures: {
          type: 'array',
          items: {
            dataType: 'bytes'
          },
          fieldNumber: 7
        }
      }
    };
    this.transferAssetSchema = {
      '$id': 'lisk/transfer-asset',
      title: 'Transfer transaction asset',
      type: 'object',
      required: ['amount', 'recipientAddress', 'data'],
      properties: {
        amount: {dataType: 'uint64', fieldNumber: 1},
        recipientAddress: {dataType: 'bytes', fieldNumber: 2, minLength: 20, maxLength: 20},
        data: {dataType: 'string', fieldNumber: 3, minLength: 0, maxLength: 64}
      }
    };
    this.networkId = Buffer.from(options.networkIdentifier || DEFAULT_NETWORK_IDENTIFIER, 'hex');
  }

  async connect({passphrase}) {
    this.passphrase = passphrase;
    let {address, publicKey} = liskCryptography.getAddressAndPublicKeyFromPassphrase(passphrase);
    this.address = liskCryptography.getBase32AddressFromAddress(address);
    this.publicKey = publicKey;
    await this.updateNonce();
  }

  async disconnect() {}

  async updateNonce() {
    try {
      let account = await this.liskServiceRepo.getAccountByAddress(this.address);
      let accountNonce = BigInt(account.sequence.nonce);
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

    let transactionData = {
      moduleID: 2,
      assetID: 0,
      fee: BigInt(fee),
      asset: {
        amount: BigInt(amount),
        recipientAddress: liskCryptography.getAddressFromBase32Address(recipientAddress),
        data: message
      },
      nonce: this.nonce++,
      senderPublicKey: this.publicKey,
      signatures: []
    };

    let transfer = liskTransactions.signTransaction(
      this.transferAssetSchema,
      transactionData,
      this.networkId,
      this.passphrase
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
    return liskCryptography.getBase32AddressFromAddress(
      liskCryptography.getAddressAndPublicKeyFromPassphrase(passphrase).address
    );
  }

  async postTransaction({transaction}) {
    try {
      const encodedAsset = liskCodec.codec.encode(this.transferAssetSchema, transaction.asset);
      const encodedTransaction = liskCodec.codec.encode(this.transactionSchema, {
        ...transaction,
        asset: encodedAsset
      });

      let response = await this.liskServiceRepo.postTransaction({
        transaction: encodedTransaction.toString('hex')
      });
      if (!response || !response.transactionId) {
        throw new Error('Invalid transaction response');
      }
    } catch (err) {
      throw new Error(`Error broadcasting transaction to the lisk network - Failed with error ${err.message}`);
    }
  }

  async getLatestOutboundTransactions({address, limit}) {
    try {
      const transactions = await this.liskServiceRepo.getOutboundTransactions(address, limit || this.apiMaxPageSize);
      for (let txn of transactions) {
        txn.message = (txn.asset && txn.asset.data) || '';
      }
      return transactions;
    } catch (err) {
      throw new Error(`Failed to get transactions for address ${address} - ${err.message}`);
    }
  }

  async getAccountBalance({address}) {
    try {
      const account = await this.liskServiceRepo.getAccountByAddress(address);
      if (!account) {
        throw `Account not found with address - ${address}`;
      }
      return account.summary.balance;
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
    const account = await this.liskServiceRepo.getAccountByAddress(address);
    if (!account) {
      throw `Account not found with address - ${address}`;
    }
    return account.sequence.nonce;
  }
}

module.exports = LiskAdapter;
