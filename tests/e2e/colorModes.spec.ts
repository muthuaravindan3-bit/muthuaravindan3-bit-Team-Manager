import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const palettes: Record<string, Record<string,string>> = JSON.parse(readFileSync(new URL('../../src/theme/palettes.json',import.meta.url),'utf8'));
function luminance(hex: string) { const values=hex.match(/[a-f\d]{2}/gi)!.map(part=>parseInt(part,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);return values[0]*.2126+values[1]*.7152+values[2]*.0722; }
function contrast(a: string,b: string) { const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); }
for(const [id, palette] of Object.entries(palettes)) test(`${palette.name}: tokens, contrast, dialog and persistence`,async({page})=>{
  await page.addInitScript(mode=>{if(!localStorage.getItem('shiftsync_theme_slate_v1'))localStorage.setItem('shiftsync_theme_slate_v1',mode);},id);
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Your next shift'})).toBeVisible();
  expect(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor)).toBe(id==='amoled'?'rgb(0, 0, 0)':id.endsWith('light')?'rgb(245, 245, 240)':'rgb(17, 19, 21)');
  const actual=await page.evaluate(()=>Object.fromEntries(['primary','main-text','main-text-muted','success','warning','error','info'].map(key=>[key,getComputedStyle(document.documentElement).getPropertyValue('--color-'+key).trim().toUpperCase()])));
  expect(actual).toEqual({primary:palette.accent.toUpperCase(),'main-text':palette.text.toUpperCase(),'main-text-muted':palette.muted.toUpperCase(),success:palette.success.toUpperCase(),warning:palette.warning.toUpperCase(),error:palette.error.toUpperCase(),info:palette.info.toUpperCase()});
  for(const foreground of ['text','muted','accent','success','warning','error','info'] as const) for(const surface of ['page','card','raised'] as const) expect(contrast(palette[foreground],palette[surface]),`${foreground} on ${surface}`).toBeGreaterThanOrEqual(4.5);
  for(const surface of ['page','card','raised'])expect(contrast(palette.control,palette[surface])).toBeGreaterThanOrEqual(3);
  expect(contrast(palette.ink,palette.accent)).toBeGreaterThanOrEqual(4.5);
  await page.getByLabel('Color mode',{exact:true}).selectOption('amoled');
  await page.reload();await expect(page.getByLabel('Color mode',{exact:true})).toHaveValue('amoled');
  await page.locator('main').getByRole('button',{name:'Request time off',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const surfaces=await page.getByRole('dialog').locator('input,textarea,select').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).backgroundColor));
  expect(surfaces).not.toContain('rgb(255, 255, 255)');
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('First visit follows the system color preference before React mounts',async({page})=>{
  await page.route('**/src/main.tsx*',route=>route.fulfill({body:'export {};',contentType:'text/javascript'}));await page.emulateMedia({colorScheme:'dark'});await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-theme','warm-obsidian-dark');
});
test('AMOLED canvas has a pure black background',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('shiftsync_theme_slate_v1','amoled'));await page.goto('/');const hub=page.getByRole('region',{name:'Team hub',exact:true});await hub.scrollIntoViewIfNeeded();await expect(hub.locator('canvas')).toBeVisible({timeout:20000});
  expect(await hub.locator('canvas').evaluate(node=>getComputedStyle(node).backgroundColor)).toBe('rgb(0, 0, 0)');
  await expect(hub.locator('canvas')).toHaveAttribute('data-scene-exposure','0.7');
  await page.getByLabel('Color mode',{exact:true}).selectOption('warm-obsidian-light');await expect(hub.locator('canvas')).toHaveAttribute('data-scene-exposure','1');
  await page.getByLabel('Color mode',{exact:true}).selectOption('amoled');await expect(hub.locator('canvas')).toHaveAttribute('data-scene-exposure','0.7');
  const clear=await hub.locator('canvas').evaluate(node=>{const gl=(node as HTMLCanvasElement).getContext('webgl2')!;return Array.from(gl.getParameter(gl.COLOR_CLEAR_VALUE) as Float32Array);});expect(clear).toEqual([0,0,0,1]);
  await page.screenshot({path:'artifacts/screenshots/amoled-live.png',fullPage:false});
});

for(const mode of ['warm-obsidian-light','warm-obsidian-dark','amoled']) for(const width of [375,1440]) test(`Refined summary and day selection: ${mode} at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.addInitScript(value=>localStorage.setItem('shiftsync_theme_slate_v1',value),mode);await page.goto('/');await expect(page.getByRole('heading',{name:'Your next shift'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:`artifacts/screenshots/refined-${mode}-${width}.png`,fullPage:true,animations:'disabled'});
 await page.goto('/?workspace=schedule&view=week');const day=page.getByRole('button',{name:/^Focus /}).last();const label=await day.getAttribute('aria-label');await day.click();await expect(day).toHaveAttribute('aria-pressed','true');await expect(page.getByRole('region',{name:'Shift selection',exact:true})).toHaveAttribute('data-scene-selection',label!.slice(6));
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
