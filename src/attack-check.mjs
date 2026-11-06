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
    // The judge did not confirm any corresponding caseId/requestKey.
    // Do not send requests or claim HTTP outcomes for unverified cases.
    const attackIds = [
      "anonymous_static_data_read",
      "anonymous_list_read",
      "anonymous_note_create",
      "anonymous_note_update_delete",
      "anon_data_api_read",
      "anon_data_api_delete",
      "cross_owner_access",
      "screen_has_no_public_key",
      "device_rule_local",
      "step_up_cases_local",
      "relogin_block_not_run",
      "anonymous_other_zone_api",
      "zone_rules_local",
      "other_zone_authenticated_api",
      "burst_read_local",
      "revocation_not_run",
      "policy_and_memo_restore",
      "anonymous_device_api",
      "anonymous_ops_api",
      "ops_live_and_judge_suite_not_run"
];
    return attackIds.map((attackId) => ({
      attackId,
      expected: '해당 점검의 실제 요청과 결과를 심판 기록으로 확인',
      observed: 'not_run',
    }));
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
