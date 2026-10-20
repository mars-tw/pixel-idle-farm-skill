"""Wait for the owning serial run, then perform final bounded gates with one browser."""
import ctypes,json,os,pathlib,subprocess,sys,time
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r14'
pid=int(sys.argv[1]);k=ctypes.windll.kernel32;k.OpenProcess.restype=ctypes.c_void_p;k.WaitForSingleObject.argtypes=[ctypes.c_void_p,ctypes.c_ulong];k.CloseHandle.argtypes=[ctypes.c_void_p]
handle=k.OpenProcess(0x100000,False,pid)
if handle:
 print('PREPARED waiting for existing owned serial runner',pid,flush=True)
 try:
  while k.WaitForSingleObject(handle,5000)==258:pass
 finally:k.CloseHandle(handle)
commands=[['python','scripts/run-content-r14-regression.py','--only=npm,test-npc-indicators,test-world-project-art,test-world-rework-e2e,test-content-r2-e2e,test-content-r3-e2e'],['node','scripts/test-content-r14-visuals.js'],['node','scripts/measure-content-r14.js'],['python','tools/protect-content-r14.py','restore'],['python','tools/finalize-content-r14.py'],['python','tools/verify-content-r14-release.py']]
report={'status':'EXECUTED','protocol':'serial; each owned browser/server closes before the next command','commands':[]}
for i,cmd in enumerate(commands):
 name=pathlib.Path(cmd[1]).stem;log=O/'logs'/('final-'+name+'.log');print('EXECUTED',name,flush=True)
 with log.open('w',encoding='utf-8') as f:p=subprocess.run(cmd,cwd=R,stdout=f,stderr=subprocess.STDOUT,env=os.environ|{'PYTHONIOENCODING':'utf-8'},creationflags=subprocess.CREATE_NO_WINDOW)
 report['commands'].append({'command':cmd,'exitCode':p.returncode,'log':log.relative_to(R).as_posix()});(O/'finalization.json').write_text(json.dumps(report,indent=2)+'\n')
 print('VERIFIED' if p.returncode==0 else 'BLOCKED',name,flush=True)
 if p.returncode:report['status']='BLOCKED';break
else:report['status']='VERIFIED'
(O/'finalization.json').write_text(json.dumps(report,indent=2)+'\n');print(report['status'],flush=True)
raise SystemExit(0 if report['status']=='VERIFIED' else 1)
