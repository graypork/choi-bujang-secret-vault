// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기입니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
export const RULE_IDS = Object.freeze(['device_registered']);

// 판정기 계약의 signals만 검사합니다. 브라우저 헤더나 임의의 기본값을 사용하지 않습니다.
// judge_fixture는 로컬/심판 가상 신호일 뿐 실제 위치·네트워크 증거가 아닙니다.
export function inspectConnectionSignals(request) {
  const signals = request?.signals;
  const source = signals && typeof signals === 'object' && !Array.isArray(signals)
    ? signals.source : undefined;
  const fixture = source === 'judge_fixture';
  const region = typeof signals?.region === 'string' && signals.region.trim()
    ? signals.region : 'unknown';
  const network = typeof signals?.network === 'string' && signals.network.trim()
    ? signals.network : 'unknown';
  const hour = Number.isInteger(signals?.hour) && signals.hour >= 0 && signals.hour <= 23
    ? signals.hour : null;
  const recentEvents = Array.isArray(request?.recentEvents) ? request.recentEvents : [];
  const events = recentEvents.length <= 12 && recentEvents.every(event =>
    event && typeof event === 'object' && !Array.isArray(event)
    && typeof event.kind === 'string' && event.kind.length > 0
    && Number.isFinite(event.ageSeconds) && event.ageSeconds >= 0
    && Number.isInteger(event.count) && event.count >= 0)
    ? recentEvents : null;

  return {
    source: source === 'none' || fixture ? source : 'unknown',
    trustedConnectionEvidence: false,
    region: fixture ? region : 'unknown',
    network: fixture ? network : 'unknown',
    hour: fixture ? hour : null,
    recentEvents: events,
  };
}

export async function decide(request) {
  const registered = request.deviceRegistered === true;
  return {
    schema: 'aleph.decision.v1',
    requestId: request.requestId,
    decision: registered ? 'allow' : 'deny',
    reasonCode: registered ? 'approved' : 'device_not_registered',
    ruleIds: [RULE_IDS[0]],
  };
}
