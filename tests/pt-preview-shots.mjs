import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const root = '/tmp/woogie-s-app/tests/pt-request-preview/dist';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  const p = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  try {
    const body = await readFile(join(root, p));
    res.writeHead(200, { 'content-type': mime[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise((r) => server.listen(4899, r));

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://127.0.0.1:4899/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

// ===== A. 모바일 기본 '일'(아젠다) 뷰 =====
// 11/18(수)로 이동: 취소/거절 신청만 있는 날 → 비어 있어야 함
await page.click('.labdot-agenda-days >> text=수 18');
await page.waitForTimeout(400);
const emptyText = await page.$eval('.labdot-agenda', (e) => e.textContent);
if (!emptyText.includes('이 날은 일정이 없습니다')) throw new Error('cancelled/declined leaked into agenda 11/18: ' + emptyText.slice(0, 200));
if (emptyText.includes('취소더미') || emptyText.includes('거절더미')) throw new Error('cancelled/declined visible in agenda');

// 11/19(목): 신청(김더미)·일반 예약·오티 블록 표시
await page.click('.labdot-agenda-days >> text=목 19');
await page.waitForTimeout(400);
const agendaText = await page.$eval('.labdot-agenda', (e) => e.textContent);
if (!agendaText.includes('김더미님 피티 신청')) throw new Error('agenda pt request row missing');
if (!agendaText.includes('승인 대기')) throw new Error('agenda pending badge missing');
if (!agendaText.includes('일반더미')) throw new Error('agenda booking missing');
await page.screenshot({ path: '/downloads/pt-preview-1-agenda.png' });

// 2. 아젠다 행 탭 → 다이얼로그
await page.click('.labdot-agenda-row.k-ptreq');
await page.waitForTimeout(500);
await page.screenshot({ path: '/downloads/pt-preview-2-dialog.png' });
const dialogText = await page.$eval('[role=dialog]', (e) => e.textContent);
if (!dialogText.includes('김더미님 피티 등록 신청') || !dialogText.includes('2026-11-19 · 14:00')) throw new Error('dialog content: ' + dialogText.slice(0, 120));

// 3. 승인 → 확인 단계
await page.click('text=신청 승인');
await page.waitForTimeout(400);
await page.screenshot({ path: '/downloads/pt-preview-3-confirm.png' });
const confirmText = await page.$eval('[role=dialog]', (e) => e.textContent);
if (!confirmText.includes('승인하면 해당 시간이 확정되고 캘린더에서 닫힙니다')) throw new Error('confirm copy missing');

// 4. 확인 → 모의 RPC + 즉시 블록 생성: 보라 신청 행 사라지고 '김더미님 피티' 블록으로 전환 (상태 변경 픽셀 증거)
await page.click('role=dialog >> text=확인');
await page.waitForTimeout(700);
const rpc = await page.evaluate(() => window.__lastRpc);
if (rpc?.fn !== 'ot_admin_pt_decide' || rpc?.args?.p_request_id !== 'dummy-req-1' || rpc?.args?.p_decision !== 'accepted') throw new Error('rpc: ' + JSON.stringify(rpc));
const agendaAfter = await page.$eval('.labdot-agenda', (e) => e.textContent);
if (!agendaAfter.includes('김더미님 피티')) throw new Error('agenda instant-confirm block missing: ' + agendaAfter.slice(0, 200));
if (agendaAfter.includes('피티 신청')) throw new Error('purple request row should be gone after instant confirm');
await page.screenshot({ path: '/downloads/pt-preview-4-agenda-accepted.png' });

// ===== B. '주' 주간 그리드 =====
await page.click('role=tab[name="주"]');
await page.waitForTimeout(800);
await page.screenshot({ path: '/downloads/pt-preview-5-week.png' });
const titles = await page.$$eval('.fc-event', (els) => els.map((e) => e.textContent.trim()));
console.log('week events:', JSON.stringify(titles));
if (!titles.some((t) => t.includes('김더미님 피티'))) throw new Error('week instant-confirm block missing');
if (!titles.some((t) => t.includes('박더미님 피티'))) throw new Error('week accepted PT block missing');
if (titles.some((t) => t.includes('피티 신청'))) throw new Error('block-backed pt request should not render as purple request');
if (titles.some((t) => t.includes('취소더미') || t.includes('거절더미'))) throw new Error('cancelled/declined leaked into week');
const statText = await page.$eval('.labdot-week-stat', (e) => e.textContent);
if (!statText.includes('총 수업 1건')) throw new Error('week counter includes pt requests: ' + statText);

// ===== C. '목록' 뷰 =====
await page.click('role=tab[name="목록"]');
await page.waitForTimeout(800);
await page.screenshot({ path: '/downloads/pt-preview-6-list.png' });
const listText = await page.$eval('.fc', (e) => e.textContent);
if (!listText.includes('김더미님 피티')) throw new Error('list instant-confirm block missing');
if (!listText.includes('박더미님 피티')) throw new Error('list accepted PT block missing');
if (listText.includes('피티 신청')) throw new Error('block-backed pt request should not render in list');
if (listText.includes('취소더미') || listText.includes('거절더미')) throw new Error('cancelled/declined leaked into list');

if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
console.log('PIXEL FLOW PASS; shots: /tmp/pt-preview-{1-agenda,2-dialog,3-confirm,4-agenda-accepted,5-week,6-list}.png');
await browser.close();
server.close();
