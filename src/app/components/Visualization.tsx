import * as React from 'react'
import { WebView, Dimensions, View, ActivityIndicator, LayoutAnimation } from 'react-native'
import { Account, OtherAccount } from '../logic/accounts'
import { Channel } from 'go-network-framework/lib/state-channel/channel'
import { Container, Header, Body, Text, Left, Button, Title, Right, Toast, Item, Label, Input } from 'native-base'
import { Subscription, Observable } from 'rxjs'
import { BlockNumber, Wei } from 'eth-types'
import { VisEvent, OffchainEv } from '../../protocol'
import { sendMediated, sendDirect } from '../logic/offchain-actions'
import { as, BN, ChannelState } from 'go-network-framework'
import { SignedMessage, deserializeAndDecode, Ack, Lock } from 'go-network-framework/lib/state-channel/message'

const html = require('../../vis/vis.html')

type P2PMsg = ReturnType<typeof deserializeAndDecode>
type Transform = (ch: ChannelState) => (m: P2PMsg) =>
  { messageType: OffchainEv['messageType'], message: OffchainEv['message'] }

const p2pMessageToVisEv = (dir: OffchainEv['dir'], transform: ReturnType<Transform>) =>
  (m: P2PMsg): OffchainEv =>
    Object.assign({
      dir, type: 'off-msg' as 'off-msg'
    }, transform(m))

const transform: Transform = state => {
  let lastMediated = 0
  let lastTransferredAmount = state.transferredAmount.toNumber()
  return m => {
    console.log('TR', m)
    if (m instanceof SignedMessage) {
      let sentAmount: number | undefined
      let receivedAmount: number | undefined

      if (m.classType === 'DirectTransfer') {
        const a = (m as any).transferredAmount.toNumber()
        receivedAmount = (a - lastTransferredAmount)
        sentAmount = -receivedAmount
        lastTransferredAmount = a
      }

      if (m.classType === 'MediatedTransfer') {
        sentAmount = -(m as any).lock.amount.toNumber()
        lastMediated = sentAmount
        lastTransferredAmount = (m as any).transferredAmount.toNumber()
      }

      if (m.classType === 'SecretToProof') {
        receivedAmount = -lastMediated
        lastTransferredAmount = (m as any).transferredAmount.toNumber()
      }

      return {
        messageType: m.classType,
        message: '',
        sentAmount,
        receivedAmount
      }
    } else if (m instanceof Ack) { // Ack and Lock seems to be not used
      return {
        messageType: 'Ack',
        message: '[todo]'
      }
    } else if (m instanceof Lock) {
      return {
        messageType: 'Lock',
        message: '[todo]'
      }
    }
    throw new Error('UNKNOWN_CASE')
  }
}

export interface Props {
  account: Account
  other: OtherAccount
  channel: Channel
  currentBlock: BlockNumber
  onClose: () => void
}

export interface State {
  showActions?: boolean
  amount?: Wei
}

export interface State {
  width: number, height: number,
  wvLoaded: boolean // webview's api seems broken
}

export class Visualization extends React.Component<Props, State> {
  state: State = { wvLoaded: false, ...Dimensions.get('screen') }

  wv!: WebView
  sub?: Subscription

  componentDidMount () {
    const cfg = [
      ['message-received', 'right->left', this.props.channel.peerState],
      ['message-sent', 'left->right', this.props.channel.myState]
    ].filter(c => !!c[0]) as Array<[string, OffchainEv['dir'], ChannelState]>

    this.sub = Observable.from(cfg)
      .mergeMap(([evName, dir, st]) =>
        Observable.fromEvent<any>(this.props.account.p2p, evName)
          .map(deserializeAndDecode)
          .map(p2pMessageToVisEv(dir, transform(st)))
      )
      .merge(
        this.props.account.blockchain.monitoring.asStream('*')
          .filter(ev => Buffer.compare(ev._contract, this.props.channel.channelAddress) === 0)
          .map(ev => ({
            type: 'on-event',
            details: `${ev._type}`
          } as VisEvent))
      )
      .do(this.emitEvent)
      .subscribe()
  }

  componentWillUnmount () {
    this.sub && this.sub.unsubscribe()
  }

