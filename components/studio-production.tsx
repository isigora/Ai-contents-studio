'use client';
import {UiText,useTranslate} from '@/components/ui-language';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
const states: Record<string, string> = { draft: '초안', pending: '승인 대기', approved: '승인됨', changes_requested: '수정 요청' };
const actions: Record<string, string> = { submit: '승인 요청', approve: '승인', request_changes: '수정 요청', withdraw: '회수', invalidate: '편집으로 승인 초기화' };
async function request(url: string, body?: unknown, key?: string) { const r = await fetch('/api/' + url, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) } : {}, body: body ? JSON.stringify(body) : undefined }); const data: any = await r.json(); if (!r.ok)
    throw new Error(data.error?.message || '요청 실패'); return data; }
export function ReviewPanel({ wid, detail, role, onOpen }: {
    wid: string;
    detail: any;
    role: string;
    onOpen: (id: string) => Promise<void>;
}) {
    const [note, setNote] = useState(''), [busy, setBusy] = useState(false);
    const state = detail.workflow?.state || 'draft', canEdit = role !== 'viewer';
    const run = async (action: string) => { setBusy(true); try {
        await request(`workspaces/${wid}/contents/${detail.id}/review`, { action, version: detail.current_version, note });
        setNote('');
        await onOpen(detail.id);
        toast.success('검토 상태를 저장했습니다.');
    }
    catch (e) {
        toast.error((e as Error).message);
    }
    finally {
        setBusy(false);
    } };
    return <section className="production-panel"><div className="result-heading"><strong><UiText>{states[state]}</UiText><UiText>{" · 버전 "}</UiText><UiText>{detail.current_version}</UiText></strong><span className="small muted"><UiText>{"공개 게시와 별개"}</UiText></span></div><p className="small muted"><UiText>{"저장된 현재 버전을 검토합니다. 소유자가 승인하며, 승인 후 편집하면 새 초안으로 돌아갑니다. 이전 승인 기록은 보존됩니다."}</UiText></p><UiText>{detail.stale && <p className="notice warning"><UiText>{"원천 정보가 바뀌었습니다. 새 정보로 재생성한 뒤 승인하세요."}</UiText></p>}</UiText><label className="field"><span><UiText>{"검토 메모"}</UiText></span><textarea value={note} onChange={e => setNote(e.target.value)} maxLength={1000} rows={3} disabled={!canEdit || busy}/></label><div className="action-row"><UiText>{canEdit && ['draft', 'changes_requested'].includes(state) && <button className="button primary" disabled={busy} onClick={() => run('submit')}><UiText>{"승인 요청"}</UiText></button>}</UiText><UiText>{role === 'owner' && state === 'pending' && <><button className="button primary" disabled={busy || detail.stale} onClick={() => run('approve')}><UiText>{"이 버전 승인"}</UiText></button><button className="button" disabled={busy || !note.trim()} onClick={() => run('request_changes')}><UiText>{"수정 요청"}</UiText></button></>}</UiText><UiText>{canEdit && ['pending', 'approved'].includes(state) && <button className="button" disabled={busy} onClick={() => run('withdraw')}><UiText>{"승인·요청 회수"}</UiText></button>}</UiText></div><h3 className="minor-heading"><UiText>{"검토 이력"}</UiText></h3><UiText>{!detail.reviews?.length && <p className="small muted"><UiText>{"아직 검토 이력이 없습니다."}</UiText></p>}</UiText><UiText>{detail.reviews?.map((r: any, i: number) => <div className="source-block" key={i}><strong><UiText>{actions[r.action]}</UiText><UiText>{" · 버전 "}</UiText><UiText>{r.version}</UiText></strong><p>{r.note || '메모 없음'}</p><small><UiText>{new Date(r.created_at).toLocaleString('ko-KR')}</UiText></small></div>)}</UiText></section>;
}
export function ReuseButton({ wid, detail, version, disabled, onOpen }: {
    wid: string;
    detail: any;
    version: number;
    disabled: boolean;
    onOpen: (id: string) => Promise<void>;
}) {
    const [busy, setBusy] = useState(false);
    return <button className="button" disabled={disabled || busy} onClick={async () => { setBusy(true); try {
        const copy = await request(`workspaces/${wid}/contents/${detail.id}/reuse`, { version });
        await onOpen(copy.id);
        toast.success('선택한 버전을 별도 초안으로 복제했습니다.');
    }
    catch (e) {
        toast.error((e as Error).message);
    }
    finally {
        setBusy(false);
    } }}><UiText>{"별도 초안으로 재사용"}</UiText></button>;
}
export function MediaPanel({ wid, detail, assets, canEdit }: {
    wid: string;
    detail: any;
    assets: any[];
    canEdit: boolean;
}) {
    const t=useTranslate();
    const [assetId, setAssetId] = useState(''), [kind, setKind] = useState('cards'), [scenes, setScenes] = useState(['', '', '']), [jobs, setJobs] = useState<any[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
    useEffect(() => { let current = true; const lines = detail.latest.body.split('\n').map((s: string) => s.trim()).filter(Boolean); setScenes([detail.latest.title.slice(0, 160), (lines.find((l: string) => l !== detail.latest.title && l.length > 20) || lines[1] || detail.latest.title).slice(0, 160), (lines.at(-1) || detail.latest.title).slice(0, 160)]); setAssetId(''); setError(''); request(`workspaces/${wid}/media`).then(rows => { if (current)
        setJobs(rows.filter((j: any) => j.content_id === detail.id)); }).catch(e => { if (current)
        setError(e.message); }); return () => { current = false; }; }, [wid, detail.id, detail.current_version]);
    const make = async () => { setBusy(true); setError(''); try {
        const job = await request(`workspaces/${wid}/media`, { content_id: detail.id, version: detail.current_version, asset_id: assetId, kind, scenes }, crypto.randomUUID());
        setJobs(list => [job, ...list]);
        toast.success('미디어 제작물을 저장했습니다.');
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } };
    return <section className="production-panel"><p className="notice"><UiText>{"저장된 버전 "}</UiText><UiText>{detail.current_version}</UiText><UiText>{" 에서 문구를 발췌합니다. 미디어는 별도 검토가 필요한 초안이며 DRAFT 표시가 들어갑니다. 생성형 이미지·음성·외부 게시 기능은 사용하지 않습니다."}</UiText></p><label className="field"><span><UiText>{"보유 사진"}</UiText></span><Select value={assetId || undefined} onValueChange={setAssetId}><SelectTrigger className="pick"><SelectValue placeholder={t("사용권 메모가 있는 사진 선택")}/></SelectTrigger><SelectContent><UiText>{assets.filter(a => a.status === 'ready' && a.mime === 'image/png' && a.rights_note?.trim()).map(a => <SelectItem value={a.id} key={a.id}>{a.name}</SelectItem>)}</UiText></SelectContent></Select></label><p className="small muted"><UiText>{"자산 메뉴에서 직접 보유한 사진과 사용권·출처 메모를 먼저 등록하세요."}</UiText></p><label className="field"><span><UiText>{"내보내기 형식"}</UiText></span><Select value={kind} onValueChange={setKind}><SelectTrigger className="pick"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cards"><UiText>{"정사각·세로 PNG 카드"}</UiText></SelectItem><SelectItem value="video"><UiText>{"PNG 카드 + 9초 무음 MP4 + SRT"}</UiText></SelectItem></SelectContent></Select></label><UiText>{['제목 / 장면 1', '설명 / 장면 2', '다음 행동 / 장면 3'].map((label, i) => <label className="field" key={i}><span><UiText>{label}</UiText></span><input value={scenes[i]} maxLength={160} onChange={e => setScenes(s => s.map((v, n) => n === i ? e.target.value : v))}/><small><UiText>{"저장된 제목·본문의 구절을 그대로 선택하세요. 최대 160자."}</UiText></small></label>)}</UiText><UiText>{error && <p className="notice error" role="alert"><UiText>{error}</UiText></p>}</UiText><button className="button primary" disabled={!canEdit || busy || !assetId || scenes.some(s => !s.trim())} onClick={make}><UiText>{busy ? '제작 중… (영상은 최대 2분)' : '미디어 제작·저장'}</UiText></button><h3 className="minor-heading"><UiText>{"이 콘텐츠의 제작 이력"}</UiText></h3><UiText>{jobs.map(job => <div className="source-block" key={job.id}><strong><UiText>{"버전 "}</UiText><UiText>{job.version}</UiText> · <UiText>{job.status === 'succeeded' ? '제작 완료' : job.status === 'failed' ? '실패' : '처리 중'}</UiText></strong><p className="small muted"><UiText>{job.manifest.scenes?.join(' / ')}</UiText></p><div className="action-row"><UiText>{job.manifest.files?.map((file: any) => <a key={file.name} className="button" href={`/api/workspaces/${wid}/media/${job.id}/download?file=${encodeURIComponent(file.name)}`}>{file.name}</a>)}</UiText></div><UiText>{job.error_code && <p className="small muted"><UiText>{"실패한 작업은 새 요청으로 다시 제작할 수 있습니다."}</UiText></p>}</UiText></div>)}</UiText></section>;
}
