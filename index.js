const {Mnemonic} = require('@liskhq/lisk-passphrase');
// const liskTransactions = require('@liskhq/lisk-transactions');
const {
  cryptography: liskCryptography,
} = require('@liskhq/lisk-client');

const crypto = require('crypto');
const axios = require('axios');
const LiskServiceRepository = require('./lisk-service/repository');
const LiskWSClient = require('lisk-v3-ws-client-manager');

const DEFAULT_API_MAX_PAGE_SIZE = 100;

class LiskAdapter {
  constructor(options) {
    this.serviceURL = options.serviceURL;
    this.rpcURL = options.rpcURL;
    this.apiMaxPageSize = options.apiMaxPageSize || DEFAULT_API_MAX_PAGE_SIZE;
    this.liskServiceRepo = new LiskServiceRepository({config: options});
    this.wsClient = null;
    this.wsClientManager = new LiskWSClient({config: options, logger: console});
  }

  async connect({passphrase}) {
    this.wsClient = await this.wsClientManager.createWsClient(true);
    this.passphrase = passphrase;
    let {address} = liskCryptography.getAddressAndPublicKeyFromPassphrase(passphrase);
    this.address = liskCryptography.getBase32AddressFromAddress(address);
    let account = await this.wsClient.account.get(address);
    this.nonce = account.sequence.nonce;
  }

  async disconnect() {
    await this.wsClientManager.close();
  }

  async createTransfer({amount, fee, recipientAddress, message}) {
    let transfer = await this.wsClient.transaction.create({
      moduleID: 2,
      assetID: 0,
      fee: BigInt(fee),
      asset: {
        amount: BigInt(amount),
        recipientAddress: liskCryptography.getAddressFromBase32Address(recipientAddress),
        data: message
      },
      nonce: this.nonce++
    }, this.passphrase);

    transfer.id = crypto.createHash('sha256')
      .update(`${this.address}-${transfer.nonce}`)
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
      let response = await this.wsClient.transaction.send(transaction);
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
    return Number(account.sequence.nonce);
  }
}

module.exports = LiskAdapter;
