const {Mnemonic} = require('@liskhq/lisk-passphrase');
// const liskTransactions = require('@liskhq/lisk-transactions');
const {
  cryptography: liskCryptography,
} = require('@liskhq/lisk-client');

const axios = require('axios');
const LiskServiceRepository = require('./lisk-service/repository');
const LiskWSClient = require('lisk-v3-ws-client-manager');

const DEFAULT_API_MAX_PAGE_SIZE = 100;

class LiskAdapter {
    constructor(options) {
        this.apiURL = options.apiURL;
        this.apiMaxPageSize = options.apiMaxPageSize || DEFAULT_API_MAX_PAGE_SIZE;
        this.liskServiceRepo = new LiskServiceRepository({config: options});
        this.liskWsClient = new LiskWSClient({config: options, logger: console});
    }

    async connect({passphrase}) {
        this.passphrase = passphrase;
        // TODO 22 load account nonce
    }

    async disconnect() {
    }

    createTransfer({amount, recipientAddress, message}) {
        // return liskTransactions.transfer({
        //     amount,
        //     recipientId: recipientAddress,
        //     data: message,
        //     passphrase: this.passphrase,
        // });
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
        const wsClient = await this.liskWsClient.createWsClient();
        let signedTxn = {
            moduleID: transaction.moduleID,
            assetID: transaction.assetID,
            fee: BigInt(transaction.fee),
            asset: {
                amount: BigInt(transaction.amount),
                recipientAddress: Buffer.from(transaction.recipientAddress, 'hex'),
                data: transaction.message,
            },
            nonce: BigInt(transaction.nonce),
            senderPublicKey: Buffer.from(transaction.senderPublicKey, 'hex'),
            signatures: transaction.signatures.map((signaturePacket) => {
                return Buffer.from(signaturePacket.signature, 'hex');
            }),
            id: Buffer.from(transaction.id, 'hex'),
        };

        try {
            let response = await wsClient.transaction.send(signedTxn);
            if (!response || !response.transactionId) {
                throw new Error('Invalid transaction response');
            }
        } catch (err) {
            throw new Error(`Error broadcasting transaction to the lisk network - Failed with error ${err.message}`);
        }
        await this.liskWsClient.close();
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
}

module.exports = LiskAdapter;
