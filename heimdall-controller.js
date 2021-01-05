import ControllerBase from "./controller-base.js"

export default class HeimdallController extends ControllerBase {

  static actions = ["csrf", "error"]

  /**
   * Handling of initially received token.
   * @param {Package} receivedPackage
   */
  csrf(receivedPackage) {
    this._heimdall.csrfToken = receivedPackage.csrfToken
    if (undefined !== this._heimdall._afterCSRF) this._heimdall._afterCSRF()
  }

  /**
   * Handling of received errors from backend.
   * @param {Package} receivedPackage
   */
  error(receivedPackage) {
    let error = "Backend failed tp process package:"
    let payload = receivedPackage.payload
    console.log({error, payload})
  }

}