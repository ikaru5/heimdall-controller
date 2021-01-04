import heimdall from "./index.js"

class ControllerBase {

  constructor() {
    this._heimdall = heimdall
    this._registerRoutes()
    this._callbacks = {}
    this.actions = []
  }

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

  _callAction(action, receivedPackage) {
    if ("function" === typeof this[action]) {
      this[action](receivedPackage)
    } else {
      this._defaultAction(action, receivedPackage)
    }
  }

  _defaultAction(action, receivedPackage) {
    this.callListeners(action, receivedPackage)
  }

  callListeners(action, receivedPackage) {
    if (undefined === this._callbacks[action] || 0 === this._callbacks[action].size) return
    for (let callback of this._callbacks[action]) {
      callback(receivedPackage)
    }
  }
}

export default ControllerBase