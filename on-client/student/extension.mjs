// 이 파일은 학생이 같은 프로젝트에서 이어서 구현합니다.
// 제공 UI를 받은 것만으로 단계 완료를 인정하지 않습니다.
export function createStudentView() {
  return {
    renderIdentity({ me, devices, sessions }) {
      const root = document.createElement('section');
      root.setAttribute('aria-label', '로그인 사용자·기기·세션');

      const addLine = (parent, label, value) => {
        const line = document.createElement('p');
        const title = document.createElement('strong');
        title.textContent = label + ': ';
        const detail = document.createElement('span');
        detail.textContent = String(value ?? '확인 불가');
        line.append(title, detail);
        parent.append(line);
      };
      const deviceStatus = {
        compliant: '보안 기준 충족',
        noncompliant: '보안 기준 미충족',
        unknown: '확인 불가',
      };
      const sessionStatus = {
        active: '활성',
        expired: '만료',
        revoked: '철회됨',
        unknown: '확인 불가',
      };
      const resources = [
        ['로그인 사용자', me],
        ['기기 목록', devices],
        ['세션 목록', sessions],
      ];

      for (const [name, resource] of resources) {
        const section = document.createElement('section');
        const heading = document.createElement('h3');
        heading.textContent = name;
        section.append(heading);

        const mode = resource?.mode ?? resource?.meta?.mode;
        if (mode === 'demo') addLine(section, '연결 모드', '예제 자료');
        else if (mode === 'disconnected') addLine(section, '연결 모드', '연결 없음');
        else if (mode === 'unknown') addLine(section, '연결 모드', '확인 불가');

        if (resource?.status === 'loading') {
          addLine(section, '조회 상태', '불러오는 중');
        } else if (resource?.status === 'error') {
          addLine(section, '조회 상태', '연결 실패: ' + (resource.error?.message || '확인 불가'));
        } else if (resource?.status === 'ok') {
          if (resource === me) {
            const data = resource.data;
            addLine(section, '사용자', data?.user?.label);
            addLine(section, '사용자 ID', data?.user?.id);
            addLine(section, '현재 기기', data?.device?.label);
            addLine(section, '현재 기기 ID', data?.device?.id);
            addLine(section, '기기 보안 상태', deviceStatus[data?.device?.status] || '확인 불가');
            addLine(section, '현재 세션 ID', data?.session?.id);
            addLine(section, '세션 상태', sessionStatus[data?.session?.status] || '확인 불가');
          } else if (resource === devices) {
            if (!Array.isArray(resource.data)) {
              addLine(section, '조회 결과', '확인 불가');
            } else if (resource.data.length === 0) {
              addLine(section, '조회 결과', '기기 없음');
            } else {
              for (const device of resource.data) {
                addLine(section, '기기', device?.label);
                addLine(section, '기기 ID', device?.id);
                addLine(section, '기기 보안 상태', deviceStatus[device?.status] || '확인 불가');
              }
            }
          } else if (!Array.isArray(resource.data)) {
            addLine(section, '조회 결과', '확인 불가');
          } else if (resource.data.length === 0) {
            addLine(section, '조회 결과', '세션 없음');
          } else {
            for (const session of resource.data) {
              addLine(section, '세션 ID', session?.id);
              addLine(section, '세션 상태', sessionStatus[session?.status] || '확인 불가');
            }
          }
        } else {
          addLine(section, '조회 상태', '확인 불가');
        }
        root.append(section);
      }
      return root;
    },
    renderDecision({ status, mode, data, error, appId }) {
      const root = document.createElement('section');
      root.setAttribute('aria-label', '업무 앱 접근 판정');
      const addLine = (label, value) => {
        const line = document.createElement('p');
        const heading = document.createElement('strong');
        heading.textContent = label + ': ';
        const detail = document.createElement('span');
        detail.textContent = String(value ?? '확인 불가');
        line.append(heading, detail);
        root.append(line);
      };

      if (mode === 'demo') addLine('연결 모드', '예제 자료');
      else if (mode === 'disconnected') addLine('연결 모드', '연결 없음');
      else if (mode === 'unknown') addLine('연결 모드', '확인 불가');

      if (status === 'idle') {
        addLine('요청 상태', '앱을 선택하고 접근을 요청하세요.');
      } else if (status === 'loading') {
        addLine('대상 앱', appId);
        addLine('요청 상태', '접근 판정 확인 중');
      } else if (status === 'error') {
        addLine('대상 앱', appId);
        addLine('요청 상태', '접근 요청 실패');
        addLine('오류 메시지', error?.message || '확인 불가');
        addLine('판정 안내', '요청 실패는 접근 거부(deny) 판정이 아닙니다.');
      } else if (status === 'ok') {
        addLine('대상 앱', data?.appId ?? appId);
        const labels = {
          allow: '접근 허용(allow)',
          deny: '접근 거부(deny)',
          challenge: '추가 확인 필요(challenge)',
          unknown: '판정 확인 불가(unknown)',
        };
        const decision = data?.decision;
        addLine('접근 판정', labels[decision] || labels.unknown);
        if (decision === 'allow') addLine('판정 안내', '정책상 접근 허용이며 실제 앱 접속 성공을 보장하지 않습니다.');
        if (decision === 'challenge') addLine('판정 안내', '추가 인증 또는 확인이 필요합니다. 이 앱은 확인 절차를 대신 수행하지 않습니다.');
        if (!Object.hasOwn(labels, decision)) addLine('판정 안내', '알 수 없는 판정값입니다. 접근 허용으로 취급하지 않습니다.');
        addLine('판정 이유', data?.reason);
        addLine('판정 시각', data?.checkedAt);
      } else {
        addLine('요청 상태', '확인 불가');
      }
      return root;
    },
    renderEvents() { return '학생 구현 대기: 본인 접속·XDR 기록을 연결하세요.'; },
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
