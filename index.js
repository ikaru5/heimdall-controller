import Package from "./package.js"
/**
 * Base Class
 * Needs to be initialized before usage!
 * Import in your index.js (or your equivalent) with at least heimdall.init()
 *
 * TODO:
 * - CSRF handling
 * - CSRF outsource
 * - Binary payload handling for pictures etc - idea: separate action like api_binary
 * - Websockets support
 */
class HeimdallAPI {

  /**
   * Create empty controller map. The Controller will use the _registerController Method to populate it.
   * Also set the default simple connection error handler (Just logs an error to the console). It should be replaced if you want real error handling!
   */
  constructor() {
    this._controller = {}
    this.connectionFailureCallback = function (error) { console.error(`Network Error: ${error}`) }
  }

  /**
   * Load defaults an gives the options to set things up.
   * Also will read default host information if nothing provided. (Not on React Native)
   * If its a simple webapp its completely fine to provide nothing if it fits you.
   * @param options TODO document all possible configs (do it later since they are not final)
   * @returns {HeimdallAPI} - no need to use your configuration output, since its singleton.
   */
  init(options = {}) {
    // simply default values, can be changed for a package
    this.path = options.path || "/api"
    this.port = options.port
    this.protocol = "HTTP"
    this.host = options.host
    this.handleCSRF = options.handleCSRF || false
    if (typeof window) {
      if (undefined === this.host && undefined === this.port) {
        if (0 === window.location.port.length) {
          this.host = window.location.origin
        } else {
          this.host = window.location.origin.slice(0, -(window.location.port.length + 1))
        }
        this.port = window.location.port
      } else if (undefined === this.host) {
        if (0 === window.location.port.length) {
          this.host = window.location.origin
        } else {
          this.host = window.location.origin.slice(0, -(window.location.port.length + 1))
        }
      }
    }
    this.port = this.port || 80
    this.contractRequired = options.contractRequired || false
    this.decorateReceiver = options.decorateReceiver

    if (this.handleCSRF) {
      this.csrfToken = undefined
      this._getCSRFToken()
      this._afterCSRF = options.afterCSRF
    }

    return this
  }

  /**
   * Use this to handle network errors.
   * TODO what about Websockets?
   * @param {function} callback
   */
  setConnectionFailureCallback(callback) {
    this.connectionFailureCallback = callback
  }

  /**
   * Build a heimdall formed package with provided payload and dispatch it to the backend.
   * Payload can be a contract and heimdall will extract the JSON itself. ;)
   * @param {Object} payload
   * @param {Object} options
   */
  dispatch(payload, options) {
    let sendPackage =
      Package.buildSend(payload,
        {
          receiver: options.receiver,
          target: options.target,
          port: options.port,
          host: options.host,
          protocol: options.protocol
        }
      )

    sendPackage.sendOut()
  }

  /**
   * Get the first CSRF Token. TODO maybe extract it to an external file make it overrideable to make the handling customizable.
   * @private
   */
  _getCSRFToken() {
    Package.buildSend({}, { receiver: "Heimdall.CSRF", protocol: "GET" }).sendOut()
  }

  /**
   * Controller must register itself, so Heimdall knows where to route incoming packages.
   * @param controllerInstance
   * @param controllerName
   * @param actions
   * @private
   */
  _registerController(controllerInstance, controllerName, actions) {
    this._controller[controllerName] = { instance: controllerInstance, actions: actions }
  }

  /**
   * This is the sender method. It will make the technical decisions.
   * Remember: Target of Heimdall is to take away thoughts about this stuff from the developer.
   * @param payloadJSON
   * @param protocol
   * @param host
   * @param path
   * @param port
   * @private
   */
  _sendOut(payloadJSON, protocol = this.protocol, host = this.host, path = this.path, port = this.port) {
    switch (protocol) {
      case "HTTP":
        this._dispatchPOST(payloadJSON, host, path, port)
        break
      case "POST":
        this._dispatchPOST(payloadJSON, host, path, port)
        break
      case "GET":
        this._dispatchGET(payloadJSON, host, path, port)
        break
      default:
        console.error(`Unknown protocol: ${protocol}`)
        this.connectionFailureCallback(`Unknown protocol: ${protocol}`)
    }
  }

  /**
   * The HTTP POST communication request.
   * @param payloadJSON
   * @param host
   * @param path
   * @param port
   * @returns {Promise<void>}
   * @private
   */
  async _dispatchPOST(payloadJSON, host, path, port) {
    try {
      let url = 80 === port ? `${host}${path}` : `${host}:${port}${path}`
      let headers = {'Content-Type': 'application/json'}
      if (this.handleCSRF) headers["X-CSRF-TOKEN"] = this.csrfToken
      let response = await fetch(url, {method: "POST", body: payloadJSON, headers: headers})
      let data = await response.json()
      this._receivePackage(data, "HTTP")
    } catch (error) {
      this.connectionFailureCallback(error)
    }
  }

  async _dispatchGET(payloadJSON, host, path, port) {
    try {
      let url = 80 === port ? `${host}${path}` : `${host}:${port}${path}`
      let encodedPayload = encodeURIComponent(payloadJSON)
      url = `${url}?_json=${encodedPayload}`
      let response = await fetch(url, {method: "GET", headers: {'Content-Type': 'application/json'}})
      let data = await response.json()
      this._receivePackage(data, "HTTP")
    } catch (error) {
      this.connectionFailureCallback(error)
    }
  }

  _receivePackage(rawData, protocol) {
    let parseData = (rawData, protocol) => {
      let receivedPackage = Package.buildReceive(rawData, { protocol: protocol })
      let controller = receivedPackage.receiver.split(".").slice(0, -1).join(".") + "Controller"
      let action = receivedPackage.receiver.split(".").slice(-1)[0]
      if (undefined !== this._controller[controller] &&
          'object' === typeof(this._controller[controller].actions) &&
          -1 !== this._controller[controller].actions.indexOf(action))
      {
        this._controller[controller].instance._callAction(action, receivedPackage)
      } else {
        console.error(`Path for ${receivedPackage.receiver}, which was interpreted as ${controller} and ${action} not found.`)
      }
    }

    if (undefined === rawData.length) {
      parseData(rawData, protocol)
    } else {
      let sortedData = rawData.sort((lE, rE) => {
        if (undefined === lE.priority) return -1
        if (undefined === rE.priority) return 1
        return lE.priority < rE.priority ? 1 : -1
      })
      for (let data of sortedData) {
        console.log(data.priority)
        parseData(data, protocol)
      }
    }
  }

}

const heimdallAPI = new HeimdallAPI()
export default heimdallAPI