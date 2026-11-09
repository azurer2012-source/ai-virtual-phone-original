"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/form";
import { emailCloudClient } from "@/lib/cloud-backup/email-auth";
import { loadCloudBackupConfig, saveCloudBackupConfig, type CloudBackupConfig } from "@/lib/cloud-backup/config";
import { testCloudBackupConnection } from "@/lib/cloud-backup/storage-client";

export function EmailCloudSetup({ onConfigChanged }: { onConfigChanged?: () => void }) {
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const config = loadCloudBackupConfig();
    if (config.authMode !== "email") return;
    setUrl(config.url); setKey(config.key); setRemember(config.rememberLogin !== false); setEmail(config.email || "");
    let alive = true;
    try {
      const client = emailCloudClient(config);
      client.getSession().then(({ data }) => {
        if (alive) { setSignedIn(Boolean(data.session)); setEmail(data.session?.user.email || config.email || ""); }
      }).catch(() => { if (alive) setMessage("请重新登录云备份。"); });
      const { data: subscription } = client.onAuthStateChange((_, session) => {
        if (alive) setSignedIn(Boolean(session));
      });
      return () => { alive = false; subscription.subscription.unsubscribe(); };
    } catch { setMessage("云备份连接信息需要重新填写。"); }
    return () => { alive = false; };
  }, []);

  const config = (): CloudBackupConfig => ({ ...loadCloudBackupConfig(), url: url.trim(), key: key.trim(), authMode: "email", rememberLogin: remember, email: remember ? email.trim() : "" });
  const act = async (task: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setMessage("");
    try { await task(); }
    catch { setMessage("操作未完成。请检查项目地址、公钥、邮箱密码及账号确认状态后重试；测试连接失败时请检查云端权限。"); }
    finally { setBusy(false); }
  };
  const login = () => act(async () => {
    const next = config();
    const client = emailCloudClient(next);
    const { data, error } = await client.signInWithPassword({ email: email.trim(), password });
    if (error || !data.session) throw error || new Error("No session");
    // Replace any previous privileged key only after the new identity is verified.
    saveCloudBackupConfig({ ...next, enabled: false });
    setPassword(""); setSignedIn(true); onConfigChanged?.();
    setMessage("邮箱已登录。请测试连接；自动备份保持关闭。");
  });
  const logout = () => act(async () => {
    const next = config();
    const { error } = await emailCloudClient(next).signOut({ scope: "local" });
    if (error) throw error;
    saveCloudBackupConfig({ ...next, enabled: false });
    setSignedIn(false); setPassword(""); onConfigChanged?.();
    setMessage("本设备已退出，自动备份已关闭。");
  });
  const test = () => act(async () => {
    const result = await testCloudBackupConnection(config());
    if (!result.ok) throw new Error("Storage not ready");
    setMessage("连接成功，可手动上传和恢复备份。");
  });
  return <section className="flex flex-col gap-4">
    <h3 className="font-semibold">邮箱登录云备份</h3>
    <p className="text-sm text-gray-500">连接你自己的个人云。项目需先配置私有备份桶并授权你的邮箱账号；不会自动建项目或部署其他云功能。</p>
    <label>项目地址<Input aria-label="项目地址" value={url} disabled={busy || signedIn} onChange={e => setUrl(e.target.value)} placeholder="https://项目编号.supabase.co" /></label>
    <label>项目公钥<Input aria-label="项目公钥" value={key} disabled={busy || signedIn} onChange={e => setKey(e.target.value)} placeholder="Publishable 或 anon 公钥" autoComplete="off" /></label>
    <p className="text-sm text-gray-500">不要填写 service_role、secret 或管理 Token。每台设备分别验证邮箱，登录信息不会进入备份。</p>
    <label>邮箱<Input aria-label="邮箱" type="email" value={email} disabled={busy || signedIn} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>
    {!signedIn && <label>云备份账号密码<Input aria-label="云备份账号密码" type="password" value={password} disabled={busy} onChange={e => setPassword(e.target.value)} autoComplete="current-password" /></label>}
    <p className="text-sm text-gray-500">填写此项目邮箱用户的密码，不是 Supabase 网站登录密码或数据库密码。应用不保存账号密码。</p>
    <label className="flex items-center gap-2"><input type="checkbox" checked={remember} disabled={busy || signedIn} onChange={e => setRemember(e.target.checked)} />在此设备保持登录并记住邮箱</label>
    <p className="text-sm text-gray-500">自己的设备可以保持勾选；公共设备请取消。有效登录会自动续期，退出只影响当前设备。</p>
    {!signedIn && <button className="ui-btn" disabled={busy || !url.trim() || !key.trim() || !email.trim() || !password} onClick={login}>登录云备份</button>}
    {signedIn && <><p role="status">邮箱已登录</p><button className="ui-btn" disabled={busy} onClick={test}>测试备份连接</button><button className="ui-btn" disabled={busy} onClick={logout}>退出云备份</button></>}
    {message && <p role="status" className="text-sm">{message}</p>}
    <p className="text-sm text-gray-500">邮箱连接用于备份。微信云助手及个人推送尚未适配此登录方式。旧云备份不会被自动移动或删除。</p>
  </section>;
}
