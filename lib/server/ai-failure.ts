import {z} from 'zod';
export const aiFailures={
 AI_NOT_CONFIGURED:'AI 설정을 확인해 주세요. 서버 재시작 후 다시 확인해 주세요.',
 AI_AUTH_FAILED:'AI API 키 인증에 실패했습니다. 서버의 비밀키를 확인해 주세요.',
 AI_PERMISSION_DENIED:'AI 생성 권한이 거절되었습니다. 프로젝트와 API 키 권한을 확인해 주세요.',
 AI_BILLING_QUOTA:'AI 제공자의 사용 가능 크레딧 또는 결제 한도를 확인해 주세요.',
 AI_RATE_LIMIT:'AI 제공자의 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.',
 AI_REQUEST_INVALID:'AI 제공자가 생성 요청 형식을 거절했습니다. 요청 옵션을 점검해야 합니다.',
 AI_MODEL_UNAVAILABLE:'설정한 AI 모델의 생성 접근 권한을 확인해 주세요.',
 AI_PROVIDER_FAILED:'AI 제공자에서 오류가 발생했습니다. 잠시 후 상태를 확인해 주세요.',
 AI_REQUEST_FAILED:'AI 연결에 실패했습니다. 연결 상태를 확인해 주세요.',
 AI_TIMEOUT:'AI 응답 시간이 초과되었습니다. 자동으로 재요청하지 않습니다.',
 AI_OUTPUT_INVALID:'AI 응답 형식이 올바르지 않아 저장하지 않았습니다.',
 AI_OUTPUT_TRUNCATED:'AI 응답이 출력 길이 제한으로 중단되어 저장하지 않았습니다.',
 AI_REFUSAL:'AI 제공자가 이 생성 요청에 대한 응답을 거절했습니다.',
 AI_SOURCE_INVALID:'AI 응답의 출처가 입력 자료와 일치하지 않아 저장하지 않았습니다.',
 AI_UNSUPPORTED_NUMBER:'입력 자료에 없는 수치가 AI 응답에 포함되어 저장하지 않았습니다.',
 AI_UNSUPPORTED_CLAIM:'확인되지 않은 주장이 AI 응답에 포함되어 저장하지 않았습니다.',
 AI_INTERRUPTED:'AI 작업이 중단되었습니다. 자동으로 재요청하지 않습니다.',
 GENERATION_FAILED:'생성에 실패했습니다. 안전한 진단 기록을 확인해 주세요.'
} as const;
export function safeAiCode(error:unknown):keyof typeof aiFailures{
 if(error instanceof z.ZodError)return 'AI_OUTPUT_INVALID';
 const value=error instanceof Error?error.message:error;
 return typeof value==='string'&&Object.hasOwn(aiFailures,value)?value as keyof typeof aiFailures:'GENERATION_FAILED';
}
export function aiFailureMessage(error:unknown){return aiFailures[safeAiCode(error)];}
