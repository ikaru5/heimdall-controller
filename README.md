# Heimdall Controller

Structure your REST requests by communicating with [Heimdall Contracts](https://github.com/ikaru5/heimdall-contract).
Target is to encapsulate your asynchronous AJAX and WebSocket requests and responses for better maintainability.

- [Installation](#installation)
  - [Configuration](#configuration)  
- [General Usage - Sending Data](#general-usage---sending-data)
  - [Dispatching a contract](#dispatching-a-contract) 
    - [Example InitContract](#example-initcontract)
- [General Usage - Receiving Data](#general-usage---receiving-data)
  - [Creating a controller](#creating-a-controller)
- [Example Backend Implementations](#example-backend-implementations)
- [CustomConnection/WebSockets/ActionCable setup example](#customconnectionwebsocketsactioncable-setup-example)
- [Contributing](#contributing)
- [Contributors and Contact](#contributors-and-contact)
- [Copyright](#copyright)

## Installation

```bash
npm install @ikaru5/heimdall-contract
npm install @ikaru5/heimdall-controller
```

Create a heimdall.js file as an initializer with following content and import it in your application.js.

```javascript
import heimdall, { HeimdallController } from "@ikaru5/heimdall-controller"
// import "./controllers/user-controller" later you will import your controllers here
import InitContract from "./contracts/application/init-contract" // create this contract if you need an initialization request

new HeimdallController() // prepared controller with two endpoints: HeimdallController.csrf and HeimdallController.error

const initApplicationData = () => {
  const contract = new InitContract()
  // if your contract has some fields like data from localDB, you can set them here
  contract.dispatch()
}

heimdall.init({
  path: "/api",
  handleCSRF: true,
  afterCSRF: initApplicationData
})
```

**Notice:** InitContract is optional, but very helpful to load user data. So most applications will need it.

### Configuration

You can configure heimdall controller with following options:

```javascript
heimdall.init({
  path: "/api", // HTTP path to your backend
  port: 1234, // HTTP port to your backend, will try to detect automatically if not set
  handleCSRF: true, // enable CSRF protection handling
  afterCSRF: initApplicationData, // callback after initial CSRF handshake
  host: "localhost", // Host address to your backend, will try to detect automatically if not set
  protocol: "HTTP", // Protocol to your backend, everthing is HTTP until you define a custom connection
  // for WebSockets like ActionCable
  useCustomConnection: true, // enable custom connection handling
  connectCustomConnection: createActionCableConnectionCallback, 
  disconnectAllCustomConnections: disconnectAllActionCableConnectionsCallback,
  disconnectCustomConnection: disconnectActionCableConnectionCallback
})
```


## General Usage - Sending Data

Your backend will receive the following data:

```json
{
  "receiver": "User.Show",
  "csrf": "TOKEN",
  "payload": {
    "id": 1
  }
}
```

There are simple implementation [examples](#example-backend-implementations).
    
### Dispatching a contract

```javascript
import heimdall from "@ikaru5/heimdall-controller"
import UserBaseContract from "../user-contract.js" // your contract base class

const contract = new UserBaseContract() // create a contract
contract.id = this.id // set some data, you can also use assign() method
heimdall.dispatch(contract, {receiver: "User.Show"}) // dispatch the contract
```

If your contract has a default receiver or should be dispatched to only one receiver, you can define a method in the contract.

#### Example InitContract

```javascript
import Contract from "../contract" // your contract base class
import heimdall from "@ikaru5/heimdall-controller"

// if you wonder: yes! this contract has no schema since it does send any data and acts as a request like GET
class InitContract extends Contract {
  dispatch() {
    heimdall.dispatch(this, {receiver: "Application.Init"})
  }
}

export default InitContract
```

Like this init contract you might have a lot of endpoints without any data to send.
You don't need to define this empty contracts, you can use the `Contract` class directly.

```javascript
import Contract from "../contract" // your contract base class
import heimdall from "@ikaru5/heimdall-controller"

const contract = new Contract() // create a contract
heimdall.dispatch(contract, {receiver: "Application.Init"})
```

#### Dispatch API

You can override some defaults on dispatching a contract. 
Send it to another host or path for example.

```javascript
heimdall.dispatch(
  contract, 
  {
    receiver: "User.Show",
    path: "another-api", 
    files: [UPLOADED-FILES], 
    port: 1234, 
    host: "localhost"
  }
) 
```

## General Usage - Receiving Data

Your Backend has to send the data in a format like this:

```json
{
  "receiver": "User.Show",
  "csrf": "TOKEN",
  "payload": {
    "id": 1,
    "name": "John Doe"
  }, 
  "priority": 1 
}
```
Higher priority number means that contracts are passed to frontend controller endpoints first.

There are simple implementation [examples](#example-backend-implementations).

### Creating a controller

```javascript
import { ControllerBase } from "@ikaru5/heimdall-controller" // import the base class

// import some callback functions here
import { signupSuccessOperation } from "../../operations/user/signup"
import { showSuccessOperation } from "../../operations/user/show"
import { loginSuccessOperation } from "../../operations/user/login"
import { genericOperation } from "../../operations/user/generic"
import { logoutSuccessOperation } from "../../operations/user/logout"
import { failedOperation } from "../../operations/user/failed"

import UserBaseContract from "../contracts/user/base"
import GenericContract from "../contracts/generic-contract"

// create a controller class and define actions
class UserController extends ControllerBase {
  name = "UserController" // only required if you minifiy your code
  
  static actions = [
    { name: "failed", contract: GenericContract, to: failedOperation, validate: false },
    { name: "showSuccess", contract: UserBaseContract, to: showSuccessOperation, onInvalid: genericOperation, context: "show" },
    { name: "deleteSuccess", controller: "SomeOtherControllerName", to: genericOperation },
    { name: "signupSuccess", to: signupSuccessOperation },
    { name: "loginSuccess", to: loginSuccessOperation },
    "logoutSuccess"
  ]
  
  // you can also define actions as methods
  logoutSuccess({contract, receivedPackage}) {
    logoutSuccessOperation(contract, receivedPackage) // for sure you dont need to call external functions here
  }
}

export default new UserController() // export a new instance of the controller
```

**IMPORTANT NOTICE:** In this example an instance is exported, so by importing it in your initializer the controller is already active.

The callback functions and controller methods will be called with "contract" (if you defined one) and "receivedPackage" with raw data.

Properties of Actions:

```
@property {string} name - action name
@property {string} [controller] - overwrite name of controller
@property {Object} [contract] - assign received payload to an instance of this contract class
@property {function} [to] - callback where action should be passed to
@property {function} [onInvalid] - callback where action should be passed to if contract is invalid
@property {boolean} [validate] - validate contract, default: true
@property {boolean} [context] - validation context, will be passed to contract.isValid()
```

## Example Backend Implementations

* [Ruby on Rails](TODO)
* [Crystal Amber](TODO)

## CustomConnection/WebSockets/ActionCable setup example

At the moment a universal solution for WebSockets and other Custom Connections has to be found.
For now you can use the following example to setup ActionCable.

First of all you have to create a consumer (generated by Rails).

```javascript
import { createConsumer } from "@rails/actioncable"

export default createConsumer()
```

Then you have to register the callbacks in your init.

```javascript
import consumer from "../channels/consumer"

// ...

heimdall.init({
  useCustomConnection: true,
  connectCustomConnection: ({ params, onConnected, onDisconnected, onReceive }) => {
    const mixin = params.mixin || {}
    delete params.mixin
    return consumer.subscriptions.create(params, {
      connected() {
        onConnected(params)
      },

      disconnected() {
        onDisconnected(params)
      },

      received(data) {
        onReceive({ data, params, protocol: "ActionCable" })
      },

      ...mixin
    })
  },
  disconnectAllCustomConnections: () => {
    consumer.disconnect()
  },
  disconnectCustomConnection: ({ params, collection }) => {
    collection.find(e => JSON.stringify(e.params) === JSON.stringify(params))?.connection?.unsubscribe()
  }
})
```

The idea of ActionCable is having multiple channels, so it doesn't work as a receiver. 
This is how a BoardChannel could look like in a collaborative whiteboard application:

```ruby
class BoardChannel < ApplicationCable::Channel
  def subscribed
    stream_from "board_channel_#{params[:board_id]}"
  end

  def send_collaboration(data)
    contract = Heimdall::Contract::Dispatch.new
    contract.priority = 0
    contract.payload = data
    contract.receiver = "Board.collaborationUpdated"
    ActionCable.server.broadcast "board_channel_#{params['board_id']}", contract.to_json
  end
end
```

## Contributing

1. Fork it (<https://github.com/ikaru5/heimdall-controller/fork>)
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create a new Pull Request

## Contributors and Contact

If you have ideas on how to develop heimdall more or what features it is missing, I would love to hear about it!

- [@ikaru5](https://github.com/ikaru5) Kirill Kulikov - creator, maintainer

## Copyright

Copyright (c) 2020 Kirill Kulikov <k.kulikov94@gmail.com>

`heimdall-controller` is released under the [MIT License](http://www.opensource.org/licenses/MIT).