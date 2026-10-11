const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const PptxGenJS=require(path.join(root,'.superpowers/export-tools/node_modules/pptxgenjs'));
const {chromium}=require(path.join(root,'frontend/node_modules/playwright'));
const out=path.join(root,'docs/downloads');
async function main(){
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage();
 await page.goto('file:///'+path.join(out,'report-print.html').replaceAll('\\','/'));
 await page.pdf({path:path.join(out,'LeafLens_Report.pdf'),printBackground:true,preferCSSPageSize:true,displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:'<div style="font-size:9px;width:100%;margin:0 19mm;color:#69805c;display:flex;justify-content:space-between"><span>LeafLens / Deep Learning course project</span><span class="pageNumber"></span></div>'});
 await browser.close();
 const deck=new PptxGenJS(); deck.layout='LAYOUT_WIDE'; deck.author='Atul Biju; Athul M B; Athul Chandran';deck.subject='Deep Learning course project';deck.title='LeafLens';deck.company='Course project team';deck.lang='en-IN';
 deck.theme={headFontFace:'Aptos Display',bodyFontFace:'Aptos',lang:'en-IN'};
 const slides=JSON.parse(fs.readFileSync(path.join(out,'slides-source.json'),'utf8'));
 slides.forEach((data,i)=>{
  const s=deck.addSlide(); const dark=i===0||i===11;const fg=dark?'F4F8EB':'173E2C';s.background={color:dark?'173E2C':'F5F8EF'};
  s.addText(data.label.toUpperCase(),{x:.65,y:.35,w:11.8,h:.25,fontSize:11,color:dark?'CBE79D':'728565',margin:0,charSpacing:2});
  s.addText(data.title,{x:.65,y:.95,w:i===0?7:12,h:1.1,fontSize:i===0?35:31,bold:true,color:fg,margin:0,breakLine:false,fit:'shrink'});
  if(i===6){
   s.addChart(deck.ChartType.bar,[{name:'Accuracy',labels:['CNN','VGG16'],values:[77.78,70.22]},{name:'Macro F1',labels:['CNN','VGG16'],values:[76.56,70.17]}],{x:.8,y:2.25,w:7.5,h:3.6,catAxisLabelFontSize:15,valAxisMinVal:0,valAxisMaxVal:100,showLegend:true,showValue:true,chartColors:['386A39','A4C678'],legendPos:'b',showTitle:true,title:'Held-out test metrics (%)',valGridLine:{color:'DDE5D3',width:1},showBorder:false});
   s.addText('225 test images\n128 × 128 input resolution\n100 images per class\nOne seed; controlled backgrounds\n\nCNN outperformed VGG16 in this run.\nField accuracy remains unverified.',{x:8.7,y:2.5,w:3.8,h:3.5,fontSize:18,color:fg,margin:0,breakLine:false});
  }else if(data.images.length&&i!==0){
   const imageCount=data.images.length;
   data.images.forEach((img,j)=>{const b=fs.readFileSync(img),ratio=b.readUInt32BE(16)/b.readUInt32BE(20),boxW=12/imageCount-.2,boxH=3.65,w=Math.min(boxW,boxH*ratio),h=w/ratio;s.addImage({path:img,x:.65+j*(12.05/imageCount)+(boxW-w)/2,y:2.3+(boxH-h)/2,w,h});});
   s.addText(data.blocks.join('\n'),{x:.65,y:6.1,w:12,h:.6,fontSize:13,color:'627954',margin:0,fit:'shrink'});
  }else{
   const texts=data.blocks;
   const body=i===2?'15 classes / 1,500 images / 1,050 train · 225 validation · 225 test\n\n'+texts.join('\n'):texts.join('\n');
   s.addText(body,{x:.65,y:2.25,w:i===0?7.2:12,h:4.3,fontSize:i===0?19:17.5,color:fg,margin:0,paraSpaceAfter:7,valign:'top',fit:'shrink'});
   if(i===0&&data.images[0])s.addImage({path:data.images[0],x:8.4,y:1.05,w:4.3,h:5.7});
  }
  s.addShape(deck.ShapeType.line,{x:.65,y:6.9,w:12,h:0,line:{color:dark?'57754A':'D6E2C8',width:1}});
  s.addText('LeafLens · Deep Learning course project',{x:.65,y:7.05,w:10,h:.2,fontSize:10,color:dark?'CBE79D':'728565',margin:0});
  s.addText(`${String(i+1).padStart(2,'0')} / 12`,{x:11.6,y:7.05,w:1,h:.2,fontSize:10,color:dark?'CBE79D':'728565',align:'right',margin:0});
  s.addNotes(data.blocks.join('\n')+'\nLive demo: https://leaflens-black.vercel.app\nResults describe a documented subset experiment, not the full Kaggle dataset or field accuracy.');
 });
 await deck.writeFile({fileName:path.join(out,'LeafLens_Presentation.pptx')});
 console.log('PDF and 12-slide editable PowerPoint exported.');
}
main().catch(e=>{console.error(e);process.exit(1)});
