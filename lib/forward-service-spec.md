# ForwardService Spec
- #1 Class
- #2 Struct
- #3 Enum

---
## #1 Class
### [1] ForwardManager
#### 1. Constructor
- `new ForwardManager ({string} configPath, {?Object} logger, {?function} callback)`
  1. Events
    - `{FileSystemError}`

#### 2. Methods
- `static {ServiceOptions} isValidServiceOptions`
  1. Throws
    - `ERR_INVALID_SOURCE`
    - `ERR_INVALID_DEST`
    - `ERR_INVALID_TIMEOUT`
- `{Promise.<void, FileSystemError>} _loadConfig ()`
  1. Throws
    - `{FileSystemError}`
- `{Promise.<void, FileSystemError>} _saveConfig ()`
  1. Throws
    - `{FileSystemError}`
- `{Struct:ManagerStatus} status ()`
- `{void} _saveService ({string} name)`
  1. Throws
    - `ERR_SERVICE_NOT_EXISTS`
  2. Events
    - `error - ({Error.code:ERR_ASYNC_CONFIG_SAVE} err)`
- `{?ForwardService} getService ({string} name)`
- `{Promise.<void, Error>} createServiceProfile ({string} name, {ServiceOptions} options, {boolean} startImmediately)`
  1. Throws
    - `ERR_NAME_ALREADY_OCCUPIED`
    - `ERR_INVALID_PARAMETER`
    - `ERR_INVALID_DEST`
    - `ERR_INVALID_SOURCE`
  2. Events
    - `serviceProfileCreated - ({string} name, {number} sourcePort, {string} destHost)`
    - > Include events of method[`openService`] when param[`startImmediately`] enabled <파라미터[`startImmediately`]가 활성화 되었을 때 메소드[`openService`]의 이벤트들을 포함함>
- `{Promise.<void, Error>} removeServiceProfile ({string} name, {number} timeout)`
  1. Throws
    - `ERR_PROFILE_NOT_EXISTS`
  2. Events
    - `serviceProfileRemoved - ({string} name)`
- `{Promise.<void, Error>} modifyServiceProfile ({string} name, {Object} options)`
  1. Throws
    - `ERR_PROFILE_NOT_EXISTS`
  2. Events
    - `serviceProfileUpdate - ({string} name)`

- `{Promise.<void, Error>} openService ({string} profileName)`
  1. Throws
    - `ERR_PROFILE_NOT_EXISTS`
    - `ERR_SERVICE_ALREADY_OPENED`
  2. Events
    - `serviceOpen - ({string} name)`

- `{Promise.<void, Error>} closeService ({string} profileName, {number} timeout)`
  1. Throws
    - `ERR_PROFILE_NOT_EXISTS`
    - `ERR_SERVICE_ALREADY_CLOSED`
  2. Events
    - `serviceClose - ({string} name)`
- `get {string} version`
- `get {number[]} versionParsed`

#### 3. Properties
- `{Object.<name, ForwardService>} _profiles`
- `{Object} _config`
- `{string} configPath`
- `{Object} logger`

#### 4. Events
- `ready - ()` - when loaded all configs and started all profiled service
- `error - ({Error} err)` - unhandled exception occur
- `serviceProfileCreated - ({string} name, {number} sourcePort, {string} destHost)`
- `serviceProfileRemoved - ({string} name)`
- `serviceOpen - ({string} name, {number} sourcePort, {string} destHost)`
- `serviceClose - ({string} name)`

#### 5. TODOs
- __컨피그 파일 다루는 방식 변경 [=작업중=]:__  
  기존에는 컨피그 파일이 존재하던 말던 그냥 던져주는 오브젝트나 문자열이면
  경로로 인식해서 파일로 불러왔는데 어차피 외부에 컨피그 저장, 불러오기를 할만한
  방안을 구축할 시간이 없으므로 무조건 컨피그 파일 경로를 받는걸로 변경.
- __프로필 다루는 법 [=작업중=]:__  
  기존에 프로필 추가 없이 바로 서비스 시작 기능이 있었는데 대부분의 서비스는
  재활용이 필요한 경우가 많음. 이제는 서비스를 인스턴스로 시작하는 대신 프로필을
  등록하고 프로필 이름으로 시작하는 방식.

### [2] ForwardService
#### 1. Constructor
  - `new ForwardService ({ForwardManager} manager, {string} name, {ServiceOptions} options)`
    1. Throws
      - `ERR_INVALID_CTX`
      - `ERR_INVALID_SOURCE`
      - `ERR_INVALID_DEST`
      - `ERR_INVALID_TIMEOUT`

