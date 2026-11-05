const {chromium}=require('playwright');
const fs=require('node:fs');
require('./browser-fixture.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
 try{
  for(const viewport of [{width:1440,height:1000},{width:390,height:844},{width:320,height:568},{width:1000,height:500}]){
   const page=await browser.newPage({viewport});
   await page.route('https://moxfield.com/**',route=>route.fulfill({contentType:'text/html',body:fs.readFileSync(require.resolve('./browser-fixture.html'),'utf8')}));
   await page.goto('https://moxfield.com/lemfield-test-fixture');
   await page.waitForFunction(()=>document.querySelector('#test-results').textContent!=='RUNNING');
   const result=JSON.parse(await page.locator('#test-results').textContent());
   if(!result.ok)throw Error(JSON.stringify({viewport,...result}));
   console.log(`PASS: ${viewport.width}x${viewport.height}: ${result.checks.length} dialog, filter, artwork and layout checks`);
   await page.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
