/* Native editable Word export for the Mitra ID letter. */
window.exportMitraWord=async function(root){
 const zip=new JSZip(),media=[],rels=[];
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const w='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
 function runs(node,style={}){
  if(node.nodeType===3)return '<w:r><w:rPr>'+(style.bold?'<w:b/>':'')+(style.italic?'<w:i/>':'')+(style.underline?'<w:u w:val="single"/>':'')+'</w:rPr><w:t xml:space="preserve">'+esc(node.textContent)+'</w:t></w:r>';
  if(node.nodeType!==1)return '';
  if(node.tagName==='BR')return '<w:r><w:br/></w:r>';
  if(node.tagName==='IMG'){
   const match=node.src.match(/^data:image\/(jpeg|png);base64,(.+)$/);if(!match)return '';
   const n=media.length+1,ext=match[1]==='jpeg'?'jpg':'png',file='image'+n+'.'+ext;
   media.push(file);zip.file('word/media/'+file,match[2],{base64:true});rels.push('<Relationship Id="rImg'+n+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/'+file+'"/>');
   const ratio=node.naturalHeight/node.naturalWidth||.3,width=node.closest('.mf-mitra-heading')?1332000:1548000,height=Math.round(width*ratio);
   return '<w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="'+width+'" cy="'+height+'"/><wp:docPr id="'+n+'" name="Image '+n+'"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="'+n+'" name="'+file+'"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rImg'+n+'"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="'+width+'" cy="'+height+'"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
  }
  const next={bold:style.bold||['B','STRONG','TH'].includes(node.tagName),italic:style.italic||node.tagName==='I',underline:style.underline||node.tagName==='U'};
  return [...node.childNodes].map(n=>runs(n,next)).join('');
 }
 const p=(node,props='')=>'<w:p><w:pPr><w:spacing w:after="120" w:line="240" w:lineRule="auto"/>'+props+'</w:pPr>'+runs(node)+'</w:p>';
 function table(node,bordered=false,widths){
  widths=widths||[4000,340,3515,3515];
  const border=bordered?'<w:tblBorders>'+['top','left','bottom','right','insideH','insideV'].map(x=>'<w:'+x+' w:val="single" w:sz="4" w:color="000000"/>').join('')+'</w:tblBorders>':'';
  return '<w:tbl><w:tblPr><w:tblW w:w="11370" w:type="dxa"/><w:tblLayout w:type="fixed"/>'+border+'</w:tblPr><w:tblGrid>'+widths.map(n=>'<w:gridCol w:w="'+n+'"/>').join('')+'</w:tblGrid>'+[...node.rows].map(row=>{let col=0;return '<w:tr>'+[...row.cells].map(cell=>{const span=cell.colSpan||1,width=widths.slice(col,col+span).reduce((a,b)=>a+b,0);col+=span;return '<w:tc><w:tcPr><w:tcW w:w="'+width+'" w:type="dxa"/>'+(span>1?'<w:gridSpan w:val="'+span+'"/>':'')+'<w:tcMar><w:top w:w="70" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/></w:tcMar></w:tcPr>'+p(cell,cell.classList.contains('center')?'<w:jc w:val="center"/>':'')+'</w:tc>';}).join('')+'</w:tr>';}).join('')+'</w:tbl>';
 }
 let body='';for(const node of root.children){
  if(node.classList.contains('mf-mitra-heading')){
   const holder=document.createElement('table');holder.innerHTML='<tr><td></td><td></td></tr>';holder.rows[0].cells[0].append(node.firstElementChild.cloneNode(true));holder.rows[0].cells[1].append(node.lastElementChild.cloneNode(true));body+=table(holder,false,[9000,2370]);
  }else if(node.tagName==='TABLE')body+=table(node,node.classList.contains('mf-mitra-table'),node.classList.contains('mf-mitra-meta')?[1400,300,9670]:undefined);
  else if(node.classList.contains('mf-property-ttd'))body+=[...node.children].map(c=>c.classList.contains('mf-property-ink')&&!c.querySelector('img')?'<w:p><w:pPr><w:spacing w:after="1200"/></w:pPr></w:p>':p(c,'<w:keepNext/>')).join('');
  else body+=p(node,node.classList.contains('mf-mitra-title')?'<w:pBdr><w:bottom w:val="double" w:sz="6"/></w:pBdr>':'');
 }
 const prolog='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
 zip.file('[Content_Types].xml',prolog+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>');
 zip.file('_rels/.rels',prolog+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rDoc" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
 zip.file('word/_rels/document.xml.rels',prolog+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'+rels.join('')+'</Relationships>');
 zip.file('word/styles.xml',prolog+'<w:styles xmlns:w="'+w+'"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>');
 zip.file('word/document.xml',prolog+'<w:document xmlns:w="'+w+'" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>'+body+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="340" w:right="284" w:bottom="567" w:left="284"/></w:sectPr></w:body></w:document>');
 return zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',compression:'DEFLATE'});
};
