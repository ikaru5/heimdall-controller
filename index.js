import Package from "./package.js"
import HeimdallController from "./heimdall-controller.js"
import ControllerBase from "./controller-base.js"

/**
 * Base Class
 * Needs to be initialized before usage!
 * Import in your index.js (or your equivalent) with at least heimdall.init()
 */
class HeimdallAPI {

  /**
   * Create empty controller map. The Controller will use the _registerController Method to populate it.
   * Also set the default simple connection error handler (Just logs an error to the console). It should be replaced if you want real error handling!
   */
  constructor() {
    this._controller = {}
    this.connectionFailureCallback = function (error) {
      console.error(`Network Error: ${error}`)
    }
  }

  /**
   * Load defaults and gives the options to set things up.
   * Will also read default host information if nothing provided. (Not on React Native)
   * If it is a simple webapp its completely fine to provide nothing if it fits you.
   * @param {string} path
   * @param {number} port
   * @param {string} protocol - TODO better name?
   * @param {string} host
   * @param {boolean} handleCSRF
   * @param {undefined | function} afterCSRF
   * @param {undefined | function} decorateForReceiver - optional function to decorate the payload before sending it out
   * @param {boolean} useCustomConnection - use some custom protocol like websockets for example
   * @param {undefined | function} connectCustomConnection - callback to connect to a custom connection (e.g. websockets)
   * @param {undefined | function} disconnectAllCustomConnections - callback to disconnect from all custom connections (e.g. websockets)
   * @param {undefined | function} disconnectCustomConnection - callback to disconnect from a custom connection (e.g. websockets)
   * @returns {HeimdallAPI} - no need to use your configuration output, since its singleton.
   */
  init({
         path = "/api",
         port,
         protocol = "HTTP",
         host,
         handleCSRF = false,
         afterCSRF,
         decorateForReceiver,
         useCustomConnection = false,
         connectCustomConnection,
         disconnectAllCustomConnections,
         disconnectCustomConnection
       }) {
    // simply default values, can be changed for a package
    this.path = path
    this.protocol = protocol
    this.host = host
    this.handleCSRF = handleCSRF
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
    this.decorateForReceiver = decorateForReceiver

    if (this.handleCSRF) {
      this.csrfToken = undefined
      this._getCSRFToken()
      this._afterCSRF = afterCSRF
    }

    if (useCustomConnection) {
      this.useCustomConnection = useCustomConnection
      this._connectCustomConnection = connectCustomConnection
      this._customCreateReturnCollection = []
      if (disconnectAllCustomConnections) this._disconnectAllCustomConnections = disconnectAllCustomConnections
      if (disconnectCustomConnection) this._disconnectCustomConnection = disconnectCustomConnection
    }

    return this
  }

  listenToCustom(params) {
    if (!this.useCustomConnection || !this._connectCustomConnection) {
      console.error(
        "Could not define channel listener because not enabled or connectCustomConnection not defined." +
        "Make sure you used the init method with useCustomConnection set to true and connectCustomConnection defined."
      )
      return
    }

    const connection = this._connectCustomConnection(
      {
        params,
        onConnected: this._connectedToCustom,
        onDisconnected: this._disconnectedFromCustom,
        onReceive: this._onCustomReceive
      }
    )

    if (connection) this._customCreateReturnCollection.push({connection, params})
    return connection
  }

  stopListenToCustom(params) {
    console.info("Disconnecting from custom channel with params:")
    console.info(params)
    this._disconnectCustomConnection({params, collection: this._customCreateReturnCollection})
  }

  disconnectCustoms() {
    this._disconnectAllCustomConnections()
  }

  _connectedToCustom = (params) => {
    console.info("Connected to custom channel with params:")
    console.info(params)
  }

  _disconnectedFromCustom = (params) => {
    this._customCreateReturnCollection = this._customCreateReturnCollection.filter(
      e => JSON.stringify(e.params) !== JSON.stringify(params)
    )
    console.info("Disconnected from custom channel with params:")
    console.info(params)
  }

  _onCustomReceive = ({data, protocol}) => {
    this._receivePackage(JSON.parse(data), protocol)
  }

  /**
   * Use this to handle network errors.
   * @param {function} callback
   */
  setConnectionFailureCallback(callback) {
    this.connectionFailureCallback = callback
  }

  /**
   * @typedef DispatchOptions
   * @property {string} receiver - Backend Endpoint like User.Show
   * @property {Array} [files] - files to send (picture, video, ...)
   * @property {string} [path] - override the default path
   * @property {string} [port] - override default port
   * @property {string} [host] - override default host
   * @property {string} [protocol] - override default protocol
   */

  /**
   * Build a heimdall formed package with provided payload and dispatch it to the backend.
   * Payload can be a contract and heimdall will extract the JSON itself. ;)
   * @param {Object} payload
   * @param {DispatchOptions} options
   */
  dispatch(payload, {receiver, path, files, port, host, protocol}) {
    const sendPackage =
      Package.buildSend(payload,
        {
          receiver: receiver,
          path: path,
          files: files,
          port: port,
          host: host,
          protocol: protocol
        }
      )

    sendPackage.sendOut()
  }

