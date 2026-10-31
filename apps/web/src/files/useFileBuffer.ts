import {useEffect, useRef, useState} from 'react';
import {prepareFile, bufferTarget} from './preparation';
import type {PreparedFile} from './preparation';
import type {LocalFile} from './engine';

export function useFileBuffer(files: readonly {handle?: LocalFile}[], roundKey: string, active: boolean) {
  const cache = useRef(new WeakMap<LocalFile, Promise<PreparedFile>>());
  const ready = useRef(new WeakMap<LocalFile, PreparedFile>());
  const primed = useRef('');
  const [progress, setProgress] = useState({key:'',count:0,target:0,loading:false,error:''});
  useEffect(()=>{
    if (!active || files.length===0) return;
    let alive=true;
    const target=bufferTarget(files.length);
    const head=files.slice(0,target);
    const currentReady=!head[0]?.handle || ready.current.has(head[0].handle);
    const needsWarmup=primed.current!==roundKey;
    setProgress({key:roundKey,count:head.filter(i=>!i.handle || ready.current.has(i.handle)).length,target,loading:needsWarmup || !currentReady,error:''});
    void (async()=>{
      try {
        let count=0;
        // Two concurrent reads bound disk/memory work. No filenames or bytes leave the browser.
        for(let offset=0;offset<head.length;offset+=2){
          await Promise.all(head.slice(offset,offset+2).map(async item=>{
            if(item.handle){
              const handle=item.handle;
              if(!cache.current.has(handle)) cache.current.set(handle,prepareFile(handle).catch(error=>{cache.current.delete(handle);throw error;}));
              ready.current.set(handle,await cache.current.get(handle)!);
            }
            count++;
            if(alive)setProgress(p=>({...p,count}));
          }));
        }
        if(alive){primed.current=roundKey;setProgress({key:roundKey,count,target,loading:false,error:''});}
      }catch{
        if(alive)setProgress({key:roundKey,count:0,target,loading:false,error:'A file could not be read. Reopen the folder to renew permission, or choose a different folder. No files were moved.'});
      }
    })();
    return()=>{alive=false;};
  },[files,roundKey,active]);
  const initial=active && files.length>0 && progress.key!==roundKey;
  return {...progress,loading:initial||progress.loading,first:files[0]?.handle ? ready.current.get(files[0].handle) : undefined};
}
