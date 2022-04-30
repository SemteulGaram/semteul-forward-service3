# ForwardService Spec
> 다른 호스트나 로컬의 다른 포트에서 오는 트래픽을 지정한 포트로 포워팅 해주는 서비스
  - 코딩 스타일은 최대한 Standard Javascript를 따른다
  - 이 프로젝트의 일부 작업들은 요청-응답 방식이 아니므로 `Async`/ `Await`, `Promise` 대신 `Event`를 기반으로 한다 (추가적으로 `Callback` 지원)

## Index
- [1] Class
  - {1} ForwardServiceManager
    > 모든 포워딩 서비스 인스턴스들의 제어, 데이터 저장, 초기화 당담
      - 서비스의 재시작시에는 기존에 저장된 프로필을 불러와 기존의 서비스를 다시 부팅
      - 하위 서비스는 자신의 포워딩 정보가 변할 때 상위 관리자 인스턴스에 상태 변경을 알려서 변경내용을 저장할 수 있게 해야함
      - 하위 인스턴스에 로깅에 관련된 기능을 상속 시켜서 로거 하나로 모든 인스턴스들의 디버깅을 처리할 수 있게 할 것

  - {2} ForwardService
    > 유저로부터 연결요청을 받을 서버를 해당하는 포트에 열어놓는 인스턴스  
      - 서비스 포워딩 정보가 변할 때 상위 관리자 인스턴스에 상태 변경을 알려서 변경내용을 저장할 수 있게 해야함
      - 서비스 포워딩 정보의 유효성을 검사할 수 있는 `static` 메소드 필요
      - 최대 허용 가능한 커넥션의 갯수 지정 설정 `[[TODO]]`

  - {3} ForwardConnection
  > 유저가 서비스에 연결 요청을 했을 때 생성되는 클라이언트와 해당 서버와의 소켓 piping된 목적지 호스트와의 연결 소켓 한 쌍으로 구성됨
    - 하나의 소켓이 파괴될 때 쌍이 되는 다른 소켓도 같이 파괴해서 시스템의 자원 회수에 더 주의를 기울일 것 (지난 버전2의 가장 큰 문제점은 하나의 소켓이 파괴되면 다른 소켓을 닫지 않고 바로 연결을 삭제시켜 점점 닫히지 않은 커넥션이 늘어 `ENOBUF`로 시스템이 망가지는 상황이 있었음)
    - 이전버전에서는 연결 쌍이 각각 establish되어 piping되기 전에 문자열 버퍼를 사용해 데이터의 누출을 방지했었나 이를 net.createServer.arguments[0].pauseOnConnect를 사용해 socket.pause() socket.resume() 로 컨트롤 할 것
    - socket.setTimeout 기능을 이용해 장기간 활성화 되지 않은 소켓을 정리하는 기능을 선택적으로 설정가능하게 지정 `[[TODO]]`
    - 단순한 포워딩 서버의 기능으로서만이 아닌 패킷 캡쳐를 할 수 있게 통신 내용을 임시 저장할 수 있는 방법 구안 필요 `[[TODO]]`

  - {4} ConfigManager
  > File I/O 처리를 담당하는 단순한 세이브/로드를 당담하는 컨피그 관리자

- [2] Struct

- [3] Enum/Flags
  - {Flags} ManagerStatus
    > 서버의 상태를 플래그로 표시

  - {Flags} ServiceStatus
    > 서비스 인스턴스의 상태를 플래그로 표시

  - {Flags} ConnectionStatus
    > 커넥션 인스턴스의 상태를 플래그로 표시

---
## [1] Class
### {1} ForwardServiceManager
#### (1) Constructor
- `new ForwardServiceManager ({string} configPath, {?Object} logger, {?function} callback)`
  > 컨피그로 사용할 경로와 `debug`, `info`, `warn`, `error`를 지원하는 로거(선택사항 - 지정되지 않을 경우 콘솔에 그대로 출력함) 그리고 `init`, `error` 이벤트를 수신할 일회용 이벤트 리시버인 콜백(선택사항)을 인자로 받음

  - Events
    - `ready`
    - `error`
      - error list
        - `[[FileSystemError]]`
          > 컨피그 파일 I/O간 발생하는 오류

