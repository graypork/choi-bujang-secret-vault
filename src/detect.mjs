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
  // 현재 단계는 입력 검증만 수행합니다. 사건 원본이나 가명 사용자 ID도 출력·저장하지 않습니다.
  for (const event of events) readEvent(event);
  return { action: 'observe' };
}
