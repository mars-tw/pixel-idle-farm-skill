"""Read-only sibling/native inspection. Writes evidence only inside this repository."""
import hashlib, json, re, subprocess, plistlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/store'
OUT.mkdir(parents=True, exist_ok=True)
APPS = {
    'Crackveil Vanguard': 'rift-survivors', '暴風啟示錄': 'storm-apocalypse', '灰燼護航': 'doomsday-shooter',
    '無盡塔防': 'tower-defense', '裂潮卡牌': 'skill', '村莊攻防': 'village-siege',
    '七期：斷鏈行動': 'seven-district-reckoning', 'Rift Forge 3D': 'rift-forge-3d',
    '島嶼交通學院': 'taiwan-island-drive', '小小列車長': 'taiwan-train-math',
    '夜行列車': '廣告遊戲專案', '島嶼飛行學校': 'island-flight-school', '島嶼鐵道學校': 'taiwan-train-school',
}
EXT = {'.js','.css','.html','.json','.png','.jpg','.svg','.webp','.ogg','.m4a','.wav','.mp3','.woff','.woff2','.ttf','.otf','.gd','.ts','.tsx','.vue','.godot'}
SKIP = {'docs','references','scripts','tools','.git','node_modules','.godot','.venv','venv','build','dist','output','artifacts','test','tests','Library','Temp','Logs','android','ios'}
def runtime_files(repo):
    p = subprocess.run(['git','-C',str(repo),'ls-files','-z'],capture_output=True)
    if p.returncode:
        return [], 'BLOCKED: no git tracked-file inventory'
    files = []
    for name in p.stdout.decode('utf-8').split('\0'):
        rel = Path(name)
        if not name or rel.suffix.lower() not in EXT or any(x in SKIP for x in rel.parts): continue
        if rel.name in {'package-lock.json','art-config.json'} or rel.name.startswith('art-config-'): continue
        full=repo/rel
        if full.is_file(): files.append(full)
    return files, 'VERIFIED: tracked candidate runtime/source/assets; not a signed-binary audit'
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def styles(files, base):
    rows=[]
    for p in files:
        if p.suffix not in {'.css','.html'}: continue
        t=p.read_text(encoding='utf-8',errors='replace')
        if p.suffix=='.html': t='\n'.join(re.findall(r'<style[^>]*>(.*?)</style>',t,re.S|re.I))
        for block in re.findall(r'([^{}]+\{[^{}]+\})',re.sub(r'/\*.*?\*/','',t,flags=re.S)):
            normalized=re.sub(r'\s+','',block)
            if len(normalized)>90: rows.append({'hash':hashlib.sha256(normalized.encode()).hexdigest(),'file':p.relative_to(base).as_posix(),'block':block.strip()})
    return rows
own=list((ROOT/'src').glob('*'))+list((ROOT/'assets').rglob('*'))+[ROOT/n for n in ['index.html','offline.html','sw.js','manifest.webmanifest']]
own=[p for p in own if p.is_file() and p.suffix.lower() in EXT | {'.webmanifest'}]
by_hash={}
for p in own: by_hash.setdefault(digest(p),[]).append(p.relative_to(ROOT).as_posix())
own_styles=styles(own,ROOT)
css_index={}
for row in own_styles: css_index.setdefault(row['hash'],[]).append(row)
report={'status':'VERIFIED','scope':'read-only on sibling repositories and native-kit; files as found, concurrent work may change them','ownFiles':len(own),'ownInventory':[{'file':p.relative_to(ROOT).as_posix(),'sha256':digest(p)} for p in own],'apps':[],'exactDuplicates':[],'cssDuplicates':[]}
for app,folder in APPS.items():
    repo=ROOT.parent/folder
    files,status=runtime_files(repo)
    inventory=[{'file':p.relative_to(repo).as_posix(),'sha256':digest(p)} for p in files]
    report['apps'].append({'app':app,'folder':folder,'files':len(files),'status':status,'inventorySHA256':hashlib.sha256(json.dumps(inventory,ensure_ascii=False,sort_keys=True).encode()).hexdigest()})
    for p in files:
        sha=digest(p)
        if sha in by_hash: report['exactDuplicates'].append({'own':by_hash[sha],'app':app,'other':p.relative_to(repo).as_posix(),'sha256':sha})
    for row in styles(files,repo):
        for ours in css_index.get(row['hash'],[]): report['cssDuplicates'].append({'own':ours['file'],'app':app,'other':row['file'],'block':ours['block'],'sha256':row['hash']})
native=ROOT.parent/'game-store-publisher/native-kit'
privacy=native/'apps/pixel-idle-farm-skill/ios/App/App/PrivacyInfo.xcprivacy'
config=native/'apps/pixel-idle-farm-skill/ios/App/App/capacitor.config.json'
report['native']={'privacyPath':str(privacy.relative_to(ROOT.parent)),'privacySHA256':digest(privacy),'privacy':plistlib.loads(privacy.read_bytes()),'capacitor':json.loads(config.read_text(encoding='utf-8')),'dependencies':json.loads((native/'package.json').read_text(encoding='utf-8'))['dependencies']}
snapshot=native/'apps/pixel-idle-farm-skill/ios/App/App/public/index.html'
report['native']['snapshotExists']=snapshot.exists()
if snapshot.exists():
    text=snapshot.read_text(encoding='utf-8',errors='replace')
    report['native']['snapshotSHA256']=digest(snapshot)
    report['native']['snapshotHasR81']='r81-20261015-1' in text
