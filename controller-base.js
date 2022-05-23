import heimdall from "./index.js"

class ControllerBase {

  constructor() {
    this._heimdall = heimdall
    this._registerRoutes()
    this._callbacks = {}
    this.actions = []
  }

  // TODO I forgot that I implemented this... Need to check if its still relevant
  listenToAction(action, callback) {
    if (this.constructor.actions.includes(action)) {
      if (undefined === this._callbacks[action]) this._callbacks[action] = []
      this._callbacks[action].push(callback)
      return true
    } else {
      console.error(`No action ${action} for controller ${this.constructor.name}.`)
      return false
    }
  }

  _registerRoutes() {
    heimdall._registerController(this, this.constructor.name, this.constructor.actions)
    console.log(this.constructor.name)
  }

  /**
   * @typedef ActionData
   * @property {receivedPackage} Package - raw data with payload
   * @property {Object} [contract] - contract with assigned received payload, only if provided on action definition
   */

  /**
   *
   * @param action
   * @param {ActionData} data
   * @private
   */
  _callAction(action, data) {
    if ("function" === typeof this[action]) {
      this[action](data)
    } else {
      this._defaultAction(action, data)
    }
  }

  _defaultAction(action, data) {
    this.callListeners(action, data)
  }

  callListeners(action, data) {
    if (undefined === this._callbacks[action] || 0 === this._callbacks[action].size) return
    for (let callback of this._callbacks[action]) {
      callback(data)
    }
  }
}

export default ControllerBase