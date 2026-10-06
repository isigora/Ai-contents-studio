import {z} from 'zod';
export const interpretationInputSchema=z.object({source:z.string().trim().min(1).max(12000),consent:z.literal(true)}).strict();
const candidate=(max:number)=>z.object({value:z.string().trim().min(1).max(max),quote:z.string().trim().min(1).max(4000)}).strict().nullable();
export const interpretationSchema=z.object({
 name:candidate(180),summary:candidate(4000),audience:candidate(160),cta:candidate(500),
 kind:z.enum(['product','service']).nullable(),questions:z.array(z.string().trim().min(1).max(500)).max(8)
}).strict();
export type Interpretation=z.infer<typeof interpretationSchema>;
export const intakeFields=['name','summary','audience','cta'] as const;
