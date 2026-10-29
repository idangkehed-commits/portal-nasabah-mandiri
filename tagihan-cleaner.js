(function (global) {
  'use strict';
  const columns = [
    ['CAB','kocab'], ['CIF','CIF'], ['PETUGAS','nama_mks'],
    ['REKENING','acctno'], ['PROD','produk'], ['NASABAH','nama'],
    ['LIMIT','limit'], ['BADE','bade'], ['KOL','kol_Is'],
    ['KOL-1','kol_Was'], ['tglcair','tglcair'], ['JT','tgl_jt_angs'],
    ['HT','hr_tgg'], ['ANGSURAN','angsuran'], ['TUNGGAKAN','total_tgg'],
    ['REK AGF','AGF1'], ['SALDO AGF','Saldo_AGF1']
  ];
  const normalize = value => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const collator = new Intl.Collator('id', { numeric:true, sensitivity:'base' });
  function compare(a,b) {
    const emptyA = a == null || String(a).trim() === '';
    const emptyB = b == null || String(b).trim() === '';
    if (emptyA || emptyB) return Number(emptyA)-Number(emptyB);
    return collator.compare(String(a).trim(),String(b).trim());
  }
  function prepare(workbook, XLSX) {
    const candidates = [];
    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      if (!sheet['!ref']) continue;
      const range = XLSX.utils.decode_range(sheet['!ref']);
      for (let r=range.s.r;r<=Math.min(range.e.r,range.s.r+49);r++) {
        const headers = new Map();
        for (let c=range.s.c;c<=range.e.c;c++) {
          const key = normalize(sheet[XLSX.utils.encode_cell({r,c})]?.v);
          if (key) {
            if (!headers.has(key)) headers.set(key,[]);
            headers.get(key).push(c);
          }
        }
        if (columns.every(([,source])=>headers.has(normalize(source)))) {
          if (columns.some(([,source])=>headers.get(normalize(source)).length !== 1)) throw new Error('Ada nama kolom sumber yang duplikat. Periksa header file raw.');
          const indices=columns.map(([,source])=>headers.get(normalize(source))[0]);
          const extra=Array.from({length:range.e.c-range.s.c+1},(_,i)=>range.s.c+i).filter(c=>!indices.includes(c)&&sheet[XLSX.utils.encode_cell({r,c})]?.v!=null);
          const unit=headers.get('mbu')?.[0];
          const ordered=[...indices,...extra];
          candidates.push({name,sheet,range,row:r,indices:ordered,unit,headers:ordered.map(c=>String(sheet[XLSX.utils.encode_cell({r,c})].v))});
          break;
        }
      }
    }
    const preferred = candidates.filter(c=>c.name.toLowerCase()==='detail1');
    const selected = preferred.length===1 ? preferred[0] : candidates.length===1 ? candidates[0] : null;
    if (!selected) throw new Error(candidates.length ? 'Ada beberapa sheet data yang cocok. Sisakan satu sheet detail tagihan pada file.' : 'Header raw tagihan belum sesuai. Diperlukan kolom: '+columns.map(([,source])=>source).join(', ')+'.');
    const {sheet,range,row,indices} = selected;
    const rows = [];
    for (let r=row+1;r<=range.e.r;r++) {
      const cells = indices.map(c=>sheet[XLSX.utils.encode_cell({r,c})]);
      if (cells.every(c=>c?.v == null || c.v==='')) continue;
      const account = cells[3]?.v;
      if (account == null || String(account).trim()==='') throw new Error('Nomor rekening kosong pada baris '+(r+1)+'. Periksa baris tersebut sebelum merapikan.');
      if (cells.some(c=>c?.t==='e')) throw new Error('Ada nilai error Excel pada baris '+(r+1)+'. Periksa file raw.');
      for (const i of [1,3,15]) if (typeof cells[i]?.v==='number' && !Number.isSafeInteger(cells[i].v)) throw new Error('Nomor identitas tidak utuh pada baris '+(r+1)+'. Gunakan nomor lengkap dari sumber.');
      rows.push({cells,order:r,unit:selected.unit==null?'':String(sheet[XLSX.utils.encode_cell({r,c:selected.unit})]?.v||'')});
    }
    if (!rows.length) throw new Error('Tidak ada baris tagihan pada file ini.');
    return prepareRows({rows,headers:selected.headers,sheetName:selected.name,source:'sheet'},XLSX);
  }
  function prepareRows(data,XLSX){
    const groups=new Map(),accounts=new Set(),dates=new Set();
    const dateIndex=data.headers.findIndex(h=>normalize(h)==='posisi');
    for(const row of data.rows){
      const code=String(row.cells[0]?.v??'').trim().toUpperCase();
      if(!code)throw Error('Ada rekening tanpa kode cabang. Periksa file raw.');
      for(const i of [1,3,15])if(typeof row.cells[i]?.v==='number'&&!Number.isSafeInteger(row.cells[i].v))throw Error('Nomor rekening atau identitas tidak utuh pada file raw.');
      const account=String(row.cells[3]?.v??'').trim();
      if(!account||accounts.has(account))throw Error('Ada nomor rekening kosong atau duplikat pada file raw.');
      accounts.add(account);row.code=code;
      if(!groups.has(code))groups.set(code,{code,names:new Set(),count:0});
      const group=groups.get(code);group.count++;if(row.unit)group.names.add(row.unit.replace(/\s+\d+\s*$/,'').trim());
      const value=row.cells[dateIndex]?.v;
      if(typeof value==='number'){const d=XLSX.SSF.parse_date_code(value);if(d&&d.y>=2000)dates.add(d.y+'-'+String(d.m).padStart(2,'0')+'-'+String(d.d).padStart(2,'0'));}
      else if(value instanceof Date&&!isNaN(value))dates.add(value.toISOString().slice(0,10));
      else if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}/.test(value))dates.add(value.slice(0,10));
    }
    if(!data.rows.length)throw Error('Tidak ada rekening dalam laporan.');
    const branches=Array.from(groups.values(),g=>({code:g.code,name:[...g.names].sort(compare).join(' / ')||g.code,count:g.count})).sort((a,b)=>compare(a.name,b.name));
    return {...data,branches,reportDate:dates.size===1?[...dates][0]:''};
  }
  function convertPrepared(data,XLSX,codes){
    const selected=codes==null?null:new Set(codes);
    if(selected&&[...selected].some(code=>!data.branches.some(b=>b.code===code)))throw Error('Pilihan cabang tidak ada pada laporan.');
    const rows=data.rows.filter(row=>!selected||selected.has(row.code)).slice();
    if(!rows.length)throw Error('Pilih sedikitnya satu cabang.');
    rows.sort((a,b)=>compare(a.cells[8]?.v,b.cells[8]?.v)||compare(a.cells[11]?.v,b.cells[11]?.v)||a.order-b.order);
    const headers=data.headers.map((h,i)=>i<17?columns[i][0]:h);
    const result = XLSX.utils.aoa_to_sheet([[],[],headers]);
    rows.forEach(({cells},i)=>cells.forEach((cell,c)=>{
      if (cell?.v == null || cell.v==='') return;
      const copy = {t:cell.t || (typeof cell.v==='number'?'n':'s'),v:cell.v};
      if (cell.z) copy.z=cell.z;
      if ([1,3,15].includes(c) && copy.t==='n') copy.z='0';
      if ([7,13,14,16].includes(c) && copy.t==='n') copy.z='_(* #,##0.00_);_(* \\(#,##0.00\\);_(* "-"??_);_(@_)';
      if (c===10 && copy.t==='n') copy.z='m/d/yy';
      result[XLSX.utils.encode_cell({r:i+3,c})]=copy;
    }));
    const end=XLSX.utils.encode_col(headers.length-1);
    result['!ref']='A1:'+end+(rows.length+3);
    result['!cols']=[7.28515625,12,21.7109375,14.140625,6,32.42578125,12,9.5703125,4.42578125,8.140625,15.5703125,3,4,14.28515625,15.28515625,14.140625,15.28515625].map(width=>({width,hidden:false}));
    for(let i=17;i<headers.length;i++)result['!cols'].push({width:16,hidden:true});
    result['!autofilter']={ref:'A3:'+end+(rows.length+3)};
    const output=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(output,result,'ALL');
    const pivotSummary=buildPivot(result,rows.length,XLSX);
    XLSX.utils.book_append_sheet(output,pivotSummary.sheet,'Pivot');
    return {workbook:output,count:rows.length,sheetName:data.sheetName,headers,pivotSummary};
  }
  function buildPivot(source,count,XLSX){
    const key=value=>JSON.stringify([typeof value,value]);
    const kol=[1,'2A','2B','2C',3,4,5],known=new Set(kol.map(key)),groups=new Map();
    const bucket=()=>({limit:0,bade:0,count:0,records:0});
    const total={buckets:new Map(),total:bucket()};
    function add(target,k,limit,bade){if(!target.buckets.has(k))target.buckets.set(k,bucket());for(const item of [target.buckets.get(k),target.total]){item.records++;if(typeof limit==='number')item.limit+=limit;if(typeof bade==='number')item.bade+=bade;if(bade!=null&&bade!=='')item.count++;}}
    for(let r=3;r<count+3;r++){
      const value=c=>source[XLSX.utils.encode_cell({r,c})]?.v??null;
      const staff=value(2),k=value(8),staffKey=key(staff),kolKey=key(k);
      if(!known.has(kolKey)){known.add(kolKey);kol.push(k);}
      if(!groups.has(staffKey))groups.set(staffKey,{value:staff,buckets:new Map(),total:bucket()});
      add(groups.get(staffKey),kolKey,value(6),value(7));add(total,kolKey,value(6),value(7));
    }
    kol.sort(compare);const staff=[...groups.values()].sort((a,b)=>compare(a.value,b.value));
    const names=['.limit','.bade','.jumlahrek','.%kol'];
    const matrix=[['CAB','(All)'],['PROD','(All)'],[],[null,null,'KOL'],['PETUGAS','Data',...kol.map(v=>String(v??'(blank)')),'Grand Total']];
    function values(group,measure){return [...kol.map(k=>group.buckets.get(key(k))),group.total].map(b=>{
      if(measure===3)return group.total.bade===0?{t:'e',v:7}:((b?.bade||0)/group.total.bade);
      if(!b?.records)return null;
      return measure===0?b.limit:measure===1?b.bade:b.count;
    });}
    for(const group of staff)for(let i=0;i<4;i++)matrix.push([i===0?(group.value??'(blank)'):null,names[i],...values(group,i)]);
    for(let i=0;i<4;i++)matrix.push(['Total '+names[i],null,...values(total,i)]);
    const sheet=XLSX.utils.aoa_to_sheet(matrix);
    for(let r=5;r<matrix.length;r++){const measure=(r-5)%4;for(let c=2;c<kol.length+3;c++){const cell=sheet[XLSX.utils.encode_cell({r,c})];if(cell)cell.z=measure===1?'#,##0.00':measure===2?'0':measure===3?'0.00%':'General';}}
    sheet['!cols']=[{wch:21},{wch:10},...Array.from({length:kol.length},()=>({wch:9})),{wch:11}];
    sheet['!rows']=matrix.map(()=>({hpt:15}));
    return {sheet,staff,kol,total,lastRow:matrix.length,lastColumn:kol.length+2};
  }
  function convert(workbook,XLSX){return convertPrepared(prepare(workbook,XLSX),XLSX);}
  // SheetJS CE writes cell values but does not export native Excel tables.
  // Add standard OOXML table and classic Pivot parts to the generated package.
  async function write(result,XLSX,JSZip) {
    const zip=await JSZip.loadAsync(XLSX.write(result.workbook,{bookType:'xlsx',type:'array'}));
    const headers=result.headers||columns.map(([name])=>name);
    const last=result.count+3,ref='A3:'+XLSX.utils.encode_col(headers.length-1)+last;
    const escape=value=>String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const table='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
      '<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="1" name="Table1" displayName="Table1" ref="'+ref+'" totalsRowShown="0">'+
      '<autoFilter ref="'+ref+'"/><tableColumns count="'+headers.length+'">'+
      headers.map((name,i)=>'<tableColumn id="'+(i+1)+'" name="'+escape(name)+'"/>').join('')+
      '</tableColumns><tableStyleInfo name="TableStyleMedium9" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/></table>';
    let sheet=await zip.file('xl/worksheets/sheet1.xml').async('string');
    sheet=sheet.replace(/<autoFilter\b[^>]*\/>|<autoFilter\b[^>]*>[\s\S]*?<\/autoFilter>/g,'');
    sheet=sheet.replace('</worksheet>','<tableParts count="1"><tablePart r:id="rIdTable1"/></tableParts></worksheet>');
    zip.file('xl/worksheets/sheet1.xml',sheet);
    zip.file('xl/tables/table1.xml',table);
    zip.file('xl/worksheets/_rels/sheet1.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdTable1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table1.xml"/></Relationships>');
    const types=await zip.file('[Content_Types].xml').async('string');
    zip.file('[Content_Types].xml',types.replace('</Types>','<Override PartName="/xl/tables/table1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/></Types>'));
    const styles=await zip.file('xl/styles.xml').async('string');
    zip.file('xl/styles.xml',styles.replace(/<fonts\b[\s\S]*?<\/fonts>/,fonts=>fonts.replace(/<sz val="[^"]+"\/>/g,'<sz val="11"/>')));
    await addClassicPivot(zip,result,XLSX,headers,escape);
    return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
  }
  async function addClassicPivot(zip,result,XLSX,headers,escape){
    const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const prolog='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    const xmlText=value=>escape(String(value).replace(/_x[0-9a-f]{4}_/gi,s=>'_x005F_'+s.slice(1)).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,c=>'_x'+c.charCodeAt(0).toString(16).padStart(4,'0')+'_')).replace(/\n/g,'&#10;').replace(/\r/g,'&#13;').replace(/\t/g,'&#9;');
    const dictionaries=headers.map(()=>({keys:new Map(),items:[],types:new Set()}));
    const addItem=(c,type,value)=>{const d=dictionaries[c],key=JSON.stringify([type,value]);if(!d.keys.has(key)){d.keys.set(key,d.items.length);d.items.push(type==='m'?'<m/>':'<'+type+' v="'+xmlText(value)+'"/>');d.types.add(type);}return d.keys.get(key);};
    const typed=value=>value==null?['m','']:typeof value==='number'?['n',value]:typeof value==='boolean'?['b',value?1:0]:['s',String(value)];
    const summary=result.pivotSummary;
    for(const value of summary.kol)addItem(8,...typed(value));
    const sheet=result.workbook.Sheets.ALL,records=[];
    for(let r=3;r<result.count+3;r++){
      const indices=[];
      for(let c=0;c<headers.length;c++){
        const cell=sheet[XLSX.utils.encode_cell({r,c})];let type='m',value='';
        if(cell?.v!=null){
          if(cell.t==='b'){type='b';value=cell.v?1:0;}
          else if(typeof cell.v==='number'){
            if(!Number.isFinite(cell.v))throw Error('Ada angka tidak valid pada data Pivot.');
            const date=['tglcair','posisi'].includes(normalize(headers[c]))?XLSX.SSF.parse_date_code(cell.v):null;
            if(date){type='d';value=String(date.y).padStart(4,'0')+'-'+String(date.m).padStart(2,'0')+'-'+String(date.d).padStart(2,'0')+'T'+String(date.H).padStart(2,'0')+':'+String(date.M).padStart(2,'0')+':'+String(Math.floor(date.S)).padStart(2,'0');}
            else{type='n';value=cell.v;}
          }else{type='s';value=String(cell.v);}
        }
        indices.push('<x v="'+addItem(c,type,value)+'"/>');
      }
      records.push('<r>'+indices.join('')+'</r>');
    }
    const fields=headers.map((name,c)=>{
      const d=dictionaries[c],has=t=>d.types.has(t)?1:0;
      const fmt=['tglcair','posisi'].includes(normalize(name))?14:[7,13,14,16].includes(c)?43:0;
      return '<cacheField name="'+xmlText(name)+'" numFmtId="'+fmt+'"><sharedItems count="'+d.items.length+'" containsBlank="'+has('m')+'" containsString="'+has('s')+'" containsNumber="'+has('n')+'" containsDate="'+has('d')+'" containsNonDate="'+(d.types.has('d')&&d.types.size===1?0:1)+'" containsMixedTypes="'+(d.types.size>1?1:0)+'" containsSemiMixedTypes="'+has('s')+'">'+d.items.join('')+'</sharedItems></cacheField>';
    }).join('');
    zip.file('xl/pivotCache/pivotCacheDefinition1.xml',prolog+'<pivotCacheDefinition xmlns="'+ns+'" xmlns:r="'+rel+'" r:id="rIdRecords" recordCount="'+result.count+'" saveData="1" invalid="0" refreshOnLoad="0" enableRefresh="1" createdVersion="6" refreshedVersion="6" minRefreshableVersion="3" missingItemsLimit="0"><cacheSource type="worksheet"><worksheetSource name="Table1" sheet="ALL"/></cacheSource><cacheFields count="'+headers.length+'">'+fields+'</cacheFields></pivotCacheDefinition>');
    zip.file('xl/pivotCache/pivotCacheRecords1.xml',prolog+'<pivotCacheRecords xmlns="'+ns+'" count="'+result.count+'">'+records.join('')+'</pivotCacheRecords>');
    const relationship=(id,type,target)=>'<Relationship Id="'+id+'" Type="'+rel+'/'+type+'" Target="'+target+'"/>';
    const relationships=body=>prolog+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+body+'</Relationships>';
    zip.file('xl/pivotCache/_rels/pivotCacheDefinition1.xml.rels',relationships(relationship('rIdRecords','pivotCacheRecords','pivotCacheRecords1.xml')));
    const indexFor=(c,v)=>dictionaries[c].keys.get(JSON.stringify(typed(v)));
    const itemXml=indices=>'<items count="'+indices.length+'">'+indices.map(x=>'<item x="'+x+'"/>').join('')+'</items>';
    const pivotFields=headers.map((_,c)=>{
      if(c===2)return '<pivotField axis="axisRow" showAll="0" defaultSubtotal="0" compact="0" outline="0">'+itemXml(summary.staff.map(g=>indexFor(c,g.value)))+'</pivotField>';
      if(c===8)return '<pivotField axis="axisCol" showAll="1" defaultSubtotal="0" compact="0" outline="0">'+itemXml(summary.kol.map(v=>indexFor(c,v)))+'</pivotField>';
      if(c===0||c===4)return '<pivotField axis="axisPage" showAll="0" defaultSubtotal="0" compact="0" outline="0">'+itemXml(Array.from({length:dictionaries[c].items.length},(_,i)=>i))+'</pivotField>';
      return '<pivotField showAll="0" compact="0" outline="0"'+([6,7].includes(c)?' dataField="1"':'')+'/>';
    }).join('');
    const rowItems=[];
    summary.staff.forEach((_,staff)=>{for(let i=0;i<4;i++)rowItems.push('<i i="'+i+'"><x v="'+staff+'"/><x v="'+i+'"/></i>');});
    for(let i=0;i<4;i++)rowItems.push('<i t="grand" i="'+i+'"><x/><x v="'+i+'"/></i>');
    const colItems=summary.kol.map((_,i)=>'<i><x v="'+i+'"/></i>').join('')+'<i t="grand"><x/></i>';
    const pivotXml=prolog+'<pivotTableDefinition xmlns="'+ns+'" name="PivotTable1" cacheId="0" dataCaption="Data" dataOnRows="1" dataPosition="1" pageWrap="0" pageOverThenDown="0" gridDropZones="1" showDropZones="1" compact="0" compactData="0" outline="0" outlineData="0" showHeaders="1" showMultipleLabel="0" rowGrandTotals="1" colGrandTotals="1" disableFieldList="0" enableDrill="1" createdVersion="6" updatedVersion="6" minRefreshableVersion="3"><location ref="A4:'+XLSX.utils.encode_col(summary.lastColumn)+(summary.lastRow)+'" firstHeaderRow="1" firstDataRow="2" firstDataCol="2" rowPageCount="2" colPageCount="1"/><pivotFields count="'+headers.length+'">'+pivotFields+'</pivotFields><rowFields count="2"><field x="2"/><field x="-2"/></rowFields><rowItems count="'+rowItems.length+'">'+rowItems.join('')+'</rowItems><colFields count="1"><field x="8"/></colFields><colItems count="'+(summary.kol.length+1)+'">'+colItems+'</colItems><pageFields count="2"><pageField fld="0"/><pageField fld="4"/></pageFields><dataFields count="4"><dataField name=".limit" fld="6" subtotal="sum" numFmtId="0"/><dataField name=".bade" fld="7" subtotal="sum" numFmtId="4"/><dataField name=".jumlahrek" fld="7" subtotal="count" numFmtId="1"/><dataField name=".%kol" fld="7" subtotal="sum" showDataAs="percentOfRow" numFmtId="10"/></dataFields><pivotTableStyleInfo name="" showRowHeaders="0" showColHeaders="0" showRowStripes="0" showColStripes="0" showLastColumn="0"/></pivotTableDefinition>';
    zip.file('xl/pivotTables/pivotTable1.xml',pivotXml);
    zip.file('xl/pivotTables/_rels/pivotTable1.xml.rels',relationships(relationship('rIdCache','pivotCacheDefinition','../pivotCache/pivotCacheDefinition1.xml')));
    const pivotSheet=await zip.file('xl/worksheets/sheet2.xml').async('string');
    zip.file('xl/worksheets/sheet2.xml',pivotSheet.replace(/<sheetView workbookViewId="0"\/>/,'<sheetView workbookViewId="0" tabSelected="1"><selection activeCell="A5" sqref="A5"/></sheetView>'));
    zip.file('xl/worksheets/_rels/sheet2.xml.rels',relationships(relationship('rIdPivotTable','pivotTable','../pivotTables/pivotTable1.xml')));
    let book=await zip.file('xl/workbook.xml').async('string');
    book=book.replace('<workbookPr ','<workbookPr hidePivotFieldList="0" ').replace('<sheets>','<bookViews><workbookView activeTab="1"/></bookViews><sheets>').replace('</workbook>','<pivotCaches><pivotCache cacheId="0" r:id="rIdPivotCache"/></pivotCaches></workbook>');
    zip.file('xl/workbook.xml',book);
    const bookRels=await zip.file('xl/_rels/workbook.xml.rels').async('string');
    zip.file('xl/_rels/workbook.xml.rels',bookRels.replace('</Relationships>',relationship('rIdPivotCache','pivotCacheDefinition','pivotCache/pivotCacheDefinition1.xml')+'</Relationships>'));
    const types=await zip.file('[Content_Types].xml').async('string');
    zip.file('[Content_Types].xml',types.replace('</Types>',['pivotTables/pivotTable1.xml','pivotCache/pivotCacheDefinition1.xml','pivotCache/pivotCacheRecords1.xml'].map((path,i)=>'<Override PartName="/xl/'+path+'" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.'+['pivotTable','pivotCacheDefinition','pivotCacheRecords'][i]+'+xml"/>').join('')+'</Types>'));
  }
  const api={convert,prepare,prepareRows,convertPrepared,columns,compare,write};
  if (typeof module!=='undefined' && module.exports) module.exports=api;
  global.TagihanCleaner=api;
})(typeof window==='undefined'?globalThis:window);
