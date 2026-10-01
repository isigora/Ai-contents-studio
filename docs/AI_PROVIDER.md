# AI 제공자 어댑터 계약

현재 기본 생성은 외부 API를 호출하지 않는다. 유료 활성화는 명세의 승인 경계를 따른다.

운영자가 설정한 HTTPS `AI_PROVIDER_URL`에 POST한다. 서버의 Authorization Bearer를 사용하며 30초 타임아웃, 리다이렉트 금지, 결과 크기 한도를 적용한다.

요청: `{model,task:"grounded-content-v1",instructions,settings,facts,source_ids}`.
응답: `{headline:string,sections:[{heading:string,body:string}],cta:string,used_source_ids:string[],unsupported_claims:string[],missing_facts:string[]}`.

이것은 특정 제공자의 원래 API 규격이 아니다. 운영자는 선택한 모델 API를 위 규격으로 연결하는 서버 어댑터를 배치해야 한다. 실제 유료 제공자는 연결·검증하지 않았다.

구조, source_ids, 새로운 숫자, 민감 표현을 검사하며 오류 시 초안을 저장하지 않고 failed로 기록한다. 모든 의미상 허위 주장을 잡아내는 검증 체계는 아니며 사용자 검토가 필요하다.

`AI_RUN_RESERVATION_USD`를 요청마다 예약해 합계가 `AI_DAILY_LIMIT_USD`를 넘으면 차단한다. 실제 토큰 정산이 아니므로 제공자 지출 한도와 최대 출력 토큰도 별도로 설정해야 한다. 실제 실패에도 비용이 발생할 수 있어 예약은 자동 환급하지 않는다.

선택한 회사·제품·고객·근거만 전송한다. 원본 파일, 인증 정보, 다른 작업공간 자료는 전송하지 않는다.
