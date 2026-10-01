'use client';
import {createContext,useContext,useState,useEffect,type ReactNode} from 'react';
import dictionary from '@/lib/ui-translations.json';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
type Locale='ko'|'zh'|'en';
const Context=createContext<{locale:Locale,setLocale:(locale:Locale)=>void}>({locale:'ko',setLocale:()=>{}});
export function translate(text:string,locale:Locale){return locale==='ko'?text:((dictionary as Record<string,Partial<Record<Locale,string>>>)[text.trim()]?.[locale] ? (text.match(/^\s*/)?.[0]||'')+(dictionary as Record<string,Partial<Record<Locale,string>>>)[text.trim()][locale]+(text.match(/\s*$/)?.[0]||'') : text)}
export function UiLanguageProvider({children,initialLocale='ko'}:{children:ReactNode,initialLocale?:Locale}){
 const [locale,setLocale]=useState<Locale>(initialLocale);
 useEffect(()=>{try{const saved=localStorage.getItem('studio-ui-language');if(saved==='en'||saved==='zh')setLocale(saved)}catch{}},[]);
 useEffect(()=>{document.documentElement.lang=locale==='zh'?'zh-Hans':locale},[locale]);
 return <Context.Provider value={{locale,setLocale:(value)=>{setLocale(value);try{localStorage.setItem('studio-ui-language',value)}catch{}}}}>{children}</Context.Provider>
}
export function useTranslate(){const {locale}=useContext(Context);return (value:string)=>translate(value,locale)}
export function UiText({children}:{children:ReactNode}){const t=useTranslate();return <>{typeof children==='string'?t(children):children}</>}
export function UiLanguagePicker(){const {locale,setLocale}=useContext(Context);return <Select value={locale} onValueChange={v=>setLocale(v as Locale)}><SelectTrigger aria-label={translate('UI 언어',locale)} className="ui-language"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="ko">한국어</SelectItem><SelectItem value="zh">简体中文</SelectItem><SelectItem value="en">English</SelectItem></SelectContent></Select>}
