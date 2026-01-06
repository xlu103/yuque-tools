/**
 * Type declarations for jsencrypt-node
 */
declare module 'jsencrypt-node' {
  export default class JSEncrypt {
    constructor()
    setPublicKey(key: string): void
    setPrivateKey(key: string): void
    encrypt(data: string): string | false
    decrypt(data: string): string | false
  }
}