#### 2. Methods
  - `static {boolean} isValidPort ({number} port)`
  - `static {boolean} isValidHost ({string} host)`
  - `static {boolean} isValidTimeout ({number} timeout)`
  - `{string} _generateConnUid ()`
  - `get {number} sourcePort`
  - `get {string} destHost`
  - `get {string} destHostname`
  - `get {number} destPort`
  - `{ServiceStatus} status ()`
  - `{void} changeOptions ({ServiceOptions} options)`
    1. Throws
      - `ERR_SERVICE_RUNNING`
      - `ERR_INVALID_SOURCE`
      - `ERR_INVALID_DEST`
      - `ERR_INVALID_TIMEOUT`
    2. Events
      - `optionsChanged - ()`
  - `{void} setConnectionIdleTimeout ()`
    1. Throws
      - `ERR_INVALID_TIMEOUT`
  - `{boolean} isOpen ()`
  - `{async void/Error} open ()`
    1. Resolve
      - `{void}`
    2. Reject
      - `{Error.code:ERR_ALREADY_OPEN} err`
      - `{net.Server.listen#error.code:EADDRINUSE} err`
    3. Events
      - `open - ({void})`
  - `{async void/Error} close ({number} timeout)`
    1. resolve
      - `{void}`
    2. Reject
      - `{Error.code:ERR_ALREADY_CLOSE} err`
      - `{Error.code:ERR_INTERNAL_SERVER} err` // never happen
    3. Events
      - `close - ()`
  - `{?ForwardConnection} getConnection ({string} uid)`
  - `{void} destroyConnection ({string} uid)`
    1. Throws
      - `ERR_UNDEFINED_CONNECTION_UID`
  - `{void} destroyAllConnection ()`

#### 3. Properties
  - `{string} name`
  - `{ForwardManager} manager`
  - `{object} logger`
  - `{Enum:ServiceStatCode} statCode`
  - `{number} _sourcePort`
  - `{string} _destHost`
  - `{url.URL} _destURL`
  - `{Object.<uid, ForwardConection>} _connectionPool`
  - `{number} _connectionPoolInnerCounter`
  - `{number} _deletedConnectionsTotalBytesRead`
  - `{number} _deletedConnectionsTotalBytesWritten`
  - `{?net.Server} _server`
  - `{?number} _serverTimeoutAt`
  - `{?number} _serverTimeoutId`
  - `{number} _connectionIdleTimeout`

#### 4. Events
  - `open - ({number} sourcePort)`
  - `close - ()`
  - `connectionCreated - ({string} uid)`
  - `connectionDestroyed - ({string} uid)`
  - `optionsChanged - ()`
  - `error - ({net.Server.listen#error.code:EADDRINUSE} err)`
  - `error - ({Error.code:ERR_ALREADY_OPEN} err)`

#### 5. TODOs
  - 딱히 없음

### [3] ForwardConnection
#### 1. Constructor
  - `new ForwardConnection ({ForwardService} ctx, {string}, uid, {net.Socket} client, {number} idleTimeout)`
    1. throws
      - `ERR_INVALID_PARAMETER`
      - `ERR_CLIENT_DESTROYED`
    2. Events
      - `pipe - ()`

#### 2. Methods
  - `{Struct:ConnectionStatus} status ()`
  - `{void} destroy ()`
    1. Events
      - `destroy - ()`
  - `{boolean} isPaused ()`
  - `{this} pause ()`
    1. Events
      - `pause - ()`
  - `{this} resume ()`
    1. Events
      - `resume - ()`

#### 3. Properties
  - `{string} uid`
  - `{ForwardService} ctx`
  - `{object} logger`
  - `{Enum:ConnStatCode} statCode`
  - `{net.Socket} client`
  - `{net.Socket} dest`
  - `{number} idleTimeout`

#### 4. Events
  - `pipe - ()`
  - `destroy - ()`
  - `pause - ()`
  - `resume - ()`
  - `timeout - ()`

#### 5. TODOs
- __버퍼 금지 [완료됨!]:__  
  버퍼 문자열에 데이터 저장하다가 연결되면 한번에 쓰지말고 socket.pause() socket.resume() 사용 net.createServer.arguments[options].pauseOnConnect 라는 좋은 기능 존재.
- __전달되는 데이터 분석 [~~연기됨~~]:__  
  어떤식의 데이터가 오가는지 분석 요구. 그리고 가능하면 기록을 남기는 기능 추가.

---
## #2 Struct
### [1] ManagerStatus
- `{Object.<string, ServiceStatus>} services`

### [2] ServiceStatus
- `{string} name`
- `{boolean} serverOpen`
- `{number} sourcePort`
- `{string} destHost`
- `{number} totalBytesRead`
- `{number} totalBytesWritten`
- `{Object.<string, ConnectionStatus>} connections`

### [3] ConnectionStatus
- `{string} uid`
- `{Enum:ConnStatCode} statusCode`
- `{number} bytesRead` - from client
- `{number} bytesWritten` - to client
- `{string} clientFamily`
- `{string} clientAddress`
- `{string} clientPort`

### [4] ServiceOptions
- `{number} sourcePort`
- `{(string|number)} destHostOrPort`
- `{number} connectionIdleTimeout`

---
## #3 Enum
### [1] ServiceStatCode
- `CLOSE: 0`
- `OPENING: 1`
- `OPEN: 2`
- `CLOSING: 3`

### [2] ConnStatCode
- `PIPING: 0`
- `PIPED: 1`
- `DESTROY: 2`