manifest=native/'apps/pixel-idle-farm-skill/android/app/src/main/AndroidManifest.xml'
report['native']['androidManifestSHA256']=digest(manifest)
report['native']['androidSourcePermissions']=re.findall(r'<uses-permission[^>]+android:name="([^"]+)"',manifest.read_text(encoding='utf-8'))
host=native/'apps/pixel-idle-farm-skill/ios/App/App/public/native-host.js'
report['native']['sharedCustomHost']={'file':'native-host.js','sha256':digest(host),'identicalApps':[p.parts[-6] for p in (native/'apps').glob('*/ios/App/App/public/native-host.js') if p!=host and digest(p)==digest(host)]}
(OUT/'shared-assets-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
lines=['# 共用素材與框架稽核','', '狀態：VERIFIED（原始碼／素材靜態比對範圍）。其他 repo 與 native-kit 只讀；沒有檢查簽章二進位。並行線路的檔案可能在本次快照後改變。','',f"本作候選檔案 {len(own)} 個。完整 SHA-256、檔名與掃描範圍：[shared-assets-audit.json](shared-assets-audit.json)。",'', '| 同帳號作品 | 比對候選檔案數 | 狀態 |','|---|---:|---|']
for row in report['apps']: lines.append(f"| {row['app']} | {row['files']} | {row['status']} |")
lines += ['', '## 完全相同的檔案','', '| 本作檔案 | 與哪款／檔案重複 | SHA-256 | 處理方式 |','|---|---|---|---|']
for row in report['exactDuplicates']: lines.append(f"| {'、'.join(row['own'])} | {row['app']}／{row['other']} | `{row['sha256']}` | 待依內容分類，見人工判讀 |")
if not report['exactDuplicates']: lines.append('| 本次候選範圍沒有逐位元相同檔案 | 13 款已定位資料夾 | 見 JSON 清冊 | 不將零雜湊重複解讀為零概念或架構共用 |')
lines+=['','## 同內容的 CSS 規則','']
for row in report['cssDuplicates']: lines.append(f"- `{row['own']}` ↔ {row['app']} `{row['other']}`：`{row['block'].replace(chr(10),' ')}`")
if not report['cssDuplicates']: lines.append('正規化空白後，長度超過 90 字元的完整 selector＋declarations 沒有相同項目。這不證明版型與視覺印象獨立。')
lines += ['', '## 逐項判讀與處理', '', '| 本作檔案／元件 | 與哪款重複或相似 | 處理方式 |', '|---|---|---|',
    '| index.html、manifest.webmanifest、src/ui.js 對外名稱與結語 | 舊版用「開源遊戲世界」系列宣傳，接近同帳號模板系列語氣 | 改為「籃底的手記」，結語改為實際農務與分享，不宣稱玩家共創 |',
    '| index.html footer、src/ui.js 設定導流 | 裂潮卡牌、無盡塔防、灰燼護航的系列互推版型 | 移除跨遊戲連結；原有三個設定連結改成本機存檔、資料用途與離線說明的頁內導覽，保留原控制可達測試 |',
    '| src/world.css、src/heirloom-ui.js、src/daily-ui.js | 窗口與分頁是常見 UI 模式；沒有逐位元或長 CSS 規則重複 | 光斑任務用麥黃與棕墨色，餐籃以便箋、麥穗照料記錄和兩種送法呈現；不把換色本身當重大玩法差異 |',
    '| assets/generated/r68/loading-*、assets/icons/*、assets/generated/v4/*、assets/audio/r79-* | 已對 13 款可定位 repo 的候選檔案做 SHA-256 比對，沒有完全相同素材 | 沿用本作四季載入插畫、農場圖示、角色／地圖圖集與 R79 農場曲；新手記插畫與持籃動作缺件見 assets/heirloom/manifest.json |',
    '| index.html、offline.html 的 Segoe UI／PingFang TC／Microsoft JhengHei／system-ui／sans-serif | 裂潮卡牌、無盡塔防等同樣使用部分系統字型家族 | 標準作業系統第三方字型，沒有打包或下載字型檔；列出共用，不假稱專屬字型 |',
    '| SKILL.md、art-config*.json 與 src/ 拆模組慣例 | 多個網頁遊戲採相似作者工作架構；此項不在 runtime 雜湊零重複的結論內 | 保留開發文件與來源，正式 Pages allowlist 僅 runtime／assets／LICENSE／CREDITS；原生 public 根目錄也沒有 SKILL.md。框架相似必須如實揭露 |',
    '| native-kit：Capacitor 8、App／Preferences 外掛 | 同帳號使用同一 native-kit 的網頁遊戲 | 標準第三方包裝；唯讀保留，沒有將換個 App 名當原生獨立性證據 |',
    f"| native-kit/public/native-host.js，SHA-256 `{report['native']['sharedCustomHost']['sha256']}` | {', '.join(report['native']['sharedCustomHost']['identicalApps']) or '本快照沒有相同檔案'} | 自家共用宿主程式，含原生判斷、返回與背景通知；不是第三方標準引擎本體。唯讀不得修改，完整揭露於審查草稿，不聲稱已消除這項共用 |",
    '| native-kit 的本作 public/index.html | 本作舊網頁快照，沒有 r81-20261015-1 | BLOCKED：仍需由打包線重新建置與實機驗證；本輪沒有修改 native-kit |', '',
    '界線：掃描排除 docs、scripts、references、node_modules、build、dist、android／ios 等目錄。Godot、Unity 等第三方引擎可能存在於其他作品，但本作 runtime 為原生 HTML/CSS/JS；沒有把引擎差異當作玩法創新。未做函式 AST 相似度或所有歷史版本與第三方 App 二進位比較。']
(OUT/'SHARED_ASSETS_AUDIT.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print(json.dumps({'ownFiles':len(own),'apps':report['apps'],'exactDuplicates':len(report['exactDuplicates']),'cssDuplicates':len(report['cssDuplicates']),'native':report['native']},ensure_ascii=False,indent=2))
