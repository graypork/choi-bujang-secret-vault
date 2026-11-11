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
          item.append(button, detail);
          list.append(item);
        }
      };
      for (const select of Object.values(selects)) select.addEventListener('change', renderList);
      root.append(filters, count, list);
      renderList();
      return root;
    },
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
