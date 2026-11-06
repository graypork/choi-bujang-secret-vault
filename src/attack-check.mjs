// The student changes this check as each stage adds an attack to the same app.
// Never return tokens, private keys, real names, or note bodies.
function deploymentUrl(config) {
  let app;
  try {
    app = new URL(config.publicAppUrl);
  } catch {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (app.protocol !== 'https:' || app.username || app.password || app.search || app.hash
      || app.pathname !== '/' || app.hostname.endsWith('.example')) {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  return app;
}

async function publicJson(path, app) {
  const response = await fetch(new URL(path, app), {
    redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  let data = null;
  if (response.ok) {
    try {
      data = await response.json();
    } catch {
      // A non-JSON response is recorded as an unsuccessful read.
    }
  }
  return { response, data };
}

export async function runAttackChecks(config) {
  if (config.step === 12) {
    // Each observed HTTP status must come from its own actual GET.
    // A failed/unissued request is not evidence of an HTTP response.
    const checks = [
      {
        attackId: 'anonymous_static_note_read',
        path: '/data.json',
        expected: '비로그인 /data.json에서 가상 메모가 노출되지 않음',
      },
      {
        attackId: 'anonymous_server_note_read',
        path: '/api/notes',
        expected: '비로그인 /api/notes는 401 또는 403으로 거부됨',
      },
      {
        attackId: 'anonymous_device_status',
        path: '/api/device/status',
        expected: '비로그인 /api/device/status는 인증 오류로 거부됨',
      },
      {
        attackId: 'public_app_manifest',
        path: '/manifest.webmanifest',
        expected: '공개 앱 매니페스트 GET은 200으로 허용됨',
      },
    ];
    let app;
    try {
      app = deploymentUrl(config);
    } catch {
      return checks.map(({ attackId, expected }) => ({
        attackId, expected, observed: 'not_run',
      }));
    }
    const attempts = [];
    for (const { attackId, path, expected } of checks) {
      let observed = 'not_run';
      try {
        const { response, data } = await publicJson(path, app);
        // Only the actual HTTP response is evidence of this GET.
        // x-vercel-id is NOT the judge's caseId or requestKey.
        observed = `GET ${path} HTTP ${response.status}; judge_caseId=unverified; judge_requestKey=unverified`;
        const requestId = response.headers.get('x-vercel-id');
        if (requestId && /^[a-zA-Z0-9:._-]{1,120}$/u.test(requestId)) {
          observed += `; x-vercel-id=${requestId}`;
        }
        if (path === '/data.json' && response.ok) {
          const visible = data?.sampleMarker === config.sampleMarker
            && Array.isArray(data.notes) && data.notes.length > 0;
          observed += visible ? '; 가상 메모 표시 노출' : '; 가상 메모 표시 미확인';
        }
        // Never invent a judge caseId/requestKey or claim a judge log match.
      } catch {
        // Network errors, redirects, and timeouts have no observed HTTP status.
      }
      attempts.push({ attackId, expected, observed });
    }
    return attempts;
  }
  if (config.step !== 1 && config.step !== 2) {
    throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
  }
  const app = deploymentUrl(config);
  if (typeof config.sampleMarker !== 'string' || !config.sampleMarker) {
    throw new Error('가상 메모의 확인 표시를 넣어 주세요.');
  }

  const { response: staticResponse, data: staticData } = await publicJson('/data.json', app);
  const staticVisible = staticData?.sampleMarker === config.sampleMarker
    && Array.isArray(staticData.notes) && staticData.notes.length > 0;

  if (config.step === 1) {
    return [{ attackId: 'anonymous_note_read', expected: '비로그인 화면에서 가상 메모를 확인',
      observed: staticVisible ? '비로그인 요청에서 공개 가상 메모 확인 표시가 보임'
        : `비로그인 요청에서 확인 표시가 보이지 않음 (HTTP ${staticResponse.status})` }];
  }

  const { response: apiResponse, data: apiData } = await publicJson('/api/notes', app);
  const apiCount = Array.isArray(apiData?.notes) ? apiData.notes.length : null;

  return [
    {
      attackId: 'anonymous_static_note_read',
      expected: '비로그인 /data.json에서 가상 메모를 읽지 못함',
      observed: staticVisible
        ? `비로그인 /data.json에서 가상 메모 확인 표시가 보임 (HTTP ${staticResponse.status})`
        : `비로그인 /data.json에서 가상 메모 확인 표시가 보이지 않음 (HTTP ${staticResponse.status})`,
    },
    {
      attackId: 'anonymous_server_note_read',
      expected: '인증 없는 /api/notes 공개 접근 상태를 확인',
      observed: apiCount === null
        ? `비로그인 /api/notes 요청 결과 HTTP ${apiResponse.status}`
        : `비로그인 /api/notes 요청이 성공했고 가상 메모 ${apiCount}건이 반환됨 (HTTP ${apiResponse.status})`,
    },
  ];
}