  /**
   * Get the first CSRF Token. TODO maybe extract it to an external file make it overrideable to make the handling customizable.
   * @private
   */
  _getCSRFToken() {
    Package.buildSend({}, {receiver: "Heimdall.CSRF", protocol: "GET"}).sendOut()
  }

  /**
   * Controller must register itself, so Heimdall knows where to route incoming packages.
   * @param controllerInstance
   * @param controllerName
   * @param {Array<string|Action>} actions
   * @private
   */
  _registerController(controllerInstance, controllerName, actions) {
    if (!this._controller[controllerName]) this._controller[controllerName] = {}
    this._controller[controllerName].instance = controllerInstance

    actions?.forEach(action => this._registerAction(action.controller ?? controllerName, action))
  }

  /**
   * @typedef Action
   * @property {string} name - action name
   * @property {string} [controller] - overwrite name of controller
   * @property {Object} [contract] - assign received payload to an instance of this contract class
   * @property {function} [to] - callback where action should be passed to
   * @property {function} [onInvalid] - callback where action should be passed to if contract is invalid
   * @property {boolean} [validate] - validate contract
   */

  /**
   * Register action and the controller, if not already happened.
   * BUT! without instance -> if its stays without instance, action must have a "to" callback defined!
   * @param controllerName
   * @param {string|Action} action
   * @private
   */
  _registerAction(controllerName, action) {
    if (!this._controller[controllerName]) this._controller[controllerName] = {}
    if (!this._controller[controllerName].actions) this._controller[controllerName].actions = []
    if ("string" === typeof action) {
      this._controller[controllerName].actions.push({name: action})
    } else {
      this._controller[controllerName].actions.push(action)
    }
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
  _sendOut(payloadJSON, protocol = this.protocol, host = this.host, path = this.path, port = this.port, files) {
    switch (protocol) {
      case "HTTP":
        this._dispatchPOST(payloadJSON, host, path, port, files)
        break
      case "POST":
        this._dispatchPOST(payloadJSON, host, path, port, files)
        break
      case "GET":
        if (undefined !== files) console.warn(`Unexpected File Input for protocol: ${protocol}`)
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
   * @param files
   * @returns {Promise<void>}
   * @private
   */
  async _dispatchPOST(payloadJSON, host, path, port, files) {
    try {
      let url = 80 === port ? `${host}${path}` : `${host}:${port}${path}`
      let headers = {}
      if (this.handleCSRF) headers["X-CSRF-TOKEN"] = this.csrfToken
      let response
      if (undefined === files) {
        headers['Content-Type'] = 'application/json'
        response = await fetch(url, {method: "POST", body: payloadJSON, headers: headers})
      } else {
        let payloadData = new FormData()
        payloadData.append('file-count', files.length)
        payloadData.append('_json', payloadJSON)
        for (let fileId in files) {
          payloadData.append(`file_${1 + parseInt(fileId)}`, files[fileId])
        }
        response = await fetch(url, {method: "POST", body: payloadData, headers: headers})
      }

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
    const parseData = (rawData, protocol, priority = 0) => {
      const receivedPackage = Package.buildReceive(rawData, {protocol: protocol})
      const controller = receivedPackage.receiver.split(".").slice(0, -1).join(".") + "Controller"
      const action = receivedPackage.receiver.split(".").slice(-1)[0]

      // lookup definition for action
      let actionDef = undefined
      try {
        actionDef = this._controller[controller].actions.find(a => a.name === action)
      } catch (e) {
        // nothing to do here atm
      }

      if (!actionDef?.silent) console.info(`Received package priority: ${priority} to ${controller}->${action}`)

      // VALIDATE ACTION DEFINITION
      const isActionDefValid = actionDef && (
        (!!this._controller[controller]?.instance && actionDef.name) ||
        !!actionDef.to
      )

      if (!isActionDefValid) {
        console.error(`Path for ${receivedPackage.receiver}, which was interpreted as ${controller}->${action} not found.`)
        return
      }

      // PREPARE DATA FOR ACTION
      const data = {}
      data.receivedPackage = receivedPackage

      // if contract defined build instance
      if (actionDef.contract) {
        data.contract = new actionDef.contract()
        data.contract.assign(receivedPackage.payload)
        if (actionDef.validate !== false) { // set validate explicit to false if you don't want to validate your contract
          if (!data.contract.isValid(actionDef.context)) {
            console.error(`Path for ${receivedPackage.receiver}, which was interpreted as ${controller}->${action} received invalid data for contract ${data.contract.constructor?.name}.`)
            console.info(data.contract.errors)

            if (actionDef.onInvalid) actionDef.onInvalid(data)
            return
          }
        }
      }

      // CALL DEFINED ACTION
      if (!!actionDef.to) {
        actionDef.to(data)
      } else {
        this._controller[controller].instance._callAction(actionDef.name, data)
      }
    }

    if (undefined === rawData.length) {
      parseData(rawData, protocol)
    } else {
      // sort by priority if provided
      const sortedData = rawData.sort((lE, rE) => {
        if (undefined === lE.priority) return -1
        if (undefined === rE.priority) return 1
        return lE.priority < rE.priority ? 1 : -1
      })

      for (const data of sortedData) {
        parseData(data, protocol, data.priority)
      }
    }
  }

}

const heimdallAPI = new HeimdallAPI()
export default heimdallAPI
export {HeimdallController, ControllerBase}