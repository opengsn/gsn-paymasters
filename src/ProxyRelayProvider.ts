import GsnTransactionDetails from '@opengsn/gsn/dist/src/common/types/GsnTransactionDetails'
import { RelayClient } from '@opengsn/gsn/dist/src/relayclient/RelayClient'
import { JsonRpcCallback, RelayProvider } from '@opengsn/gsn/dist/src/relayclient/RelayProvider'
import { Address } from '@opengsn/gsn/dist/src/common/types/Aliases'

import { JsonRpcPayload } from 'web3-core-helpers'
import Contract from 'web3-eth-contract'

import ProxyIdentityArtifact from './compiled/ProxyIdentity.json'
import ProxyFactoryArtifact from './compiled/ProxyFactory.json'
import { GSNUnresolvedConstructorInput } from '@opengsn/gsn'

export default class ProxyRelayProvider extends RelayProvider {
  private readonly proxyFactoryAddress: Address

  constructor (
    proxyFactoryAddress: Address,
    relayClient: RelayClient) {
    super(
      relayClient)
    this.proxyFactoryAddress = proxyFactoryAddress
  }

  static newProvider (
    input: GSNUnresolvedConstructorInput
  ): RelayProvider {
    throw new Error('Use newProxyRelayProvider() instead')
  }

  static newProxyRelayProvider (
    proxyFactoryAddress: Address,
    input: GSNUnresolvedConstructorInput
  ): ProxyRelayProvider {
    return new ProxyRelayProvider(proxyFactoryAddress, new RelayClient(input))
  }

  _ethSendTransaction (payload: JsonRpcPayload, callback: JsonRpcCallback): void {
    const gsnTransactionDetails: GsnTransactionDetails = payload.params[0]
    this.calculateProxyAddress(gsnTransactionDetails.from).then(proxyAddress => {
      // @ts-expect-error
      const proxy = new Contract(ProxyIdentityArtifact.abi, proxyAddress)
      const value = gsnTransactionDetails.value ?? '0'
      payload.params[0].data = proxy.methods.execute(0, gsnTransactionDetails.to, value, gsnTransactionDetails.data).encodeABI()
      payload.params[0].to = proxyAddress
      super._ethSendTransaction(payload, callback)
    })
      .catch(reason => {
        console.log('Failed to calculate proxy address', reason)
      })
  }

  async calculateProxyAddress (owner: Address): Promise<Address> {
    // @ts-expect-error
    const proxyFactory = new Contract(ProxyFactoryArtifact.abi, this.proxyFactoryAddress)
    proxyFactory.setProvider(this.origProvider)
    // eslint-disable-next-line @typescript-eslint/return-await
    return await proxyFactory.methods.calculateAddress(owner).call()
  }
}
