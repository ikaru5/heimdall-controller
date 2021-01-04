import heimdall from "./index.js"

/**
 * A Package for the payload. Heimdall sets its own meta information in required fields.
 * Everything in the convention over configuration manner. :)
 */
class Package {

  /**
   * Payload needs to be at least an empty object to be transformed to JSON successfully.
   * Also set isReceiving to undefined, since we dont know if its an sending or receiving package.
   */
  constructor() {
    this.payload = {}
    this.isReceiving = undefined
  }

  /**
   * Returns an instance of package for sending out.
   * @param payload
   * @param {Object} options
   *  supported options: receiver, path, port, host, protocol, decorate, csrfToken
   * @returns {Package}
   */
  static buildSend(payload, options = {}) {
    let newPackage = new Package
    newPackage.payload = "function" === typeof payload.toHash ? payload.toHash() : payload
    newPackage.receiver = options.receiver
    newPackage.path = options.path || heimdall.path
    newPackage.port = options.port || heimdall.port
    newPackage.host = options.host || heimdall.host
    newPackage.csrfToken = options.csrfToken || heimdall.csrfToken
    newPackage.protocol = options.protocol || heimdall.protocol
    newPackage.isReceiving = false
    if (undefined !== options.decorate || options.decorate) newPackage._decorateSender()
    return newPackage
  }

  /**
   * Returns an instance of package which was received.
   * @param rawData
   * @param {Object} options
   *  supported options: protocol
   * @returns {Package}
   */
  static buildReceive(rawData, options = {}) {
    let newPackage = new Package
    newPackage.protocol = options.protocol || heimdall.protocol
    newPackage.isReceiving = true

    if ("object" === typeof rawData) {
      newPackage.receiver = rawData.receiver
      newPackage.csrfToken = rawData.csrf
      newPackage.payload = rawData.payload
    } else {
      console.error(`Got invalid JSON: ${rawData}`)
    }

    return newPackage
  }

  /**
   * Transform to JSON and send it to backend through Heimdall.
   * @returns {boolean}
   */
  sendOut() {
    if (this.isReceiving) {
      console.error("Trying to send a received package!")
      return false
    }
    heimdall._sendOut(this._buildJSON(), this.protocol, this.host, this.path, this.port)
  }

  /**
   * Build the JSON String of Package.
   * @returns {String}
   * @private
   */
  _buildJSON() {
    let out = { payload: this.payload }
    if (undefined !== this.receiver) out["receiver"] = this.receiver
    if (undefined !== this.csrfToken && heimdall.handleCSRF) out["csrfToken"] = this.csrfToken
    return JSON.stringify(out)
  }

  /**
   * Decorates the sender package to make it syntactically beautiful for your backend. (For exp.: Ruby or Python styled receiver)
   * @private
   */
  _decorateSender() {
    if (undefined !== this.receiver && undefined !== heimdall.decorateReceiver) {
      this.receiver = heimdall.decorateReceiver(this.receiver)
    }
  }

}

export default Package