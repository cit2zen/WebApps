# 보이스 플래너 설치/실행 가이드

## 1. Android Studio 설치 (JDK 21 + SDK 포함)
1. https://developer.android.com/studio 에서 Android Studio 다운로드 후 설치.
2. 최초 실행 시 "Standard" 설치를 선택하면 Android SDK, 에뮬레이터, 빌드용 JDK 21이 함께 설치됩니다.
3. 설치 후 실제 기기로 테스트하려면 휴대폰에서 **설정 > 휴대전화 정보 > 빌드 번호**를 7번 눌러 개발자 모드를 켜고, **개발자 옵션 > USB 디버깅**을 켠 뒤 PC에 USB로 연결합니다.

## 2. Google Cloud Console 설정
1. https://console.cloud.google.com 접속 → 새 프로젝트 생성 (예: `voice-planner`).
2. **API 및 서비스 > 라이브러리**에서 다음 두 API를 검색해 각각 "사용" 클릭:
   - Google Calendar API
   - Google Tasks API
3. **API 및 서비스 > OAuth 동의 화면**:
   - User Type: **외부(External)** 선택.
   - 앱 이름, 지원 이메일 입력 후 저장.
   - 게시 상태는 **테스트(Testing)** 로 둡니다.
   - **테스트 사용자**에 본인 Google 계정 이메일을 추가합니다 (테스트 상태에서는 등록된 계정만 로그인 가능).
4. **API 및 서비스 > 사용자 인증 정보 > 사용자 인증 정보 만들기 > OAuth 클라이언트 ID**로 아래 두 개를 만듭니다.
   - **웹 애플리케이션** 클라이언트: 이름 자유. 생성된 클라이언트 ID(`xxxx.apps.googleusercontent.com`)를 복사해둡니다 → 앱 설정의 "Google Web Client ID"에 입력.
   - **Android** 클라이언트: 패키지 이름에 `io.github.cit2zen.voiceplanner` 입력. SHA-1 인증서 지문이 필요합니다 (아래 5단계 참고).
5. 디버그 키스토어 SHA-1 확인 (PowerShell/CMD):
   ```
   keytool -list -v -keystore %USERPROFILE%\.android\debug.keystore -alias androiddebugkey -storepass android
   ```
   출력 중 `SHA1:` 뒤의 값을 4단계 Android 클라이언트 생성 화면에 입력합니다.
   (`%USERPROFILE%\.android\debug.keystore` 파일이 없다면 Android Studio에서 앱을 한 번 실행하면 자동 생성됩니다.)

## 3. Anthropic API 키
1. https://console.anthropic.com 에서 로그인 후 **API Keys** 메뉴에서 새 키를 발급합니다.
2. 발급된 키(`sk-ant-...`)는 앱 실행 후 설정 화면의 "Anthropic API 키" 항목에 입력합니다.

## 4. 빌드 및 실행
1. `C:\factory\voice-planner` 폴더에서 웹 코드(`www/`)를 수정한 뒤에는 항상 아래 명령으로 네이티브 프로젝트에 반영합니다.
   ```
   npx cap sync android
   ```
2. Android Studio로 열어서 실행:
   ```
   npx cap open android
   ```
   Android Studio가 열리면 상단의 기기 선택 후 ▶(Run) 버튼을 눌러 연결된 휴대폰 또는 에뮬레이터에 설치합니다.
3. 또는 커맨드라인으로 APK만 빌드:
   ```
   cd android
   gradlew assembleDebug
   ```
   빌드가 끝나면 APK는 `android\app\build\outputs\apk\debug\app-debug.apk` 에 생성됩니다. 이 파일을 휴대폰으로 옮겨 설치하거나, USB 연결 상태에서 `gradlew installDebug`로 바로 설치할 수 있습니다.
4. 앱 실행 후 설정(⚙) 화면에서 Anthropic API 키, Google Web Client ID, 알림 분 전 값을 입력하고 "Google 로그인"으로 계정을 연결합니다.

## 참고
- 이 저장소 환경에는 Android SDK와 JDK 21이 없어 Gradle 빌드를 직접 실행하지 못했습니다. Android Studio 설치 후 실제 빌드로 최종 검증이 필요합니다.
- OAuth 동의 화면이 "테스트" 상태인 동안은 테스트 사용자로 등록한 계정만 로그인할 수 있습니다. 더 많은 사용자에게 배포하려면 Google의 앱 게시 심사가 필요합니다.
