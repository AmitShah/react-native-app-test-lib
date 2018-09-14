import * as path from 'path'
import { localIP } from './utils'

export const tempDir = path.resolve(__dirname, '../../temp')
export const snapDir = path.resolve(tempDir, 'db-snap')
export const sessionsDir = path.resolve(tempDir, 'db-sessions')
export const contractsPath = path.resolve(snapDir, 'contracts.json')

const [hostnameArg, portArg] = process.argv.slice(2)

export const hostname = hostnameArg || localIP()
if (!hostname) {
  console.log('hostname required and cannot be automatically detected')
  process.exit(1)
}
export let port = 5215
try {
  port = parseInt(portArg, 10) || port
} catch (err) {
  console.log('parsing port failed')
  process.exit(1)
}

const maxBalance = '0xFFF FFF FFF FFF FFF FFF FFF FFF FFF FFF'.replace(/ /g, '')
const defaultBalance = '0x21E19E0C9BAB2400000' // 10k
export const accounts = [
  ['6c7cfe3c8c47dc2ea38e2634f8a99ecea87b9609e888be36a2d7ee076d28bdce', '7582C707b9990a5BB3Ca23f8F7b61B6209829A6e', maxBalance],
  ['d365947df31e3f828e7572bcdbd50554a9043c30b785a0f8e5811c6bf93f628c', 'cF0eD51326d08281D46F1c3475c8d720Cc2680d2'],
  ['040481011dd99af2f3701140553a75e7a6cd8434bd72051820e26f82a6b024e0', 'bFe89818E5b1Bf5825DcC298bB0A4a6f36a1Ef33'],
  ['3c9936263fbf3d89372f68ebcaa557c702bb137626fcccb97789afa36c29214b', '9C0Af42e2660BE9C780f4459834Cc106AE1776f2'],
  ['8308092a3abf1c1f0f74d0715b8480a5e9ceaa7fe3101c7cce5ba573d6dfc09d', 'dfe049BFA432E81356bCBACF9a4378a11A89A816'],
  ['c9fc0b7719a5f8f6b22acf63d456be44f9d6bb90f4afc9b9564b8b1306818f3d', '440D95ed57Bb9d3d71d3507dC1b1416815592899'],
  ['ac976329d06a1dd7cb3e772cde6b1b1a3842199e8da769edbb9ecdf1dd28fbac', '3357b83AC08c5979FDFb47c6683a319816b374e1'],
  ['40639137c3ea3da8a065964471a15f3fca24477750260928e59504a895616af2', '4683C04E7fd42ef7E97A7DeF58aBb4C07554E69e'],
  ['b04c71c7d28da9d1a0b065f32f7b8902a5c3586a2ea60d7972702ca38e5f6a9e', 'A7318f875eFF13081bD3F74917B222221CcE95D9'],
  ['a780a0e0febf4273a471076f4c7f514ea90124df136f389c8ec4ee3caa4403a3', '342fd232CD12E95572cf36e99D533A4c6c25942d']
].map(([pk, address, balance]) => ({
  privateKey: new Buffer(pk, 'hex'),
  address: new Buffer(address, 'hex'),
  // ganache
  secretKey: `0x${pk}`,
  balance: balance || defaultBalance
}))
