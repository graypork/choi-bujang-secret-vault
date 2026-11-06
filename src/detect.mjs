// 9단계 로컬 사건 입력 계약: at, method, identity.sub만 읽습니다.
// 반 엔진이 검증한 사건만 전달해야 하며 브라우저가 보낸 사용자 번호는 신뢰하지 않습니다.
// 토큰, 메모 본문, 실명, 기기·지역·네트워크 정보는 읽거나 기록하지 않습니다.
function readEvent(event) {
  if (event === null || typeof event !== 'object' || Array.isArray(event)) {
    throw new TypeError('invalid_detection_event');
  }
  const { at, method, identity } = event;
  const sub = identity !== null && typeof identity === 'object' && !Array.isArray(identity)
    ? identity.sub : undefined;
  if (typeof at !== 'string' || !Number.isFinite(Date.parse(at))
      || typeof method !== 'string' || method.length === 0
      || typeof sub !== 'string' || sub.length === 0) {
    throw new TypeError('invalid_detection_event');
  }
  return { at, method, sub };
}

export function detect(events) {
  if (!Array.isArray(events)) throw new TypeError('invalid_detection_events');
  // 사건마다 계약된 세 필드만 읽고, GET 시각을 가명 사용자별로 분리합니다.
  const readsBySubject = new Map();
  for (const event of events) {
    const { at, method, sub } = readEvent(event);
    if (method !== 'GET') continue;
    if (!readsBySubject.has(sub)) readsBySubject.set(sub, []);
    readsBySubject.get(sub).push(Date.parse(at));
  }

  // 고정된 10분 버킷이 아닌, 어느 시작 시각에서든 10분 안의 GET을 셉니다.
  const windowMs = 10 * 60 * 1000;
  for (const [sub, times] of readsBySubject) {
    times.sort((a, b) => a - b);
    let left = 0;
    for (let right = 0; right < times.length; right++) {
      while (times[right] - times[left] >= windowMs) left++;
      if (right - left + 1 > 120) {
        return { action: 'propose_revocation', reasonCode: 'burst_read', subject: sub };
      }
    }
  }
  return { action: 'observe' };
}