#### (2) Methods
- `{void} createProfile`
- `{void} removeProfile`
- `{void} startProfile`
- `{void} stopProfile`

#### (3) Properties
- `{ManagerStatus} status`
  > 현재 서비스의 상태를 나타내는 `ManagerStatus`플래그 변수

- `{string} configPath`
  > 컨피그 파일의 경로 저장 변수

- `{Object} _config`
  > 컨피그 파일의 JSON데이터 사본

- `{Object<string, ForwardService>} _services`
  > `ForwardService` 인스턴스들의 이름에 해당하는 키로 저장하는 오브젝트

#### (4) Events
- `ready`
  > 서비스 시작 철자가 모두 끝나면 발생.  
  내부 상태변수 `status`에 `ManagerStatus.READY`가 추가됨

- `error ({Error} err)`
  > 서비스의 부팅절차를 완료할 수 없거나, 서비스를 유지할 수 없게 만드는 중대한 예외가 일어났을때 발생.  
  property `status`에 `ManagerStatus.ERROR`이 추가되고 property `lastErrors`에 오류내용이 push된다.
  모든 인스턴스가 정리되고 서비스가 종료된다(`destroy` 발생).

- `warn ({Error} err)`
  > 서비스를 지속가능한 오류가 발생했을때 발생.
  property `status`에 `ManagerStatus.WARN`이 추가되고 property `lastErrors`에 오류내용이 push된다.

- `destroy`
  > 하위 인스턴스들이 모두 `destroy`되고 서비스를 종료할 준비를 마쳤을 때 발생

### {2} ForwardService

### {3} ForwardConnection

### {4} ConfigManager
#### (1) Constructor
- `new ConfigManager ({string} configPath)`
  > 단순히 컨피그 파일 경로만 받는 매니져
  파일 I/O에 관한 기초적인 동시접근 처리를 해주므로 관련 이슈를 더 상위 인스턴스에서 처리하지 않아도 됨

#### (2) Methods
- `{void} save ({Object} plainData, {function} callback)`
  > 주어진 JSON으로 변환 가능한 데이터를 비동기로 파일에 저장

  - Events
    - `saved`
    - `saveFail ({Error} err)`

- `{Promise} saveAsync ({Object} plainData)`
  > `save`의 `Promise`버전

  - Events
    - `saved`
    - `saveFail ({Error} err)`

- `{void} load ({function} callback)`
  > 컨피그로부터 데이터를 불러옴

  - Events
    - `loaded ({Object} data)`
    - `loadFail ({Error} err)`

- `{Promise} loadAsync ()`
  > `load`의 `Promise`버전

  - Events
    - `loaded ({Object} data)`
    - `loadFail ({Error} err)`

#### (3) Properties
- `{string} configPath`
> 컨피그의 파일 경로

- `{boolean} onIO`
> 파일 I/O 사용중 상태감지 변수

- `{boolean} reserveRead`
> 파일 I/O 사용중 불러오기 요청 예약

- `{?Object} reserveData`
> 파일 I/O가 완료 후 저장될 데이터

#### (4) Events
- `loaded ({Object} data)`
> 파일 불러오기가 완료되었을때 발생

- `saved`
> 파일 저장이 완료되었을때 발생.  
그러나 예약된 저장해야할 데이터가 있을 때는 마저 처리한 다음 발생

- `loadFail ({Error} err)`
> 파일 불러오기 실패시 발생

- `saveFail ({Error} err)`
> 파일 저장 실패시 발생

---
## [2] Struct

---
## [3] Enum/Flags
### {Flags} ManagerStatus
- READY: 1
- ERROR: 2
- WARN: 4

### {Flags} ServiceStatus
- OPEN: 1
- ERROR: 2
- CHANGING: 4
  > 상태가 변경중일때. 이 때는 서비스의 강제종료를 제외한 수정이 불가능

### {Flags} ConnectionStatus
- PIPED: 1
- ERROR: 2
- DESTROYED: 4
- TIMEOUT: 8
