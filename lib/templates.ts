export const channels = {
 general:{label:'일반',formats:['page','social','email','ad','proposal','video_script']},
 website:{label:'웹사이트',formats:['page','ad','proposal']},
 instagram:{label:'Instagram',formats:['social','ad','video_script']},
 wechat:{label:'微信',formats:['social','page','video_script']},
 linkedin:{label:'LinkedIn',formats:['social','email','proposal']},
 email:{label:'이메일',formats:['email']},
} as const;
export type Channel=keyof typeof channels;
export const templateVersion='channels-v1';
// Editorial targets, not claims about platform API limits. No account connection.
export const channelTargets:Record<Channel,number>={general:20000,website:12000,instagram:1800,wechat:4000,linkedin:2500,email:3000};
export function channelAdvice(channel:Channel,language:'ko'|'zh'|'en'){
 const copy={ko:{general:'선택한 형식에 맞춘 기본 문안',website:'문제·해결·근거·행동을 구분한 웹 문안',instagram:'첫 문장과 하나의 다음 행동에 집중한 짧은 문안',wechat:'설명과 이용 방법을 순서대로 담은 문안',linkedin:'고객 상황·업무 가치·확인된 근거 중심 문안',email:'짧은 제안과 명확한 회신 행동 중심 문안'},zh:{general:'按所选形式组织内容',website:'需求、方案、依据与行动分段呈现',instagram:'聚焦开头和一个下一步行动',wechat:'依次介绍内容与使用方法',linkedin:'聚焦客户情况、业务价值与依据',email:'简明提案与明确的回复行动'},en:{general:'Copy arranged for the chosen format',website:'Separate need, solution, evidence and action',instagram:'A concise opening and one next action',wechat:'Explain the offer and how it works in sequence',linkedin:'Customer context, business value and evidence',email:'A brief proposal with a clear reply action'}};
 return copy[language][channel];
}
