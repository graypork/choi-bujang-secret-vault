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
    renderEvents({ status, mode, data, error }) {
      const root = document.createElement('section');
      root.setAttribute('aria-label', '내 접속 기록 및 XDR 경보');
      const addText = (parent, label, value) => {
        const p = document.createElement('p');
        const strong = document.createElement('strong');
        strong.textContent = label + ': ';
        const span = document.createElement('span');
        span.textContent = String(value ?? '확인 불가');
        p.append(strong, span);
        parent.append(p);
      };
      const labels = {
        kind: { access: '접속 기록', xdr: 'XDR 경보' },
        access: { allowed: '허용', denied: '거부', unknown: '확인 불가' },
        session: { active: '활성', expired: '만료', revoked: '철회됨', unknown: '확인 불가' },
        device: { compliant: '보안 기준 충족', noncompliant: '보안 기준 미충족', unknown: '확인 불가' },
      };
      const description = (group, value) => {
        const code = value == null || value === '' ? 'unknown' : String(value);
        return (Object.hasOwn(labels[group], code) ? labels[group][code] : '확인 불가') + '(' + code + ')';
      };
      const appLabel = value => value == null || value === '' ? '앱 확인 불가' : String(value);

      if (mode === 'demo') addText(root, '연결 모드', '예제 자료');
      else if (mode === 'disconnected') addText(root, '연결 모드', '연결 없음');

      if (status === 'idle') {
        addText(root, '조회 상태', '기록 조회 전');
        return root;
      }
      if (status === 'loading') {
        addText(root, '조회 상태', '보안 기록 불러오는 중');
        return root;
      }
      if (status === 'error') {
        addText(root, '조회 상태', error?.code === 'CONTRACT_MISMATCH' ? '확인 불가: 기록을 불러오지 못했습니다' : '기록을 불러오지 못했습니다');
        addText(root, '오류 메시지', error?.message || '확인 불가');
        return root;
      }
      if (status !== 'ok' || !Array.isArray(data)) {
        addText(root, '조회 상태', '확인 불가: 기록을 불러오지 못했습니다');
        return root;
      }

      const events = [...data].sort((a, b) => {
        const left = Date.parse(a?.at);
        const right = Date.parse(b?.at);
        return (Number.isFinite(right) ? right : -Infinity) - (Number.isFinite(left) ? left : -Infinity);
      });
      if (events.length === 0) {
        addText(root, '조회 결과', '표시할 기록이 없습니다');
        return root;
      }

      const filters = document.createElement('div');
      const list = document.createElement('div');
      const count = document.createElement('p');
      const selects = {};
      const filterDefs = [
        ['kind', '기록 종류', event => event.kind],
        ['appId', '업무 앱', event => event.appId ?? ''],
        ['access', '접속 상태', event => event.state?.access],
      ];
      for (const [key, label, getter] of filterDefs) {
        const wrapper = document.createElement('div');
        const fieldLabel = document.createElement('label');
        fieldLabel.textContent = label;
        const select = document.createElement('select');
        fieldLabel.append(select);
        const all = document.createElement('option');
        all.value = 'all';
        all.textContent = '전체';
        select.append(all);
        const values = [...new Set(events.map(getter).filter(value => value != null))];
        for (const value of values) {
          const option = document.createElement('option');
          option.value = String(value);
          option.textContent = key === 'kind' ? description('kind', value)
            : key === 'access' ? description('access', value)
            : appLabel(value);
          select.append(option);
        }
        selects[key] = select;
        wrapper.append(fieldLabel);
        filters.append(wrapper);
      }

      const renderList = () => {
        list.replaceChildren();
        const filtered = events.filter(event =>
          (selects.kind.value === 'all' || String(event.kind) === selects.kind.value)
          && (selects.appId.value === 'all' || String(event.appId ?? '') === selects.appId.value)
          && (selects.access.value === 'all' || String(event.state?.access ?? '') === selects.access.value)
        );
        count.textContent = '표시 기록: ' + filtered.length + '건 / 조회 기록: ' + events.length + '건';
        if (filtered.length === 0) {
          addText(list, '필터 결과', '표시할 기록이 없습니다');
          return;
        }
        for (const event of filtered) {
          const item = document.createElement('section');
          item.setAttribute('data-student-event-id', String(event.id));
          addText(item, '사건 ID', event.id);
          addText(item, '시각', event.at);
          addText(item, '종류', description('kind', event.kind));
          addText(item, '업무 앱', appLabel(event.appId));
          addText(item, '요약', event.summary);
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = String(event.id) + ' 상세';
          const detail = document.createElement('div');
          detail.setAttribute('data-student-event-detail', String(event.id));
          detail.hidden = true;
          button.setAttribute('aria-expanded', 'false');
          button.addEventListener('click', () => {
            const opening = detail.hidden;
            detail.hidden = !opening;
            button.setAttribute('aria-expanded', String(opening));
          });
          addText(detail, '사건 ID', event.id);
          addText(detail, '업무 앱', appLabel(event.appId));
          for (const [title, entries] of [['근거', event.evidence], ['규칙', event.rules]]) {
            const group = document.createElement('section');
            const heading = document.createElement('h4');
            heading.textContent = title;
            group.append(heading);
            if (!Array.isArray(entries) || entries.length === 0) {
              addText(group, title, '없음');
            } else {
              for (const entry of entries) {
                addText(group, 'ID', entry?.id);
                addText(group, '내용', entry?.text);
              }
            }
            detail.append(group);
          }
          addText(detail, '접속 상태', description('access', event.state?.access));
          addText(detail, '세션 상태', description('session', event.state?.session));
          addText(detail, '기기 상태', description('device', event.state?.device));
          if (Array.isArray(event.supportedActions)) {
            for (const action of event.supportedActions) {
              const unsupported = document.createElement('button');
              unsupported.type = 'button';
              unsupported.disabled = true;
              unsupported.textContent = String(action) + ' 미지원';
              detail.append(unsupported);
              addText(detail, '조치 안내', '조치 실행 연결은 준비 중입니다. 요청을 전송하지 않습니다.');
            }
          }
          item.append(button, detail);
          list.append(item);
        }
      };
      for (const select of Object.values(selects)) select.addEventListener('change', renderList);
      root.append(filters, count, list);
      renderList();
      return root;
    },
    renderStatus({ devices, sessions, notifications, diagnostics, mode }) {
      const root = document.createElement('section');
      root.setAttribute('aria-label', '기기·세션·알림·도움정보');
      const addLine = (parent, name, value) => {
        const p = document.createElement('p');
        const strong = document.createElement('strong');
        strong.textContent = name + ': ';
        const span = document.createElement('span');
        span.textContent = String(value ?? '확인 불가');
        p.append(strong, span);
        parent.append(p);
      };
      const addSection = title => {
        const section = document.createElement('section');
        const heading = document.createElement('h3');
        heading.textContent = title;
        section.append(heading);
        root.append(section);
        return section;
      };
      const deviceLabels = {
        compliant: '보안 기준 충족',
        noncompliant: '보안 기준 미충족',
        unknown: '확인 불가',
      };
      const sessionLabels = {
        active: '활성',
        expired: '만료',
        revoked: '철회됨',
        unknown: '확인 불가',
      };
      const statusLabel = (labels, value) => {
        const code = value == null || value === '' ? 'unknown' : String(value);
        return (Object.hasOwn(labels, code) ? labels[code] : '확인 불가') + '(' + code + ')';
      };
      const retry = section => addLine(section, '다시 시도', '위쪽 다시 불러오기 버튼을 직접 누르세요. 자동으로 재요청하지 않습니다.');
      const renderResource = (title, resource, emptyText, rows, labels) => {
        const section = addSection(title);
        if (resource?.status === 'loading') {
          addLine(section, '조회 상태', '불러오는 중');
        } else if (resource?.status === 'error') {
          const timedOut = /TIMEOUT/i.test(String(resource.error?.code ?? ''));
          addLine(section, '조회 상태', title + (timedOut ? ' 조회 시간 초과' : ' 조회 실패'));
          addLine(section, '오류 메시지', resource.error?.message || '확인 불가');
          retry(section);
        } else if (resource?.status === 'ok') {
          if (!Array.isArray(resource.data)) {
            addLine(section, '조회 상태', '확인 불가: 응답 형식이 올바르지 않습니다.');
          } else if (resource.data.length === 0) {
            addLine(section, '조회 결과', emptyText);
          } else {
            addLine(section, '조회 결과', '조회된 항목 ' + resource.data.length + '건');
            for (const row of resource.data) {
              addLine(section, rows[0], row?.[rows[1]]);
              addLine(section, '상태', statusLabel(labels, row?.status));
            }
          }
        } else {
          addLine(section, '조회 상태', '확인 불가: 아직 조회되지 않았습니다.');
        }
      };

      if (mode === 'demo') addLine(root, '연결 모드', '예제 자료');
      else if (mode === 'disconnected') addLine(root, '연결 모드', '연결 없음');
      renderResource('등록 기기', devices, '등록된 기기가 없습니다.', ['기기', 'label'], deviceLabels);
      const sessionsSection = addSection('세션 조회 범위');
      addLine(sessionsSection, '조회 범위', '현재 검증된 연결 한 개만 조회합니다. 과거 세션 전체 목록이 아닙니다.');
      renderResource('현재 세션', sessions, '현재 연결이 없습니다.', ['세션 ID', 'id'], sessionLabels);

      const alerts = addSection('알림');
      if (!Array.isArray(notifications)) {
        addLine(alerts, '알림 상태', '확인 불가');
      } else if (notifications.length === 0) {
        addLine(alerts, '알림 상태', '주의할 알림이 없습니다.');
      } else {
        for (const notification of notifications) {
          const item = document.createElement('div');
          addLine(item, '자료(resource)', notification?.resource);
          addLine(item, '코드(code)', notification?.code);
          addLine(item, '메시지', notification?.message);
          alerts.append(item);
        }
      }

      const diagSection = addSection('도움정보');
      const diagKeys = [
        ['requestId', '요청 ID'],
        ['component', '구성 요소'],
        ['version', '버전'],
        ['checkedAt', '확인 시각'],
        ['engine.mode', '엔진 모드'],
        ['engine.code', '엔진 코드'],
      ];
      if (diagnostics?.status === 'loading') {
        addLine(diagSection, '조회 상태', '도움정보 불러오는 중');
      } else if (diagnostics?.status === 'error') {
        const timedOut = /TIMEOUT/i.test(String(diagnostics.error?.code ?? ''));
        addLine(diagSection, '조회 상태', timedOut ? '도움정보 조회 시간 초과' : '도움정보 조회 실패');
        addLine(diagSection, '오류 메시지', diagnostics.error?.message || '확인 불가');
        retry(diagSection);
      } else if (diagnostics?.status === 'ok' && diagnostics.data && typeof diagnostics.data === 'object') {
        const safeData = {
          requestId: diagnostics.data.requestId,
          component: diagnostics.data.component,
          version: diagnostics.data.version,
          checkedAt: diagnostics.data.checkedAt,
          'engine.mode': diagnostics.data.engine?.mode,
          'engine.code': diagnostics.data.engine?.code,
        };
        const copyLines = [];
        for (const [key, label] of diagKeys) {
          const value = safeData[key] == null ? '확인 불가' : String(safeData[key]);
          addLine(diagSection, label + ' (' + key + ')', value);
          copyLines.push(key + ': ' + value);
        }
        addLine(diagSection, '복사 안내', '도움 요청에 필요한 위의 점검 정보만 복사합니다.');
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = '도움정보 복사';
        const feedback = document.createElement('p');
        feedback.setAttribute('role', 'status');
        button.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(copyLines.join('\n'));
            feedback.textContent = '도움정보를 클립보드에 복사했습니다.';
          } catch {
            feedback.textContent = '클립보드 복사에 실패했습니다. 브라우저 권한을 확인하세요.';
          }
        });
        diagSection.append(button, feedback);
      } else {
        addLine(diagSection, '조회 상태', '도움정보 확인 불가');
      }
      return root;
    },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection({ status, mode, data, error, checkedAt, explanationAccepted }) {
      const root = document.createElement('section');
      root.setAttribute('aria-label', 'AI 연결 점검 결과');
      const addLine = (label, value) => {
        const line = document.createElement('p');
        const heading = document.createElement('strong');
        heading.textContent = label + ': ';
        const text = document.createElement('span');
        text.textContent = String(value ?? '확인 불가');
        line.append(heading, text);
        root.append(line);
      };
      const errorGuidance = {
        ON_AI_PROVISIONING_PENDING: '담당자에게 계정 연결과 앱 전용 AI 이용 권한 확인을 요청하세요.',
        ON_AI_TRANSPORT_PENDING: 'AI 연결 준비 중입니다. 담당자에게 연결 상태를 확인하세요.',
        ON_AI_AUTHORIZATION_CHANGED: '이용 권한이 변경되었습니다. 담당자에게 현재 권한을 확인한 뒤 직접 다시 점검하세요.',
        WB_CLCO_AUTH_REQUIRED: '계정 연결과 앱 이용 인증 상태를 다시 확인하고 담당자에게 문의하세요.',
        WB_CLCO_ACCESS_BLOCKED: '앱 AI 접근이 제한되었습니다. 담당자에게 이용 권한을 확인하세요.',
        WB_CLCO_COHORT_BUDGET_EXHAUSTED: '반의 AI 사용량이 소진되었습니다. 담당자에게 확인하세요.',
        WB_CLCO_LIMIT_REACHED: 'AI 이용 한도에 도달했습니다. 담당자에게 확인하세요.',
        WB_CLCO_SESSION_CLOSED: '현재 AI 이용 시간이 아닙니다. 이용 가능 시간을 확인하세요.',
        WB_CLCO_RATE_LIMITED: 'AI 요청이 제한되었습니다. 잠시 뒤 버튼을 직접 눌러 다시 점검하세요.',
        WB_CLCO_TIMEOUT: 'AI 요청 시간이 초과되었습니다. 잠시 뒤 직접 다시 점검하세요.',
        REQUEST_TIMEOUT: '요청 처리 시간이 초과되었습니다. 잠시 뒤 직접 다시 점검하세요.',
        WB_CLCO_SERVER_UNAVAILABLE: 'AI 서버에 연결할 수 없습니다. 잠시 뒤 직접 다시 점검하세요.',
        SERVICE_UNAVAILABLE: '서비스 연결 상태를 확인할 수 없습니다. 잠시 뒤 직접 다시 점검하세요.',
        REQUEST_CANCELLED: '점검이 취소되었습니다. 이전 결과는 현재 결과가 아닙니다.',
        WB_CLCO_CANCELLED: '점검이 취소되었습니다. 이전 결과는 현재 결과가 아닙니다.',
        ON_AI_MODEL_LIST_EMPTY: '현재 이용 가능한 AI 모델이 없습니다. 담당자에게 모델 허용 설정을 확인하세요.',
        MODEL_NOT_CONFIGURED: '앱 서버에 허용된 AI 모델이 설정되지 않았습니다. 담당자에게 확인하세요.',
      };
      if (mode === 'demo') addLine('연결 모드', '예제 자료');
      else if (mode === 'disconnected') addLine('연결 모드', '연결 없음');
      else if (mode === 'unknown') addLine('연결 모드', '확인 불가');
      if (status === 'idle') {
        addLine('점검 상태', 'AI 연결 점검 전');
      } else if (status === 'loading') {
        addLine('점검 상태', 'AI 연결 점검 중');
      } else if (status === 'ok') {
        const authorization = data?.audienceAuthorization;
        const authorizationLabel = authorization === 'test'
          ? '시험 연결 점검(test)'
          : authorization === 'verified'
            ? '앱 권한 확인 후 점검(verified)'
            : '권한 확인 불가';
        addLine('점검 상태', 'AI 연결 점검 결과');
        addLine('앱 권한 확인', authorizationLabel);
        addLine('전송 연결 확인', data?.transportChecked === true ? '확인됨' : '확인 불가');
        addLine('모델 수', data?.modelCount);
        addLine('점검 시각', checkedAt);
        addLine('사건 설명', '연결 점검과 사건 설명 실행은 별개입니다. 사건 설명은 아직 실행하지 않았습니다.');
      } else if (status === 'error') {
        const code = typeof error?.code === 'string' ? error.code : 'UNKNOWN';
        addLine('점검 상태', 'AI 연결 점검 실패');
        addLine('오류 코드', code);
        addLine('오류 메시지', error?.message || '확인 불가');
        addLine('안내', Object.hasOwn(errorGuidance, code)
          ? errorGuidance[code]
          : '원인을 확인할 수 없습니다. 담당자에게 오류 코드와 연결 상태를 확인하세요.');
        addLine('사건 설명', 'AI 연결 점검 실패는 사건 설명 실행 결과가 아닙니다.');
      } else {
        addLine('점검 상태', '확인 불가');
      }
      if (status !== 'loading') addLine('수동 재점검', '다시 점검하려면 제공 화면의 점검 버튼을 직접 누르세요. 자동으로 재요청하지 않습니다.');
      return root;
    },
    renderExplanation({ event, explanation, checkedAt }) {
      const root = document.createElement('section');
      root.setAttribute('aria-label', '보안 사건 AI 설명');
      const addLine = (label, value) => {
        const line = document.createElement('p');
        const heading = document.createElement('strong');
        heading.textContent = label + ': ';
        const text = document.createElement('span');
        text.textContent = String(value ?? '확인 불가');
        line.append(heading, text);
        root.append(line);
      };
      if (explanation?.status === 'ok' && event?.id != null) {
        root.setAttribute('data-student-explanation-event', String(event.id));
        addLine('사건 ID', event.id);
        addLine('AI 설명 요약', explanation.data?.summary);
        addLine('설명 확인 시각', checkedAt);
      } else if (explanation?.status === 'error') {
        addLine('설명 상태', 'AI 사건 설명 요청 실패');
        addLine('오류 코드', explanation.error?.code || 'UNKNOWN');
        addLine('오류 메시지', explanation.error?.message || '확인 불가');
        addLine('기록 상태', '기존 보안 기록은 그대로 유지됩니다.');
      } else if (explanation?.status === 'loading') {
        addLine('설명 상태', 'AI 사건 설명 요청 중');
      } else {
        addLine('설명 상태', 'AI 사건 설명 실행 전');
      }
      return root;
    },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
