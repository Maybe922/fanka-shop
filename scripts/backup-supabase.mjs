#!/usr/bin/env node
// 每日备份：把 Supabase 业务表全量导出为 gzip JSON 存到本地。
//
// 为什么走 REST 而不是 pg_dump：service_role key 就够了，不需要数据库密码；
// 表结构本身在 supabase/schema.sql 里（git 管着），备数据就是备了一切。
// 恢复方法：解压对应表的 json.gz，用 Supabase 后台 Table Editor 导入，
// 或写一段 supabase-js insert 灌回去。
//
// 用法（VPS cron 每日执行）：
//   35 4 * * * cd ~/fanka-shop && /usr/bin/node scripts/backup-supabase.mjs >> ~/backups/fanka/backup.log 2>&1
// 可用环境变量覆盖：ENV_FILE（默认 ./.env.local）、BACKUP_ROOT（默认 ~/backups/fanka）
//
// 失败时会通过 Telegram 报警（读取同一个 .env.local 里的 TELEGRAM_* 配置）。

import { readFileSync, mkdirSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import os from "node:os";

const ENV_FILE = process.env.ENV_FILE ?? path.resolve(".env.local");
const BACKUP_ROOT =
  process.env.BACKUP_ROOT ?? path.join(os.homedir(), "backups", "fanka");
const KEEP_DAYS = 7;
const TABLES = ["products", "cards", "orders", "articles"];
const PAGE_SIZE = 1000;
const FETCH_TIMEOUT_MS = 30_000;

function loadEnv(file) {
  const env = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

async function notifyFailure(env, message) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  console.error(`[backup] FAILED: ${message}`);
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `❌ 发卡站数据备份失败\n${message}\n请尽快检查 VPS 上的 backup.log。`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // 报警通道也挂了只能靠日志
  }
}

// 全量拉一张表：Range 头分页，直到取空。
async function dumpTable(env, table) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const res = await fetch(
      `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}?select=*&order=created_at.asc`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          Range: `${offset}-${offset + PAGE_SIZE - 1}`,
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      throw new Error(`表 ${table} 导出失败：HTTP ${res.status}`);
    }
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

// 清理超过保留期的旧备份目录（目录名即日期 YYYY-MM-DD）。
function pruneOld(root) {
  const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  let dirs;
  try {
    dirs = readdirSync(root);
  } catch {
    return;
  }
  for (const name of dirs) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(name)) continue;
    if (new Date(`${name}T00:00:00Z`).getTime() < cutoff) {
      rmSync(path.join(root, name), { recursive: true, force: true });
      console.log(`[backup] 清理过期备份 ${name}`);
    }
  }
}

const env = loadEnv(ENV_FILE);
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  await notifyFailure(env, `读不到 Supabase 配置（${ENV_FILE}）`);
  process.exit(1);
}

const day = new Date().toISOString().slice(0, 10);
const dest = path.join(BACKUP_ROOT, day);
mkdirSync(dest, { recursive: true });

try {
  const counts = [];
  for (const table of TABLES) {
    const rows = await dumpTable(env, table);
    writeFileSync(
      path.join(dest, `${table}.json.gz`),
      gzipSync(JSON.stringify(rows)),
    );
    counts.push(`${table}=${rows.length}`);
  }
  pruneOld(BACKUP_ROOT);
  console.log(`[backup] ${day} 完成：${counts.join(", ")} → ${dest}`);
} catch (err) {
  await notifyFailure(env, err instanceof Error ? err.message : String(err));
  process.exit(1);
}