  componentWillUpdate (props: Props) {
    this.emitEvent({ type: 'block-number', block: props.currentBlock.toNumber() })
  }

  updateState = (s: Partial<State>) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    this.setState(s as any)
  }

  sendDirect = () => {
    sendDirect(this.props.account, this.props.channel.peerState.address,
      this.props.channel.myState.transferredAmount.add(this.state.amount!) as Wei)
      .then(() => this.setState({ amount: undefined }))
      .catch((e) => Toast.show({ type: 'danger', text: e.message || 'Uknown error' }))
  }

  sendMediated = () => {
    sendMediated(this.props.account, this.props.channel.peerState.address, this.state.amount!)
      .then(() => this.setState({ amount: undefined }))
      .catch((e) => Toast.show({ type: 'danger', text: e.message || 'Uknown error' }))
  }

  close = () => {
    this.props.account.engine.closeChannel(this.props.channel.channelAddress)
      .then(x => console.log('CLOSED', x))
    this.updateState({ showActions: false })
  }

  emitEvent = (e: VisEvent) => {
    if (this.wv) {
      const ev = `window._GN.emitEvent(${JSON.stringify(e)})`
      e.type !== 'block-number' && console.log('EMITTING-EVENT', ev)
      this.wv.injectJavaScript(ev)
    }
  }

  onLoad = () => {
    console.log('LOADED')
    this.setState({ wvLoaded: true })
    this.emitEvent({
      type: 'init',
      peer1: this.props.account.owner.addressStr,
      peer2: this.props.channel.peerState.address.toString('hex'),
      block: this.props.currentBlock.toNumber()
    })
  }

  showActions = () => this.props.channel.state === 'opened' && this.state.showActions

  renderActions = () => {
    if (this.showActions()) {
      return <View style={{
        flexDirection: 'row', alignSelf: 'stretch', alignItems: 'center', justifyContent: 'space-between',
        minHeight: 40, margin: 8
      }}>
        <Item floatingLabel style={{ maxWidth: '25%' }}>
          <Label>Amount</Label>
          <Input
            value={this.state.amount ? this.state.amount.toString(10) : ''}
            onChangeText={t => this.setState({ amount: parseInt(t, 10) ? as.Wei(parseInt(t, 10)) : undefined })}
            keyboardType='number-pad'
          />
        </Item>

        <View style={{ alignItems: 'center' }}>
          <Text note>Send Transfer</Text>
          <View style={{ flexDirection: 'row' }}>
            <Button disabled={!this.state.amount || this.state.amount.lte(new BN(0))} transparent onPress={this.sendDirect}>
              <Text>Direct</Text>
            </Button>
            <Button disabled={!this.state.amount || this.state.amount.lte(new BN(0))} transparent onPress={this.sendMediated}>
              <Text>Mediated</Text>
            </Button>
          </View>
        </View>

        <View style={{ alignItems: 'center' }}>
          <Text note> </Text>
          <View style={{ flexDirection: 'row' }}>
            <Button transparent danger onPress={this.close}>
              <Text>Close</Text>
            </Button>
          </View>
        </View>
      </View>
    }
  }

  render () {
    const p = this.props
    const source = html
    return <Container>
      <Header>
        <Left>
          <Button transparent onPress={p.onClose}>
            <Text>Exit Vis</Text>
          </Button>
        </Left>
        <Body>
          <Title>0x{p.account.owner.addressStr}</Title>
        </Body>
        <Right>
          <Button transparent onPress={() => this.updateState({ showActions: !this.state.showActions })}>
            <Text>{this.showActions() ? 'Hide' : 'Actions'}</Text>
          </Button>
        </Right>
      </Header>

      {this.renderActions()}

      <WebView
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onLoadEnd={this.onLoad}
        onError={err => console.log('ERR', err)}
        ref={(r) => (this as any).wv = r}
        style={{ flex: 1 }}
        source={source}
        scrollEnabled={false}
      // @ts-ignore
      // useWebKit={true}
      >
      </WebView>

      {!this.state.wvLoaded && <ActivityIndicator style={{ position: 'absolute', top: 128, alignSelf: 'center' }} />}
    </Container>
  }
}
